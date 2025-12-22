import type { WebSocketConnection } from '@/infrastructure/websocket/interfaces/WebSocketConnection';
import { StandardWebSocketConnection } from '@/infrastructure/websocket/StandardWebSocketConnection';
import type { GmoCommand } from './types/GmoCommand';
import type { GmoRawMessage } from './types/GmoRawMessage';

/**
 * インフラ層: GMO WebSocket 接続・購読・受信（低レベル）
 *
 * 責務: GMO API の WebSocket プロトコル実装。
 * WebSocket 接続の確立、購読メッセージ送信、生メッセージ受信のみを担当する。
 * Node.js 標準の WebSocket API を使用する。
 */
export class GmoWebSocketClient {
  private connection: WebSocketConnection | null = null;
  private readonly SUBSCRIPTION_INTERVAL = 1000; // 1秒

  /**
   * WebSocket 接続を確立する。
   * @param wsUrl WebSocket エンドポイント URL
   * @returns Promise<WebSocketConnection> 接続が確立されたら解決される
   */
  async connect(wsUrl: string): Promise<WebSocketConnection> {
    return new Promise<WebSocketConnection>((resolve, reject) => {
      const socket = new WebSocket(wsUrl);
      const connection = new StandardWebSocketConnection(socket);

      const onOpen = () => {
        this.connection = connection;
        resolve(connection);
      };

      const onError = (_event: Event) => {
        connection.removeAllListeners();
        reject(new Error('WebSocket connection failed'));
      };

      connection.onOpen(onOpen);
      connection.onError(onError);
    });
  }

  /**
   * 購読リクエストを送信する。
   * GMO API のレート制限を考慮して、リクエスト間に十分な間隔を設ける。
   * @param connection WebSocket 接続
   * @param symbol 取引ペア
   */
  async subscribe(connection: WebSocketConnection, symbol: string): Promise<void> {
    const channels: Array<'ticker' | 'orderbooks' | 'trades'> = ['ticker', 'orderbooks', 'trades'];

    // レート制限対策: 各購読リクエストの間に 1秒の間隔を設ける
    // GMO API のレート制限が厳しいため、間隔を長めに設定
    for (let i = 0; i < channels.length; i++) {
      const channel = channels[i];
      const command: GmoCommand = {
        command: 'subscribe',
        channel,
        symbol,
      };
      connection.send(JSON.stringify(command));
      console.log(`[GmoWebSocketClient] subscribed to ${channel} for ${symbol}`);

      // 最後のリクエスト以外は待機（1秒間隔）
      if (i < channels.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, this.SUBSCRIPTION_INTERVAL));
      }
    }
  }

  /**
   * 接続を閉じる。
   */
  disconnect(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
  }

  /**
   * 生メッセージをパースして GmoRawMessage として返す。
   * @param data 受信した生データ（string | ArrayBuffer | Blob）
   * @returns パースされたメッセージ。パースに失敗した場合は null
   */
  parseMessage(data: string | ArrayBuffer | Blob): GmoRawMessage | null {
    try {
      // 標準の WebSocket は string または ArrayBuffer/Blob を返す
      let text: string;
      if (typeof data === 'string') {
        text = data;
      } else if (data instanceof ArrayBuffer) {
        text = Buffer.from(data).toString('utf-8');
      } else if (data instanceof Blob) {
        // Blob の場合は非同期処理が必要だが、通常は string または ArrayBuffer
        text = Buffer.from(data as unknown as ArrayBuffer).toString('utf-8');
      } else {
        text = String(data);
      }
      return JSON.parse(text) as GmoRawMessage;
    } catch (error) {
      console.error('[GmoWebSocketClient] failed to parse message:', error);
      return null;
    }
  }
}
