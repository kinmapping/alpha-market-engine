import { beforeEach, describe, expect, it } from 'vitest';
import { BackoffStrategy } from '@/infra/reconnect/BackoffStrategy';

/**
 * 単体テスト: BackoffStrategy
 *
 * 優先度1: Infrastructure層の純粋関数
 * - 指数バックオフの計算ロジック
 * - MAX_DELAY の上限チェック
 * - reset() の動作確認
 */
describe('BackoffStrategy', () => {
  let strategy: BackoffStrategy;

  beforeEach(() => {
    strategy = new BackoffStrategy();
  });

  describe('getNextDelay()', () => {
    it('初回は BASE_DELAY (1000ms) を返す', () => {
      const delay = strategy.getNextDelay();
      expect(delay).toBe(1000);
    });

    it('2回目は BASE_DELAY * 2 (2000ms) を返す', () => {
      strategy.getNextDelay(); // 1回目
      const delay = strategy.getNextDelay(); // 2回目
      expect(delay).toBe(2000);
    });

    it('3回目は BASE_DELAY * 4 (4000ms) を返す', () => {
      strategy.getNextDelay(); // 1回目
      strategy.getNextDelay(); // 2回目
      const delay = strategy.getNextDelay(); // 3回目
      expect(delay).toBe(4000);
    });

    it('指数関数的に遅延が増加する', () => {
      const delays: number[] = [];
      for (let i = 0; i < 5; i++) {
        delays.push(strategy.getNextDelay());
      }

      expect(delays[0]).toBe(1000); // 2^0 * 1000
      expect(delays[1]).toBe(2000); // 2^1 * 1000
      expect(delays[2]).toBe(4000); // 2^2 * 1000
      expect(delays[3]).toBe(8000); // 2^3 * 1000
      expect(delays[4]).toBe(16000); // 2^4 * 1000
    });

    it('MAX_DELAY (30000ms) を超えない', () => {
      // MAX_DELAY に達するまで呼び出す
      // 2^4 * 1000 = 16000 < 30000
      // 2^5 * 1000 = 32000 > 30000 なので、5回目で上限に達する
      let delay = 0;
      for (let i = 0; i < 10; i++) {
        delay = strategy.getNextDelay();
      }

      expect(delay).toBe(30000); // MAX_DELAY
    });

    it('MAX_DELAY に達した後も MAX_DELAY を返し続ける', () => {
      // MAX_DELAY に達するまで呼び出す
      for (let i = 0; i < 10; i++) {
        strategy.getNextDelay();
      }

      // さらに数回呼び出しても MAX_DELAY を返し続ける
      for (let i = 0; i < 5; i++) {
        const delay = strategy.getNextDelay();
        expect(delay).toBe(30000);
      }
    });

    it('遅延時間は常に正の値である', () => {
      for (let i = 0; i < 10; i++) {
        const delay = strategy.getNextDelay();
        expect(delay).toBeGreaterThan(0);
      }
    });
  });

  describe('reset()', () => {
    it('reset() 後に getNextDelay() は BASE_DELAY を返す', () => {
      strategy.getNextDelay(); // 1回目: 1000ms
      strategy.getNextDelay(); // 2回目: 2000ms
      strategy.getNextDelay(); // 3回目: 4000ms

      strategy.reset();

      const delay = strategy.getNextDelay();
      expect(delay).toBe(1000); // BASE_DELAY に戻る
    });

    it('reset() 後は指数バックオフが最初から再開される', () => {
      // 数回呼び出して遅延を増やす
      strategy.getNextDelay(); // 1000ms
      strategy.getNextDelay(); // 2000ms
      strategy.getNextDelay(); // 4000ms

      strategy.reset();

      // reset 後は最初から
      expect(strategy.getNextDelay()).toBe(1000);
      expect(strategy.getNextDelay()).toBe(2000);
      expect(strategy.getNextDelay()).toBe(4000);
    });

    it('複数回 reset() を呼び出しても問題なく動作する', () => {
      strategy.getNextDelay();
      strategy.reset();
      strategy.getNextDelay();
      strategy.reset();
      strategy.getNextDelay();

      const delay = strategy.getNextDelay();
      expect(delay).toBe(2000); // reset 後の2回目
    });
  });

  describe('統合的な動作確認', () => {
    it('接続成功→失敗→再接続成功のシナリオ', () => {
      // 初回接続成功
      const delay1 = strategy.getNextDelay(); // 1000ms
      strategy.reset(); // 接続成功

      // 接続失敗、再接続試行
      const delay2 = strategy.getNextDelay(); // 1000ms（リセット後）
      const delay3 = strategy.getNextDelay(); // 2000ms
      const delay4 = strategy.getNextDelay(); // 4000ms

      // 再接続成功
      strategy.reset();

      // 再度接続失敗した場合
      const delay5 = strategy.getNextDelay(); // 1000ms（リセット後）

      expect(delay1).toBe(1000);
      expect(delay2).toBe(1000);
      expect(delay3).toBe(2000);
      expect(delay4).toBe(4000);
      expect(delay5).toBe(1000);
    });
  });
});
