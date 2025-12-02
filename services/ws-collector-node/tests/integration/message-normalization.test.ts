import type { NormalizedEvent } from '@/domain/types';
import { GmoMessageParser } from '@/infrastructure/adapters/gmo/GmoMessageParser';
import type { GmoRawMessage } from '@/infrastructure/adapters/gmo/messages/GmoRawMessage';
import { describe, expect, it } from 'vitest';

/**
 * 統合テスト: メッセージ正規化の確認
 *
 * GMO API からの生メッセージを正規化された形式に変換できることを確認する。
 */
describe('Message Normalization Tests', () => {
  const parser = new GmoMessageParser();

  describe('ticker メッセージの正規化', () => {
    it('GMO ticker メッセージを正規化できる', () => {
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
        expect(normalized.ts).toBeGreaterThan(0);
        expect(normalized.data).toHaveProperty('last');
        expect(normalized.data).toHaveProperty('bid');
        expect(normalized.data).toHaveProperty('ask');
        expect(normalized.data).toHaveProperty('volume');
      }
    });
  });

  describe('orderbook メッセージの正規化', () => {
    it('GMO orderbook メッセージを正規化できる', () => {
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
        expect(normalized.exchange).toBe('gmo');
        expect(normalized.symbol).toBe('BTC_JPY');
        expect(normalized.ts).toBeGreaterThan(0);
        expect(normalized.data).toHaveProperty('is_snapshot');
        expect(normalized.data).toHaveProperty('bids');
        expect(normalized.data).toHaveProperty('asks');
      }
    });
  });

  describe('trade メッセージの正規化', () => {
    it('GMO trade メッセージを正規化できる', () => {
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
        expect(normalized.exchange).toBe('gmo');
        expect(normalized.symbol).toBe('BTC_JPY');
        expect(normalized.ts).toBeGreaterThan(0);
        expect(normalized.data).toHaveProperty('price');
        expect(normalized.data).toHaveProperty('size');
        expect(normalized.data).toHaveProperty('side');
        expect((normalized.data as { side: string }).side).toBe('buy'); // 小文字に変換されているか
      }
    });

    it('SELL サイドも正規化できる', () => {
      const rawMessage: GmoRawMessage = {
        channel: 'trades',
        symbol: 'BTC_JPY',
        timestamp: '2024-01-01T00:00:00.000Z',
        price: 1000000,
        size: 0.01,
        side: 'SELL',
      };

      const normalized = parser.parse(rawMessage);

      expect(normalized).not.toBeNull();
      if (normalized) {
        expect((normalized.data as { side: string }).side).toBe('sell');
      }
    });
  });

  describe('エラーハンドリング', () => {
    it('エラーメッセージは null を返す', () => {
      const errorMessage = { error: 'ERR-5003 Request too many.' };

      const normalized = parser.parse(errorMessage);

      expect(normalized).toBeNull();
    });

    it('channel がないメッセージは null を返す', () => {
      const invalidMessage = { symbol: 'BTC_JPY' };

      const normalized = parser.parse(invalidMessage);

      expect(normalized).toBeNull();
    });

    it('不正な形式のメッセージは null を返す', () => {
      const invalidMessage = null;

      const normalized = parser.parse(invalidMessage);

      expect(normalized).toBeNull();
    });
  });

  describe('データ型の確認', () => {
    it('正規化されたイベントが NormalizedEvent 型に準拠している', () => {
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
        const event: NormalizedEvent = normalized; // 型チェック
        expect(event.type).toBeDefined();
        expect(event.exchange).toBeDefined();
        expect(event.symbol).toBeDefined();
        expect(typeof event.ts).toBe('number');
        expect(event.data).toBeDefined();
      }
    });
  });
});
