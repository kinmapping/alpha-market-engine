import type { MessageHandler } from '@/application/handlers/MessageHandler';
import type { MarketDataAdapter } from '@/application/interfaces/MarketDataAdapter';
import { ReconnectManager } from '@/infrastructure/reconnect/ReconnectManager';
import type { WebSocketConnection } from '@/infrastructure/websocket/WebSocketConnection';
import { GmoWebSocketClient } from './GmoWebSocketClient';

/**
 * インフラ層: MarketDataAdapter 実装（上記をまとめて application に提供）
 *
 * 責務: GMO コインの WebSocket API を処理するアダプタ。
 * WebSocket 接続、購読、メッセージ受信、正規化、Redis への配信を統合する。
 */
export class GmoAdapter implements MarketDataAdapter {
  private connection: WebSocketConnection | null = null;
  private readonly reconnectManager: ReconnectManager;
  private readonly webSocketClient: GmoWebSocketClient;
  private readonly messageHandler: MessageHandler;
  private readonly CONNECTION_DELAY = 500; // 接続確立後の待機時間（ミリ秒）

  /**
   * GmoAdapter を初期化する。
   * @param symbol 取引ペア（例: 'BTC_JPY'）
   * @param wsUrl GMO コインの WebSocket エンドポイント URL
   * @param messageHandler メッセージ処理のハンドラ（正規化→配信を担当）
   */
  constructor(
    private readonly symbol: string,
    private readonly wsUrl: string,
    messageHandler: MessageHandler
  ) {
    this.webSocketClient = new GmoWebSocketClient();
    this.messageHandler = messageHandler;

    // ReconnectManager に再接続時のコールバック（connect メソッド）を渡す
    this.reconnectManager = new ReconnectManager(() => this.connect());
  }

  /**
   * アダプタを起動し、WebSocket 接続を開始する。
   * ReconnectManager を通じて接続を試み、失敗時は自動的に再接続をスケジュールする。
   */
  async start(): Promise<void> {
    await this.reconnectManager.start();
  }

  /**
   * WebSocket 接続を確立する。
   * 既存の接続がある場合はクリーンアップしてから新規接続を試みる。
   * 接続成功時は自動的に購読リクエストを送信する。
   */
  async connect(): Promise<void> {
    // 既存の接続があればクリーンアップ
    if (this.connection) {
      this.connection.removeAllListeners();
      this.connection.terminate();
      this.connection = null;
    }

    // WebSocket 接続を確立
    this.connection = await this.webSocketClient.connect(this.wsUrl);

    // イベントハンドラを設定（購読前に設定する必要がある）
    this.connection.onMessage((data) => {
      void this.handleMessage(data);
    });

    // 接続確立後、少し待ってから購読リクエストを送信（レート制限対策）
    // GMO API のレート制限を考慮して、接続確立後に待機時間を設ける
    await new Promise((resolve) => setTimeout(resolve, this.CONNECTION_DELAY));
    await this.webSocketClient.subscribe(this.connection, this.symbol);

    this.connection.onClose(() => {
      console.warn(`[GmoAdapter] socket closed for ${this.symbol}`);
      this.reconnectManager.scheduleReconnect();
    });

    this.connection.onError((event) => {
      // 標準の WebSocket API では Event を返す
      // エラーの詳細は Event オブジェクトからは取得できないため、イベント自体をログに記録
      console.error(`[GmoAdapter] socket error for ${this.symbol}:`, event);
    });
  }

  /**
   * WebSocket 接続を切断し、再接続のスケジュールも停止する。
   */
  disconnect(): void {
    this.reconnectManager.stop();
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.webSocketClient.disconnect();
  }

  /**
   * 受信したメッセージを処理する。
   * @param data WebSocket から受信した生データ（string | ArrayBuffer | Blob）
   */
  private async handleMessage(data: string | ArrayBuffer | Blob): Promise<void> {
    // 生メッセージをパース
    const rawMessage = this.webSocketClient.parseMessage(data);
    if (!rawMessage) {
      return;
    }

    // エラーメッセージの場合は早期 return（エラーメッセージには channel がない）
    if ('error' in rawMessage && typeof rawMessage.error === 'string') {
      const errorMsg = rawMessage.error;
      console.error(`[GmoAdapter] API error: ${errorMsg}`);

      // ERR-5003 (Request too many) の場合は、購読リクエストの送信間隔が不十分
      // このエラーは購読リクエストの送信タイミングの問題なので、ログに記録するのみ
      if (errorMsg.includes('ERR-5003')) {
        console.warn('[GmoAdapter] Rate limit error detected. Consider increasing subscription interval.');
      }
      return;
    }

    // channel がないメッセージは無視
    if (!rawMessage.channel) {
      console.warn('[GmoAdapter] message missing channel:', rawMessage);
      return;
    }

    // デバッグ: 受信したメッセージのチャンネルをログ出力
    console.log(`[GmoAdapter] received message: channel=${rawMessage.channel}, symbol=${rawMessage.symbol}`);

    // メッセージハンドラに処理を委譲（正規化→配信）
    await this.messageHandler.handle(rawMessage);
  }
}
