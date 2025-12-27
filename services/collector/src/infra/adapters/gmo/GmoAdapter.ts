import type { Logger } from '@/application/interfaces/Logger';
import type { MarketDataAdapter } from '@/application/interfaces/MarketDataAdapter';
import { LoggerFactory } from '@/infra/logger/LoggerFactory';
import type { WebSocketConnection } from '@/infra/websocket/interfaces/WebSocketConnection';
import { GmoWebSocketClient } from './GmoWebSocketClient';

/**
 * GmoAdapter の初期化オプション
 */
interface GmoAdapterOptions {
  logger?: Logger;
  onMessage?: (data: string | ArrayBuffer | Blob) => Promise<void>;
  onClose?: () => void;
  onError?: (event: Event) => void;
}

/**
 * インフラ層: MarketDataAdapter 実装
 *
 * 責務: 取引所固有の WebSocket プロトコル実装（接続、購読、メッセージパース）
 */
export class GmoAdapter implements MarketDataAdapter {
  private connection: WebSocketConnection | null = null;
  private readonly webSocketClient: GmoWebSocketClient;
  private readonly logger: Logger;
  private readonly CONNECTION_DELAY = 500; // 接続確立後の待機時間（ミリ秒）

  private onMessageCallback?: (data: string | ArrayBuffer | Blob) => Promise<void>;
  private onCloseCallback?: () => void;
  private onErrorCallback?: (event: Event) => void;

  /**
   * GmoAdapter を初期化する。
   * @param symbol 取引ペア（例: 'BTC_JPY'）
   * @param wsUrl GMO コインの WebSocket エンドポイント URL
   * @param options オプション（ロガー、コールバック関数など）
   */
  constructor(
    private readonly symbol: string,
    private readonly wsUrl: string,
    options?: GmoAdapterOptions
  ) {
    this.logger = options?.logger ?? LoggerFactory.create();
    this.webSocketClient = new GmoWebSocketClient(this.logger);
    if (options?.onMessage) this.onMessageCallback = options.onMessage;
    if (options?.onClose) this.onCloseCallback = options.onClose;
    if (options?.onError) this.onErrorCallback = options.onError;
  }

  /**
   * メッセージ受信時のコールバックを設定する。
   * @param callback メッセージ受信時に呼び出されるコールバック関数
   */
  setOnMessage(callback: (data: string | ArrayBuffer | Blob) => Promise<void>): void {
    this.onMessageCallback = callback;
  }

  /**
   * 接続切断時のコールバックを設定する。
   * @param callback 接続切断時に呼び出されるコールバック関数
   */
  setOnClose(callback: () => void): void {
    this.onCloseCallback = callback;
  }

  /**
   * エラー発生時のコールバックを設定する。
   * @param callback エラー発生時に呼び出されるコールバック関数
   */
  setOnError(callback: (event: Event) => void): void {
    this.onErrorCallback = callback;
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
      if (this.onMessageCallback) {
        void this.onMessageCallback(data);
      }
    });

    // 接続確立後、少し待ってから購読リクエストを送信（レート制限対策）
    // GMO API のレート制限を考慮して、接続確立後に待機時間を設ける
    await new Promise((resolve) => setTimeout(resolve, this.CONNECTION_DELAY));
    await this.webSocketClient.subscribe(this.connection, this.symbol);

    this.connection.onClose(() => {
      this.logger.warn('socket closed', { symbol: this.symbol });
      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
    });

    this.connection.onError((event) => {
      // 標準の WebSocket API では Event を返す
      // エラーの詳細は Event オブジェクトからは取得できないため、イベント自体をログに記録
      this.logger.error('socket error', { symbol: this.symbol, event });
      if (this.onErrorCallback) {
        this.onErrorCallback(event);
      }
    });
  }

  /**
   * WebSocket 接続を切断する。
   */
  disconnect(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.webSocketClient.disconnect();
  }

  /**
   * 生メッセージをパースして GmoRawMessage として返す。
   * @param data WebSocket から受信した生データ（string | ArrayBuffer | Blob）
   * @returns パースされたメッセージ。パースに失敗した場合は null
   */
  parseMessage(data: string | ArrayBuffer | Blob): ReturnType<typeof this.webSocketClient.parseMessage> {
    return this.webSocketClient.parseMessage(data);
  }
}
