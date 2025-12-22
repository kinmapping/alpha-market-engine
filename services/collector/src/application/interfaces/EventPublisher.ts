import type { NormalizedEvent } from '@/domain/types';

/**
 * イベントパブリッシャーのインターフェイス（インフラ層で実装される）。
 */
export interface EventPublisher {
  /**
   * 正規化されたイベントを配信する。
   * @param event 正規化されたイベント
   */
  publish(event: NormalizedEvent): Promise<void>;
}
