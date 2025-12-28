import type { Logger } from '@/application/interfaces/Logger';
import { PinoLogger } from './PinoLogger';

/**
 * ロガーファクトリー
 *
 * 環境変数に基づいてロガーインスタンスを生成する。
 * シングルトンパターンで実装し、アプリケーション全体で同じロガーインスタンスを使用する。
 */
class LoggerFactory {
  private static instance: Logger | null = null;

  /**
   * ロガーインスタンスを取得または作成
   *
   * 環境変数:
   * - `LOG_LEVEL`: ログレベル（debug, info, warn, error）。デフォルトは `info`
   * - `NODE_ENV`: 環境（production の場合は JSON 形式、それ以外は pretty 形式）
   *
   * @returns ロガーインスタンス
   */
  static create(): Logger {
    if (LoggerFactory.instance === null) {
      const level = process.env.LOG_LEVEL;
      const isProduction = process.env.NODE_ENV === 'production';
      const pretty = !isProduction;

      LoggerFactory.instance = new PinoLogger({ level, pretty });
    }

    return LoggerFactory.instance;
  }

  /**
   * ロガーインスタンスをリセット（主にテスト用）
   */
  static reset(): void {
    LoggerFactory.instance = null;
  }
}

export { LoggerFactory };
