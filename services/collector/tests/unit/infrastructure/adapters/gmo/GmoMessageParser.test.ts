import { LoggerMock } from '@test/unit/helpers/mocks/LoggerMock';
import { beforeEach, describe, expect, it } from 'vitest';
import { GmoMessageParser } from '@/infra/adapters/gmo/GmoMessageParser';
import type { GmoRawMessage } from '@/infra/adapters/gmo/types/GmoRawMessage';

/**
 * 単体テスト: GmoMessageParser
 *
 * 優先度3: Infrastructure層の外部依存あり（統合テストでカバーしていないエッジケース）
 * - 不正なタイムスタンプ形式の処理
 * - 不正なデータ型の処理
 * - 部分的なデータ欠損
 * - エラーメッセージの処理
 */
describe('GmoMessageParser', () => {
  let parser: GmoMessageParser;
  let loggerMock: LoggerMock;

  beforeEach(() => {
    loggerMock = new LoggerMock();
    parser = new GmoMessageParser(loggerMock);
  });

  describe('正常系（統合テストでカバー済みだが、単体テストでも確認）', () => {
    it('ticker メッセージを正規化できる', () => {
      const rawMessage: GmoRawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        last: 1000000,
        bid: 999000,
        ask: 1001000,
        volume: 1.5,
      };

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        expect(normalized.type).toBe('ticker');
        expect(normalized.exchange).toBe('gmo');
        expect(normalized.symbol).toBe('BTC_JPY');
        expect(normalized.ts).toBe(Date.parse('2024-01-01T00:00:00.000Z'));
        expect(normalized.data).toEqual({
          last: 1000000,
          bid: 999000,
          ask: 1001000,
          volume: 1.5,
        });
      }
    });

    it('orderbook メッセージを正規化できる', () => {
      const rawMessage: GmoRawMessage = {
        channel: 'orderbooks',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        bids: [
          [999000, 0.1],
          [998000, 0.2],
        ],
        asks: [
          [1001000, 0.1],
          [1002000, 0.2],
        ],
      };

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        expect(normalized.type).toBe('orderbook');
        expect(normalized.data).toEqual({
          is_snapshot: true,
          bids: [
            [999000, 0.1],
            [998000, 0.2],
          ],
          asks: [
            [1001000, 0.1],
            [1002000, 0.2],
          ],
        });
      }
    });

    it('trade メッセージを正規化できる', () => {
      const rawMessage: GmoRawMessage = {
        channel: 'trades',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        price: 1000000,
        size: 0.01,
        side: 'BUY',
      };

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        expect(normalized.type).toBe('trade');
        expect((normalized.data as { side: string }).side).toBe('buy');
      }
    });
  });

  describe('エッジケース: 不正なタイムスタンプ形式', () => {
    it('無効なタイムスタンプ文字列の場合、NaN が返されるが処理は続行される', () => {
      const rawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: 'invalid-timestamp',
        last: 1000000,
        bid: 999000,
        ask: 1001000,
        volume: 1.5,
      } as GmoRawMessage;

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        expect(Number.isNaN(normalized.ts)).toBe(true);
      }
    });

    it('空文字列のタイムスタンプの場合、NaN が返される', () => {
      const rawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: '',
        last: 1000000,
        bid: 999000,
        ask: 1001000,
        volume: 1.5,
      } as GmoRawMessage;

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        expect(Number.isNaN(normalized.ts)).toBe(true);
      }
    });

    it('タイムスタンプが undefined の場合、NaN が返される', () => {
      const rawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: undefined,
        last: 1000000,
        bid: 999000,
        ask: 1001000,
        volume: 1.5,
      } as unknown as GmoRawMessage;

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        expect(Number.isNaN(normalized.ts)).toBe(true);
      }
    });
  });

  describe('エッジケース: 不正なデータ型', () => {
    it('ticker で数値フィールドが文字列の場合、そのまま返される', () => {
      const rawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        last: '1000000', // 文字列
        bid: '999000', // 文字列
        ask: '1001000', // 文字列
        volume: '1.5', // 文字列
      } as unknown as GmoRawMessage;

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        expect(normalized.data).toEqual({
          last: '1000000',
          bid: '999000',
          ask: '1001000',
          volume: '1.5',
        });
      }
    });

    it('orderbook で bids/asks が空配列の場合、空配列が返される', () => {
      const rawMessage: GmoRawMessage = {
        channel: 'orderbooks',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        bids: [],
        asks: [],
      };

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        expect(normalized.data).toEqual({
          is_snapshot: true,
          bids: [],
          asks: [],
        });
      }
    });

    it('trade で side が小文字の場合、小文字のまま返される', () => {
      const rawMessage = {
        channel: 'trades',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        price: 1000000,
        size: 0.01,
        side: 'buy', // 小文字
      } as unknown as GmoRawMessage;

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        // toLowerCase() が呼ばれるが、既に小文字なのでそのまま
        expect((normalized.data as { side: string }).side).toBe('buy');
      }
    });
  });

  describe('エッジケース: 部分的なデータ欠損', () => {
    it('ticker で一部のフィールドが undefined の場合、undefined が含まれる', () => {
      const rawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        last: 1000000,
        bid: undefined,
        ask: 1001000,
        volume: 1.5,
      } as unknown as GmoRawMessage;

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        expect((normalized.data as { bid: unknown }).bid).toBeUndefined();
      }
    });

    it('symbol が空文字列の場合、空文字列が返される', () => {
      const rawMessage: GmoRawMessage = {
        channel: 'ticker',
        symbol: '',
        timestamp: '2024-01-01T00:00:00.000Z',
        last: 1000000,
        bid: 999000,
        ask: 1001000,
        volume: 1.5,
      };

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        expect(normalized.symbol).toBe('');
      }
    });
  });

  describe('エッジケース: エラーメッセージの処理', () => {
    it('エラーメッセージ（error フィールドあり）の場合、null を返す', () => {
      const errorMessage: GmoRawMessage = {
        error: 'ERR-5003 Request too many.',
      };

      const normalized = parser.parse(errorMessage);

      expect(normalized).toBeNull();
      expect(loggerMock.warn).toHaveBeenCalled();
    });

    it('エラーメッセージと channel が両方ある場合、channel を優先する', () => {
      const rawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        last: 1000000,
        bid: 999000,
        ask: 1001000,
        volume: 1.5,
        error: 'some error', // エラーも含まれているが、channel があるので処理される
      } as unknown as GmoRawMessage;

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
    });
  });

  describe('エッジケース: 未知のチャンネル', () => {
    it('未知の channel 値の場合、null を返す', () => {
      const rawMessage = {
        channel: 'unknown_channel',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
      } as unknown as GmoRawMessage;

      const normalized = parser.parse(rawMessage);

      expect(normalized).toBeNull();
    });
  });

  describe('エッジケース: パースエラー', () => {
    it('null の場合、null を返す', () => {
      const invalidMessage = null;

      const normalized = parser.parse(invalidMessage);

      expect(normalized).toBeNull();
      // null の場合は console.error は呼ばれない（channel チェックで早期 return）
    });

    it('オブジェクトではない値の場合、null を返す', () => {
      const invalidMessage = 'not an object';

      const normalized = parser.parse(invalidMessage);

      expect(normalized).toBeNull();
    });

    it('数値の場合、null を返す', () => {
      const invalidMessage = 12345;

      const normalized = parser.parse(invalidMessage);

      expect(normalized).toBeNull();
    });

    it('配列の場合、null を返す', () => {
      const invalidMessage = [{ channel: 'ticker' }];

      const normalized = parser.parse(invalidMessage);

      expect(normalized).toBeNull();
    });
  });

  describe('エッジケース: 境界値', () => {
    it('非常に大きな数値でも処理できる', () => {
      const rawMessage: GmoRawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        last: Number.MAX_SAFE_INTEGER,
        bid: Number.MAX_SAFE_INTEGER,
        ask: Number.MAX_SAFE_INTEGER,
        volume: Number.MAX_SAFE_INTEGER,
      };

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        expect((normalized.data as { last: number }).last).toBe(Number.MAX_SAFE_INTEGER);
      }
    });

    it('負の数値でも処理できる', () => {
      const rawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        last: -1000,
        bid: -2000,
        ask: -3000,
        volume: -1.5,
      } as unknown as GmoRawMessage;

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        expect((normalized.data as { last: number }).last).toBe(-1000);
      }
    });

    it('ゼロ値でも処理できる', () => {
      const rawMessage: GmoRawMessage = {
        channel: 'ticker',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        last: 0,
        bid: 0,
        ask: 0,
        volume: 0,
      };

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        expect((normalized.data as { last: number }).last).toBe(0);
      }
    });
  });
});
