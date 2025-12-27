/**
 * ロガーインターフェース
 *
 * 構造化ログを出力するためのインターフェース。
 * 実装は pino を使用するが、テスト容易性のためにインターフェースを定義。
 */
export interface Logger {
  /**
   * デバッグレベルのログを出力
   * @param msg ログメッセージ
   * @param meta 追加のメタデータ（オプション）
   */
  debug(msg: string, meta?: object): void;

  /**
   * 情報レベルのログを出力
   * @param msg ログメッセージ
   * @param meta 追加のメタデータ（オプション）
   */
  info(msg: string, meta?: object): void;

  /**
   * 警告レベルのログを出力
   * @param msg ログメッセージ
   * @param meta 追加のメタデータ（オプション）
   */
  warn(msg: string, meta?: object): void;

  /**
   * エラーレベルのログを出力
   * @param msg ログメッセージ
   * @param meta 追加のメタデータ（オプション）
   */
  error(msg: string, meta?: object): void;

  /**
   * 子ロガーを作成
   * コンテキスト（component, symbol など）を自動付与するために使用
   * @param bindings 子ロガーに付与するコンテキスト情報
   * @returns 新しいロガーインスタンス
   */
  child(bindings: object): Logger;
}
