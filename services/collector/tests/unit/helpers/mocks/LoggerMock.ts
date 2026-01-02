import { type Mock, vi } from 'vitest';
import type { Logger } from '@/application/interfaces/Logger';

/**
 * テスト用ロガーモック
 *
 * vitest の vi.fn() を使用して、ロガーメソッドの呼び出しを記録・検証できるようにする。
 */
export class LoggerMock implements Logger {
  debug: Mock<(msg: string, meta?: object) => void> = vi.fn<(msg: string, meta?: object) => void>();
  info: Mock<(msg: string, meta?: object) => void> = vi.fn<(msg: string, meta?: object) => void>();
  warn: Mock<(msg: string, meta?: object) => void> = vi.fn<(msg: string, meta?: object) => void>();
  error: Mock<(msg: string, meta?: object) => void> = vi.fn<(msg: string, meta?: object) => void>();
  child: Mock<(bindings: object) => Logger> = vi.fn<(bindings: object) => Logger>(() => this);

  /**
   * すべてのモックをリセットする
   */
  reset(): void {
    this.debug.mockReset();
    this.info.mockReset();
    this.warn.mockReset();
    this.error.mockReset();
    this.child.mockReset();
  }
}
