/**
 * インフラ層: 取引所非依存の WebSocket 接続ラッパ
 *
 * 責務: WebSocket 接続の確立・管理・イベント処理を抽象化する。
 * Node.js 標準の WebSocket API を使用する。
 */
export interface WebSocketConnection {
  /**
   * 接続が確立されたときに呼ばれるコールバック
   */
  onOpen(callback: () => void): void;

  /**
   * メッセージを受信したときに呼ばれるコールバック
   * 標準の WebSocket API では string | ArrayBuffer | Blob を返す
   */
  onMessage(callback: (data: string | ArrayBuffer | Blob) => void): void;

  /**
   * 接続が閉じられたときに呼ばれるコールバック
   */
  onClose(callback: () => void): void;

  /**
   * エラーが発生したときに呼ばれるコールバック
   * 標準の WebSocket API では Event を返す
   */
  onError(callback: (error: Event) => void): void;

  /**
   * メッセージを送信する
   */
  send(data: string): void;

  /**
   * 接続を閉じる
   */
  close(): void;

  /**
   * すべてのイベントリスナーを削除する
   */
  removeAllListeners(): void;

  /**
   * 接続を強制終了する（標準 API では close() を使用）
   */
  terminate(): void;
}

/**
 * Node.js 標準の WebSocket API を使った WebSocket 接続の実装
 */
export class StandardWebSocketConnection implements WebSocketConnection {
  private openCallbacks: Array<() => void> = [];
  private messageCallbacks: Array<(data: string | ArrayBuffer | Blob) => void> = [];
  private closeCallbacks: Array<() => void> = [];
  private errorCallbacks: Array<(error: Event) => void> = [];

  constructor(private readonly socket: WebSocket) {
    // 標準の WebSocket イベントを内部で管理
    this.socket.addEventListener('open', () => {
      for (const cb of this.openCallbacks) {
        cb();
      }
    });

    this.socket.addEventListener('message', (event) => {
      for (const cb of this.messageCallbacks) {
        cb(event.data);
      }
    });

    this.socket.addEventListener('close', () => {
      for (const cb of this.closeCallbacks) {
        cb();
      }
    });

    this.socket.addEventListener('error', (event) => {
      for (const cb of this.errorCallbacks) {
        cb(event);
      }
    });
  }

  onOpen(callback: () => void): void {
    this.openCallbacks.push(callback);
  }

  onMessage(callback: (data: string | ArrayBuffer | Blob) => void): void {
    this.messageCallbacks.push(callback);
  }

  onClose(callback: () => void): void {
    this.closeCallbacks.push(callback);
  }

  onError(callback: (error: Event) => void): void {
    this.errorCallbacks.push(callback);
  }

  send(data: string): void {
    this.socket.send(data);
  }

  close(): void {
    this.socket.close();
  }

  removeAllListeners(): void {
    this.openCallbacks = [];
    this.messageCallbacks = [];
    this.closeCallbacks = [];
    this.errorCallbacks = [];
  }

  terminate(): void {
    // 標準の WebSocket には terminate() がないので、close() を使用
    this.socket.close();
  }
}
