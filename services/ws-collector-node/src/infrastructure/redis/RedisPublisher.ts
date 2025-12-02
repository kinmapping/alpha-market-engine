import Redis from 'ioredis';
import type { EventPublisher } from '@/application/handlers/MessageHandler';
import type { NormalizedEvent } from '@/domain/types';

/**
 * インフラ層: Redis Stream への書き込み実装
 *
 * 責務: NormalizedEvent を Redis Stream に XADD する（実装の詳細を担当）。
 */
export class RedisPublisher implements EventPublisher {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  /**
   * 正規化されたイベントを Redis Stream に配信する。
   * @param event 正規化されたイベント
   */
  async publish(event: NormalizedEvent): Promise<void> {
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
    console.log(
      `[RedisPublisher] published to stream: ${stream}, type: ${event.type}, symbol: ${event.symbol}`
    );
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
