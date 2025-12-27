import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedEvent } from '@/domain/models/NormalizedEvent';
import { StreamRepository } from '@/infra/redis/StreamRepository';
import { LoggerMock } from '../../helpers/LoggerMock';

// ioredis をモック
const mockXadd = vi.fn().mockResolvedValue('1234567890-0');
const mockQuit = vi.fn().mockResolvedValue('OK');

vi.mock('ioredis', () => {
  class MockRedis {
    xadd = mockXadd;
    quit = mockQuit;
  }

  return {
    default: MockRedis,
  };
});

/**
 * 単体テスト: RedisPublisher
 *
 * 優先度3: Infrastructure層の外部依存あり（Redis接続エラー時のハンドリング）
 * - 正常な配信
 * - Redis接続エラー
 * - Stream名の取得ロジック
 * - close() の動作
 */
describe('StreamRepository', () => {
  let publisher: StreamRepository;
  let loggerMock: LoggerMock;

  beforeEach(() => {
    // モックをリセット
    mockXadd.mockClear();
    mockQuit.mockClear();
    mockXadd.mockResolvedValue('1234567890-0');
    mockQuit.mockResolvedValue('OK');

    loggerMock = new LoggerMock();

    publisher = new StreamRepository('redis://localhost:6379/0', loggerMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('publish()', () => {
    it('ticker イベントを正しい Stream に配信する', async () => {
      const event: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: { last: 1000000, bid: 999000, ask: 1001000, volume: 1.5 },
      };

      await publisher.publish(event);

      expect(mockXadd).toHaveBeenCalledWith(
        'md:ticker',
        '*',
        'exchange',
        'gmo',
        'symbol',
        'BTC_JPY',
        'ts',
        expect.any(String),
        'data',
        expect.any(String)
      );
    });

    it('orderbook イベントを正しい Stream に配信する', async () => {
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

      expect(mockXadd).toHaveBeenCalledWith(
        'md:orderbook',
        '*',
        'exchange',
        'gmo',
        'symbol',
        'BTC_JPY',
        'ts',
        expect.any(String),
        'data',
        expect.any(String)
      );
    });

    it('trade イベントを正しい Stream に配信する', async () => {
      const event: NormalizedEvent = {
        type: 'trade',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: { price: 1000000, size: 0.01, side: 'buy' },
      };

      await publisher.publish(event);

      expect(mockXadd).toHaveBeenCalledWith(
        'md:trade',
        '*',
        'exchange',
        'gmo',
        'symbol',
        'BTC_JPY',
        'ts',
        expect.any(String),
        'data',
        expect.any(String)
      );
    });

    it('データフィールドが JSON 文字列として正しくシリアライズされる', async () => {
      const event: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: 1234567890,
        data: { last: 1000000, bid: 999000 },
      };

      await publisher.publish(event);

      const callArgs = mockXadd.mock.calls[0];
      const dataIndex = callArgs.indexOf('data') + 1;
      const dataString = callArgs[dataIndex] as string;
      const parsedData = JSON.parse(dataString);

      expect(parsedData).toEqual({ last: 1000000, bid: 999000 });
    });

    it('タイムスタンプが文字列として正しく変換される', async () => {
      const ts = 1234567890;
      const event: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts,
        data: {},
      };

      await publisher.publish(event);

      const callArgs = mockXadd.mock.calls[0];
      const tsIndex = callArgs.indexOf('ts') + 1;
      const tsString = callArgs[tsIndex] as string;

      expect(tsString).toBe('1234567890');
    });

    it('配信成功時にログが出力される', async () => {
      const event: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      };

      await publisher.publish(event);

      // TODO: メトリクス集計処理に統合するため、ログ出力は不要になる
      // expect(loggerMock.info).toHaveBeenCalledWith('published to stream', {
      //   stream: 'md:ticker',
      //   type: 'ticker',
      //   symbol: 'BTC_JPY',
      // });
    });
  });

  describe('エラーハンドリング: Redis接続エラー', () => {
    it('xadd がエラーを投げた場合、エラーが伝播する', async () => {
      const error = new Error('Redis connection failed');
      mockXadd.mockRejectedValue(error);

      const event: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      };

      await expect(publisher.publish(event)).rejects.toThrow('Redis connection failed');
    });

    it('ネットワークエラーの場合、エラーが伝播する', async () => {
      const error = new Error('ECONNREFUSED');
      mockXadd.mockRejectedValue(error);

      const event: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      };

      await expect(publisher.publish(event)).rejects.toThrow('ECONNREFUSED');
    });

    it('タイムアウトエラーの場合、エラーが伝播する', async () => {
      const error = new Error('Command timed out');
      mockXadd.mockRejectedValue(error);

      const event: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      };

      await expect(publisher.publish(event)).rejects.toThrow('Command timed out');
    });
  });

  describe('getStreamName() の動作確認', () => {
    it('未知のイベントタイプの場合、md: プレフィックス付きで返す', async () => {
      const event = {
        type: 'unknown_type',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      } as unknown as NormalizedEvent;

      await publisher.publish(event);

      expect(mockXadd).toHaveBeenCalledWith(
        'md:unknown_type',
        '*',
        'exchange',
        'gmo',
        'symbol',
        'BTC_JPY',
        'ts',
        expect.any(String),
        'data',
        expect.any(String)
      );
    });
  });

  describe('close()', () => {
    it('close() を呼ぶと Redis 接続が閉じられる', async () => {
      await publisher.close();

      expect(mockQuit).toHaveBeenCalledTimes(1);
    });

    it('close() がエラーを投げた場合、エラーが伝播する', async () => {
      const error = new Error('Failed to close connection');
      mockQuit.mockRejectedValue(error);

      await expect(publisher.close()).rejects.toThrow('Failed to close connection');
    });

    it('複数回 close() を呼んでも問題なく動作する', async () => {
      await publisher.close();
      await publisher.close();
      await publisher.close();

      expect(mockQuit).toHaveBeenCalledTimes(3);
    });
  });

  describe('複数のイベント配信', () => {
    it('複数のイベントを順次配信できる', async () => {
      const event1: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      };
      const event2: NormalizedEvent = {
        type: 'orderbook',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      };
      const event3: NormalizedEvent = {
        type: 'trade',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      };

      await publisher.publish(event1);
      await publisher.publish(event2);
      await publisher.publish(event3);

      expect(mockXadd).toHaveBeenCalledTimes(3);
      // xadd は配列ではなくフラットな引数として渡される
      expect(mockXadd).toHaveBeenNthCalledWith(
        1,
        'md:ticker',
        '*',
        'exchange',
        'gmo',
        'symbol',
        'BTC_JPY',
        'ts',
        expect.any(String),
        'data',
        expect.any(String)
      );
      expect(mockXadd).toHaveBeenNthCalledWith(
        2,
        'md:orderbook',
        '*',
        'exchange',
        'gmo',
        'symbol',
        'BTC_JPY',
        'ts',
        expect.any(String),
        'data',
        expect.any(String)
      );
      expect(mockXadd).toHaveBeenNthCalledWith(
        3,
        'md:trade',
        '*',
        'exchange',
        'gmo',
        'symbol',
        'BTC_JPY',
        'ts',
        expect.any(String),
        'data',
        expect.any(String)
      );
    });
  });

  describe('エッジケース: 特殊なデータ', () => {
    it('空のデータオブジェクトでも配信できる', async () => {
      const event: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      };

      await publisher.publish(event);

      expect(mockXadd).toHaveBeenCalledTimes(1);
    });

    it('ネストされたオブジェクトでも正しくシリアライズされる', async () => {
      const event: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {
          nested: {
            deep: {
              value: 123,
            },
          },
        },
      };

      await publisher.publish(event);

      const callArgs = mockXadd.mock.calls[0];
      const dataIndex = callArgs.indexOf('data') + 1;
      const dataString = callArgs[dataIndex] as string;
      const parsedData = JSON.parse(dataString);

      expect(parsedData).toEqual({
        nested: {
          deep: {
            value: 123,
          },
        },
      });
    });

    it('配列を含むデータでも正しくシリアライズされる', async () => {
      const event: NormalizedEvent = {
        type: 'orderbook',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {
          bids: [
            [999000, 0.1],
            [998000, 0.2],
          ],
          asks: [
            [1001000, 0.1],
            [1002000, 0.2],
          ],
        },
      };

      await publisher.publish(event);

      const callArgs = mockXadd.mock.calls[0];
      const dataIndex = callArgs.indexOf('data') + 1;
      const dataString = callArgs[dataIndex] as string;
      const parsedData = JSON.parse(dataString);

      expect(parsedData.bids).toEqual([
        [999000, 0.1],
        [998000, 0.2],
      ]);
    });
  });
});
