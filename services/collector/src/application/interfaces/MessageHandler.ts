/**
 * アプリケーション層: メッセージ処理のオーケストレーション
 *
 * 責務: 「何をするか」を決める（実装の詳細は持たない）。
 * WebSocket から受信した RawMessage を正規化し、Redis に配信するフローを組み立てる。
 *
 * 注意: 正規化や Redis 書き込みの実装は持たず、インフラ層のコンポーネントを組み合わせるだけ。
 */
export interface MessageHandler {
  /**
   * メッセージを処理する（正規化→配信のフローを実行）。
   * @param rawMessage 取引所固有の生メッセージ
   */
  handle(rawMessage: unknown): Promise<void>;
}
