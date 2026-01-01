/**
 * メトリクスレジストリの最小インターフェース
 * prom-client の Registry 型を抽象化
 */
export interface MetricsRegistry {
  contentType: string;
}

/**
 * メトリクス収集インターフェース
 *
 * 責務: メトリクスの収集・保持・公開を抽象化
 */
export interface MetricsCollector {
  /**
   * 受信メッセージ数をカウント
   * @param channel チャンネル名（ticker, orderbook, trade）
   * @param symbol シンボル（BTC_JPY など）
   */
  incrementReceived(channel: string, symbol: string): void;

  /**
   * 配信メッセージ数をカウント
   * @param stream ストリーム名（md:ticker, md:orderbook, md:trade）
   * @param symbol シンボル（BTC_JPY など）
   */
  incrementPublished(stream: string, symbol: string): void;

  /**
   * エラー数をカウント
   * @param errorType エラータイプ（parse_error, publish_error, api_error）
   */
  incrementError(errorType: string): void;

  /**
   * 再接続回数をカウント
   */
  incrementReconnect(): void;

  /**
   * Prometheus 形式のメトリクス文字列を取得
   * @returns Prometheus 形式のメトリクス文字列
   */
  getMetrics(): Promise<string>;

  /**
   * メトリクスレジストリを取得（HTTP サーバーで使用）
   */
  getRegistry(): MetricsRegistry;
}
