import { LoggerMock } from '@test/unit/helpers/mocks/LoggerMock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReconnectManager } from '@/infra/reconnect/ReconnectManager';

/**
 * 単体テスト: ReconnectManager
 *
 * Infrastructure層の外部依存あり（再接続ロジックの詳細テスト）
 * - 接続成功時の動作
 * - 接続失敗時の再接続スケジューリング
 * - stop() の動作
 * - バックオフ戦略の適用
 * - エラーハンドリング
 * - 統合的な動作確認
 */
describe('ReconnectManager', () => {
  let mockConnectFn: () => Promise<void>;
  let manager: ReconnectManager;
  let loggerMock: LoggerMock;

  beforeEach(() => {
    vi.useFakeTimers();
    mockConnectFn = vi.fn();
    loggerMock = new LoggerMock();
    manager = new ReconnectManager(mockConnectFn, loggerMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('start()', () => {
    it('start() を呼ぶと接続関数が実行される', async () => {
      vi.mocked(mockConnectFn).mockResolvedValue(undefined);

      await manager.start();

      expect(mockConnectFn).toHaveBeenCalledTimes(1);
    });

    it('接続が成功すると、再接続はスケジュールされない', async () => {
      vi.mocked(mockConnectFn).mockResolvedValue(undefined);

      await manager.start();

      // タイマーが設定されていないことを確認
      expect(vi.getTimerCount()).toBe(0);
    });

    it('接続が失敗すると、再接続がスケジュールされる', async () => {
      vi.mocked(mockConnectFn).mockRejectedValue(new Error('Connection failed'));

      await manager.start();

      // 再接続タイマーが設定されていることを確認
      expect(vi.getTimerCount()).toBe(1);
    });
  });

  describe('scheduleReconnect()', () => {
    it('接続失敗後に scheduleReconnect() を呼ぶと、バックオフ遅延後に再接続が試みられる', async () => {
      vi.mocked(mockConnectFn).mockRejectedValue(new Error('Connection failed'));

      await manager.start();

      // 1秒後（BASE_DELAY）に再接続が試みられる
      expect(vi.getTimerCount()).toBe(1);
      expect(mockConnectFn).toHaveBeenCalledTimes(1);

      // タイマーを進める
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockConnectFn).toHaveBeenCalledTimes(2);
    });

    it('複数回失敗すると、指数バックオフで遅延が増加する', async () => {
      vi.mocked(mockConnectFn).mockRejectedValue(new Error('Connection failed'));

      await manager.start();
      expect(mockConnectFn).toHaveBeenCalledTimes(1);

      // 1回目の再接続（1秒後）
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockConnectFn).toHaveBeenCalledTimes(2);

      // 2回目の再接続（2秒後）
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockConnectFn).toHaveBeenCalledTimes(3);

      // 3回目の再接続（4秒後）
      await vi.advanceTimersByTimeAsync(4000);
      expect(mockConnectFn).toHaveBeenCalledTimes(4);
    });

    it('stop() 後に scheduleReconnect() を呼んでも、再接続はスケジュールされない', async () => {
      vi.mocked(mockConnectFn).mockRejectedValue(new Error('Connection failed'));

      await manager.start();
      manager.stop();

      // stop() 後は再接続がスケジュールされない
      const timerCountBefore = vi.getTimerCount();
      manager.scheduleReconnect();
      expect(vi.getTimerCount()).toBe(timerCountBefore);
    });

    it('既存のタイマーがある場合、新しいタイマーで上書きされる', async () => {
      vi.mocked(mockConnectFn).mockRejectedValue(new Error('Connection failed'));

      await manager.start();
      expect(vi.getTimerCount()).toBe(1);

      // 再度 scheduleReconnect() を呼ぶ
      manager.scheduleReconnect();

      // タイマーは1つのまま（上書きされた）
      expect(vi.getTimerCount()).toBe(1);
    });
  });

  describe('stop()', () => {
    it('stop() を呼ぶと、スケジュールされた再接続がキャンセルされる', async () => {
      vi.mocked(mockConnectFn).mockRejectedValue(new Error('Connection failed'));

      await manager.start();
      expect(vi.getTimerCount()).toBe(1);

      manager.stop();

      // タイマーがクリアされていることを確認
      expect(vi.getTimerCount()).toBe(0);
    });

    it('stop() 後は再接続が試みられない', async () => {
      vi.mocked(mockConnectFn).mockRejectedValue(new Error('Connection failed'));

      await manager.start();
      manager.stop();

      // タイマーを進めても再接続されない
      await vi.advanceTimersByTimeAsync(10000);
      expect(mockConnectFn).toHaveBeenCalledTimes(1); // start() の1回のみ
    });

    it('stop() を複数回呼んでも問題なく動作する', () => {
      manager.stop();
      manager.stop();
      manager.stop();

      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('バックオフ戦略の適用', () => {
    it('接続成功後はバックオフがリセットされ、次回失敗時は最初の遅延から始まる', async () => {
      // 1回目: 失敗
      vi.mocked(mockConnectFn).mockRejectedValueOnce(new Error('Connection failed'));
      await manager.start();
      expect(mockConnectFn).toHaveBeenCalledTimes(1);

      // 1秒後に再接続（2回目: 成功）
      vi.mocked(mockConnectFn).mockResolvedValueOnce(undefined);
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockConnectFn).toHaveBeenCalledTimes(2);
      // 成功後はタイマーがクリアされる
      expect(vi.getTimerCount()).toBe(0);

      // 3回目: 再度失敗（リセット後なので1秒後に再接続）
      vi.mocked(mockConnectFn).mockRejectedValueOnce(new Error('Connection failed'));
      manager.scheduleReconnect();
      expect(vi.getTimerCount()).toBe(1);

      // 1秒後に再接続（リセット後なので最初の遅延）
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockConnectFn).toHaveBeenCalledTimes(3);
    });

    it('MAX_DELAY に達した後も再接続が続く', async () => {
      vi.mocked(mockConnectFn).mockRejectedValue(new Error('Connection failed'));

      await manager.start();

      // MAX_DELAY (30000ms) に達するまで再接続を繰り返す
      // 1秒 → 2秒 → 4秒 → 8秒 → 16秒 → 30秒（上限）
      // 実装と同じ計算式を使用（BackoffStrategy と一致）
      const BASE_DELAY = 1000;
      const MAX_DELAY = 30000;

      for (let i = 0; i < 10; i++) {
        const delay = Math.min(BASE_DELAY * 2 ** i, MAX_DELAY);
        await vi.advanceTimersByTimeAsync(delay);
      }

      // 10回以上再接続が試みられている
      expect(mockConnectFn).toHaveBeenCalledTimes(11); // start() + 10回の再接続
    });
  });

  describe('エラーハンドリング', () => {
    it('接続関数がエラーを投げても、再接続がスケジュールされる', async () => {
      const error = new Error('Network error');
      vi.mocked(mockConnectFn).mockRejectedValue(error);

      await manager.start();

      expect(loggerMock.error).toHaveBeenCalledWith('Reconnect attempt failed', { err: error });
      expect(vi.getTimerCount()).toBe(1);
    });

    it('接続関数が複数回エラーを投げても、再接続が続く', async () => {
      vi.mocked(mockConnectFn).mockRejectedValue(new Error('Connection failed'));

      await manager.start();

      // 数回再接続を試みる
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(1000 * 2 ** i);
      }

      expect(mockConnectFn).toHaveBeenCalledTimes(6); // start() + 5回の再接続
    });
  });

  describe('統合的な動作確認', () => {
    it('接続成功→失敗→再接続成功→失敗のシナリオ', async () => {
      // 1回目: 成功
      vi.mocked(mockConnectFn).mockResolvedValueOnce(undefined);
      await manager.start();
      expect(mockConnectFn).toHaveBeenCalledTimes(1);

      // 2回目: 失敗（手動で再接続をスケジュール）
      vi.mocked(mockConnectFn).mockRejectedValueOnce(new Error('Connection failed'));
      manager.scheduleReconnect();
      expect(vi.getTimerCount()).toBe(1);

      // 1秒後に再接続
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockConnectFn).toHaveBeenCalledTimes(2);

      // 3回目: 成功（バックオフがリセット）
      vi.mocked(mockConnectFn).mockResolvedValueOnce(undefined);
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockConnectFn).toHaveBeenCalledTimes(3);

      // 4回目: 再度失敗（リセット後なので1秒後）
      vi.mocked(mockConnectFn).mockRejectedValueOnce(new Error('Connection failed'));
      manager.scheduleReconnect();
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockConnectFn).toHaveBeenCalledTimes(4);
    });

    it('stop() 後に start() を呼ぶと、再接続管理が再開される', async () => {
      vi.mocked(mockConnectFn).mockRejectedValue(new Error('Connection failed'));

      await manager.start();
      manager.stop();
      expect(vi.getTimerCount()).toBe(0);

      // 再開
      await manager.start();
      expect(mockConnectFn).toHaveBeenCalledTimes(2); // stop前の1回 + start()の1回
      expect(vi.getTimerCount()).toBe(1); // 再接続タイマーが設定される
    });
  });
});
