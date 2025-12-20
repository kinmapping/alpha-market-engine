/**
 * アプリケーション層: 取引所 WebSocket アダプタの共通インターフェイス
 *
 * 責務: アプリケーション層が「必要な契約」を定義する（実装はインフラ層が担当）。
 * このインターフェイスにより、異なる取引所（GMO、Bybit など）の実装を統一して扱える。
 */
export interface MarketDataAdapter {
  /**
   * WebSocket 接続を確立する。
   * @returns Promise<void> 接続が確立されたら解決される
   */
  connect(): Promise<void>;

  /**
   * WebSocket 接続を切断する。
   * 再接続のスケジュールも停止する。
   */
  disconnect(): void;
}
