import type { NormalizedEvent } from '@/domain/models/NormalizedEvent';

/**
 * メッセージパーサーのインターフェイス（インフラ層で実装される）。
 */
export interface MessageParser {
  /**
   * 生メッセージを正規化されたイベントに変換する。
   * @param rawMessage 取引所固有の生メッセージ
   * @returns 正規化されたイベント。変換できない場合は null
   */
  parse(rawMessage: unknown): NormalizedEvent | null;
}
