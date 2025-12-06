import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventPublisher, MessageParser } from '@/application/handlers/MessageHandler';
import { DefaultMessageHandler } from '@/application/handlers/MessageHandler';
import type { NormalizedEvent } from '@/domain/types';

/**
 * 単体テスト: DefaultMessageHandler
 *
 * 優先度2: Application層のオーケストレーションロジック
 * - 正常系: パーサー→パブリッシャーのフロー
 * - エッジケース: パーサーが null を返す場合
 * - エラーハンドリング: パブリッシャーがエラーを投げる場合
 */
describe('DefaultMessageHandler', () => {
  let mockParser: MessageParser;
  let mockPublisher: EventPublisher;
  let handler: DefaultMessageHandler;

  beforeEach(() => {
    // モックの作成
    mockParser = {
      parse: vi.fn(),
    };
    mockPublisher = {
      publish: vi.fn(),
    };
    handler = new DefaultMessageHandler(mockParser, mockPublisher);
  });

  describe('正常系', () => {
    it('パーサーが正規化されたイベントを返した場合、パブリッシャーに渡す', async () => {
      const rawMessage = { channel: 'ticker', symbol: 'BTC_JPY' };
      const normalizedEvent: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: { last: 1000000, bid: 999000, ask: 1001000, volume: 1.5 },
      };

      vi.mocked(mockParser.parse).mockReturnValue(normalizedEvent);
      vi.mocked(mockPublisher.publish).mockResolvedValue(undefined);

      await handler.handle(rawMessage);

      expect(mockParser.parse).toHaveBeenCalledWith(rawMessage);
      expect(mockParser.parse).toHaveBeenCalledTimes(1);
      expect(mockPublisher.publish).toHaveBeenCalledWith(normalizedEvent);
      expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
    });

    it('パーサーとパブリッシャーが正しい順序で呼ばれる', async () => {
      const rawMessage = { channel: 'ticker' };
      const normalizedEvent: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      };

      vi.mocked(mockParser.parse).mockReturnValue(normalizedEvent);
      vi.mocked(mockPublisher.publish).mockResolvedValue(undefined);

      await handler.handle(rawMessage);

      // パーサーが先に呼ばれることを確認
      expect(mockParser.parse).toHaveBeenCalledTimes(1);
      expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
      // パーサーが呼ばれた後にパブリッシャーが呼ばれる（順序の確認）
      const parseCallOrder = vi.mocked(mockParser.parse).mock.invocationCallOrder[0];
      const publishCallOrder = vi.mocked(mockPublisher.publish).mock.invocationCallOrder[0];
      expect(parseCallOrder).toBeLessThan(publishCallOrder);
    });
  });

  describe('エッジケース: パーサーが null を返す場合', () => {
    it('パーサーが null を返した場合、パブリッシャーは呼ばれない', async () => {
      const rawMessage = { invalid: 'message' };

      vi.mocked(mockParser.parse).mockReturnValue(null);

      await handler.handle(rawMessage);

      expect(mockParser.parse).toHaveBeenCalledWith(rawMessage);
      expect(mockParser.parse).toHaveBeenCalledTimes(1);
      expect(mockPublisher.publish).not.toHaveBeenCalled();
    });

    it('パーサーが null を返してもエラーが発生しない', async () => {
      const rawMessage = { invalid: 'message' };

      vi.mocked(mockParser.parse).mockReturnValue(null);

      await expect(handler.handle(rawMessage)).resolves.not.toThrow();
    });

    it('複数回 null が返されても正常に動作する', async () => {
      const rawMessage1 = { invalid1: 'message' };
      const rawMessage2 = { invalid2: 'message' };

      vi.mocked(mockParser.parse).mockReturnValue(null);

      await handler.handle(rawMessage1);
      await handler.handle(rawMessage2);

      expect(mockParser.parse).toHaveBeenCalledTimes(2);
      expect(mockPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe('エラーハンドリング: パブリッシャーがエラーを投げる場合', () => {
    it('パブリッシャーがエラーを投げた場合、エラーが伝播する', async () => {
      const rawMessage = { channel: 'ticker' };
      const normalizedEvent: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      };
      const publishError = new Error('Redis connection failed');

      vi.mocked(mockParser.parse).mockReturnValue(normalizedEvent);
      vi.mocked(mockPublisher.publish).mockRejectedValue(publishError);

      await expect(handler.handle(rawMessage)).rejects.toThrow('Redis connection failed');
      expect(mockParser.parse).toHaveBeenCalledTimes(1);
      expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
    });

    it('パブリッシャーのエラー後も次のメッセージを処理できる', async () => {
      const rawMessage1 = { channel: 'ticker' };
      const rawMessage2 = { channel: 'orderbook' };
      const normalizedEvent1: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      };
      const normalizedEvent2: NormalizedEvent = {
        type: 'orderbook',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      };

      vi.mocked(mockParser.parse).mockReturnValueOnce(normalizedEvent1).mockReturnValueOnce(normalizedEvent2);
      vi.mocked(mockPublisher.publish).mockRejectedValueOnce(new Error('First error')).mockResolvedValueOnce(undefined);

      // 1回目はエラー
      await expect(handler.handle(rawMessage1)).rejects.toThrow();

      // 2回目は成功
      await expect(handler.handle(rawMessage2)).resolves.not.toThrow();
      expect(mockPublisher.publish).toHaveBeenCalledTimes(2);
    });
  });

  describe('パーサーがエラーを投げる場合', () => {
    it('パーサーがエラーを投げた場合、エラーが伝播する', async () => {
      const rawMessage = { channel: 'ticker' };
      const parseError = new Error('Parse error');

      vi.mocked(mockParser.parse).mockImplementation(() => {
        throw parseError;
      });

      await expect(handler.handle(rawMessage)).rejects.toThrow('Parse error');
      expect(mockParser.parse).toHaveBeenCalledTimes(1);
      expect(mockPublisher.publish).not.toHaveBeenCalled();
    });
  });

  describe('複数のメッセージ処理', () => {
    it('複数のメッセージを順次処理できる', async () => {
      const rawMessage1 = { channel: 'ticker' };
      const rawMessage2 = { channel: 'orderbook' };
      const normalizedEvent1: NormalizedEvent = {
        type: 'ticker',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      };
      const normalizedEvent2: NormalizedEvent = {
        type: 'orderbook',
        exchange: 'gmo',
        symbol: 'BTC_JPY',
        ts: Date.now(),
        data: {},
      };

      vi.mocked(mockParser.parse).mockReturnValueOnce(normalizedEvent1).mockReturnValueOnce(normalizedEvent2);
      vi.mocked(mockPublisher.publish).mockResolvedValue(undefined);

      await handler.handle(rawMessage1);
      await handler.handle(rawMessage2);

      expect(mockParser.parse).toHaveBeenCalledTimes(2);
      expect(mockPublisher.publish).toHaveBeenCalledTimes(2);
      expect(mockPublisher.publish).toHaveBeenNthCalledWith(1, normalizedEvent1);
      expect(mockPublisher.publish).toHaveBeenNthCalledWith(2, normalizedEvent2);
    });
  });
});
