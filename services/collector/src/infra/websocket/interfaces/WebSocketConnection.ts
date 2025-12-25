/**
 * インフラ層: 取引所非依存の WebSocket 接続ラッパ（インターフェース）
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
