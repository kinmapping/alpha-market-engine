import type { NormalizedEvent } from '@/domain/models/NormalizedEvent';

/**
 * ストリームパブリッシャーのインターフェイス（インフラ層で実装される）。
 */
export interface StreamPublisher {
  /**
   * 正規化されたイベントを配信する。
   * @param event 正規化されたイベント
   */
  publish(event: NormalizedEvent): Promise<void>;
}
