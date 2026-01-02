import Redis from 'ioredis';
import type { Logger } from '@/application/interfaces/Logger';
import type { MetricsCollector } from '@/application/interfaces/MetricsCollector';
import type { NormalizedEvent } from '@/domain/models/NormalizedEvent';
import type { StreamPublisher } from '@/domain/repositories/StreamPublisher';
import { LoggerFactory } from '@/infra/logger/LoggerFactory';

/**
 * インフラ層: Redis Stream への書き込み実装
 *
 * 責務: NormalizedEvent を Redis Stream に XADD する（実装の詳細を担当）。
 */
export class StreamRepository implements StreamPublisher {
  private readonly redis: Redis;
  private readonly logger: Logger;

  /**
   * @param redisUrl Redis 接続 URL
   * @param logger ロガー（オプショナル、未指定の場合は LoggerFactory から取得）
   * @param metricsCollector メトリクスコレクター（オプショナル）
   */
  constructor(
    redisUrl: string,
    logger?: Logger,
    private readonly metricsCollector?: MetricsCollector
  ) {
    this.redis = new Redis(redisUrl);
    this.logger = logger ?? LoggerFactory.create();
  }

  /**
   * 正規化されたイベントを Redis Stream に配信する。
   * @param event 正規化されたイベント
   */
  async publish(event: NormalizedEvent): Promise<void> {
    try {
      // イベントタイプに応じて Stream 名を取得
      const stream = this.getStreamName(event.type);
      const payload = {
        exchange: event.exchange,
        symbol: event.symbol,
        ts: event.ts.toString(),
        data: JSON.stringify(event.data),
      };

      // XADD コマンドでメッセージを追加
      await this.redis.xadd(stream, '*', ...Object.entries(payload).flat());

      // DEBUG:デバッグ確認(メモリ圧迫するため、開発確認時のみ有効化)
      // this.logger.debug('published to stream', { stream, type: event.type, symbol: event.symbol });

      // メトリクス収集: 配信メッセージ数
      if (this.metricsCollector) {
        this.metricsCollector.incrementPublished(stream, event.symbol);
      }
    } catch (error) {
      // メトリクス収集: 配信エラー
      if (this.metricsCollector) {
        this.metricsCollector.incrementError('publish_error');
      }
      throw error;
    }
  }

  /**
   * Redis 接続を閉じる。
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * イベントタイプから Redis Stream 名を取得する。
   * @param type イベントタイプ
   * @returns Redis Stream 名
   */
  private getStreamName(type: NormalizedEvent['type']): string {
    switch (type) {
      case 'trade':
        return 'md:trade';
      case 'orderbook':
        return 'md:orderbook';
      case 'ticker':
        return 'md:ticker';
      default:
        return `md:${type}`;
    }
  }
}
