/**
 * ドメイン層: ビジネス概念の型定義（DTO 的な型のみ）
 *
 * 注意: エンティティクラス（Ticker, OrderBook, Trade クラス）は作らない。
 * ビジネスロジック（スプレッド計算など）も持たない。
 * ws-collector-node は「データの通過点」なので、DTO 的な型のみを持つ。
 */

/**
 * 収集対象となるマーケットデータ種別の列挙。
 */
export type MarketDataType = 'trade' | 'orderbook' | 'ticker';

/**
 * 正規化されたマーケットデータイベント。
 * 取引所固有の形式を統一したフォーマットに変換したデータ。
 *
 * @template T データの型（ticker, orderbook, trade ごとに異なる）
 */
export interface NormalizedEvent<T = unknown> {
  /** マーケットデータの種別 */
  type: MarketDataType;
  /** 取引所名（例: 'gmo'） */
  exchange: string;
  /** 取引ペア（例: 'BTC_JPY'） */
  symbol: string;
  /** タイムスタンプ（エポックミリ秒） */
  ts: number;
  /** データ本体（種別ごとに異なる構造） */
  data: T;
}
