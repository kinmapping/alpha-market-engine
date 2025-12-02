import type { NormalizedEvent } from '@/domain/types';
import { RedisPublisher } from '@/infrastructure/redis/RedisPublisher';
import Redis from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * 統合テスト: Redis Stream へのデータ配信確認
 *
 * レベル1の確認項目:
 * - md:ticker, md:orderbook, md:trade の3つのStreamが存在する
 * - 各Streamにデータが流れている
 * - 正規化されたデータ構造が正しい
 */
describe('Redis Stream Integration Tests', () => {
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/0';
  let redis: Redis;
  let publisher: RedisPublisher;

  beforeAll(() => {
    redis = new Redis(REDIS_URL);
    publisher = new RedisPublisher(REDIS_URL);
  });

  afterAll(async () => {
    await publisher.close();
    await redis.quit();
  });

  describe('Stream存在確認', () => {
    it('md:ticker, md:orderbook, md:trade の3つのStreamが存在する', async () => {
      // テストデータを配信
      const tickerEvent: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: { last: 1000000, bid: 999000, ask: 1001000, volume: 1.5 },
      };

      const orderbookEvent: NormalizedEvent = {
        type: 'orderbook',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {
          is_snapshot: true,
          bids: [[999000, 0.1]],
          asks: [[1001000, 0.1]],
        },
      };

      const tradeEvent: NormalizedEvent = {
        type: 'trade',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: { price: 1000000, size: 0.01, side: 'buy' },
      };

      await publisher.publish(tickerEvent);
      await publisher.publish(orderbookEvent);
      await publisher.publish(tradeEvent);

      // 少し待機してからStreamの存在を確認
      await new Promise((resolve) => setTimeout(resolve, 100));

      const keys = await redis.keys('md:*');
      const streamNames = keys.sort();

      expect(streamNames).toContain('md:ticker');
      expect(streamNames).toContain('md:orderbook');
      expect(streamNames).toContain('md:trade');
    });
  });

  describe('データ配信確認', () => {
    it('md:ticker にデータが配信されている', async () => {
      const event: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: { last: 1000000, bid: 999000, ask: 1001000, volume: 1.5 },
      };

      await publisher.publish(event);

      // 少し待機
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 最新のメッセージを取得
      const messages = await redis.xread('COUNT', 1, 'STREAMS', 'md:ticker', '0');

      expect(messages).not.toBeNull();
      expect(messages?.length).toBeGreaterThan(0);

      if (messages && messages.length > 0) {
        const streamData = messages[0];
        expect(streamData[0]).toBe('md:ticker');
        expect(streamData[1].length).toBeGreaterThan(0);
      }
    });

    it('md:orderbook にデータが配信されている', async () => {
      const event: NormalizedEvent = {
        type: 'orderbook',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {
          is_snapshot: true,
          bids: [[999000, 0.1]],
          asks: [[1001000, 0.1]],
        },
      };

      await publisher.publish(event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const messages = await redis.xread('COUNT', 1, 'STREAMS', 'md:orderbook', '0');

      expect(messages).not.toBeNull();
      if (messages && messages.length > 0) {
        expect(messages[0][0]).toBe('md:orderbook');
      }
    });

    it('md:trade にデータが配信されている', async () => {
      const event: NormalizedEvent = {
        type: 'trade',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: { price: 1000000, size: 0.01, side: 'buy' },
      };

      await publisher.publish(event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const messages = await redis.xread('COUNT', 1, 'STREAMS', 'md:trade', '0');

      expect(messages).not.toBeNull();
      if (messages && messages.length > 0) {
        expect(messages[0][0]).toBe('md:trade');
      }
    });
  });

  describe('データ構造確認', () => {
    it('正規化されたデータ構造が正しい（exchange, symbol, ts, data フィールドが存在）', async () => {
      const event: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: { last: 1000000, bid: 999000, ask: 1001000, volume: 1.5 },
      };

      await publisher.publish(event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const messages = await redis.xread('COUNT', 1, 'STREAMS', 'md:ticker', '0');

      expect(messages).not.toBeNull();
      if (messages && messages.length > 0) {
        const streamData = messages[0];
        const messageData = streamData[1][0][1]; // [id, [field, value, field, value, ...]]

        // フィールドをオブジェクトに変換
        const data: Record<string, string> = {};
        for (let i = 0; i < messageData.length; i += 2) {
          data[messageData[i] as string] = messageData[i + 1] as string;
        }

        // 必須フィールドの存在確認
        expect(data.exchange).toBe('gmo');
        expect(data.symbol).toBe('BTC_JPY');
        expect(data.ts).toBeDefined();
        expect(data.data).toBeDefined();

        // dataフィールドがJSONとしてパースできることを確認
        const parsedData = JSON.parse(data.data);
        expect(parsedData).toHaveProperty('last');
        expect(parsedData).toHaveProperty('bid');
        expect(parsedData).toHaveProperty('ask');
        expect(parsedData).toHaveProperty('volume');
      }
    });

    it('タイムスタンプが適切に設定されている', async () => {
      const now = Date.now();
      const event: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: now,
        data: { last: 1000000, bid: 999000, ask: 1001000, volume: 1.5 },
      };

      await publisher.publish(event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // XREVRANGE で最新のメッセージを取得（- は最小、+ は最大、COUNT 1 で最新1件）
      const messages = await redis.xrevrange('md:ticker', '+', '-', 'COUNT', 1);

      expect(messages).not.toBeNull();
      expect(messages.length).toBeGreaterThan(0);

      if (messages && messages.length > 0) {
        const messageData = messages[0][1]; // [id, [field, value, field, value, ...]]

        const data: Record<string, string> = {};
        for (let i = 0; i < messageData.length; i += 2) {
          data[messageData[i] as string] = messageData[i + 1] as string;
        }

        const ts = Number.parseInt(data.ts, 10);
        expect(ts).toBe(now);
        expect(ts).toBeGreaterThan(0);
      }
    });
  });

  describe('Stream長さ確認', () => {
    it('メッセージ数が増加している', async () => {
      const initialLength = await redis.xlen('md:ticker');

      const event: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: { last: 1000000, bid: 999000, ask: 1001000, volume: 1.5 },
      };

      await publisher.publish(event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const newLength = await redis.xlen('md:ticker');
      expect(newLength).toBeGreaterThan(initialLength);
    });
  });
});
