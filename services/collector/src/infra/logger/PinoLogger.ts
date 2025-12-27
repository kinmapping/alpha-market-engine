import pino from 'pino';
import type { Logger } from '@/application/interfaces/Logger';

/**
 * pino を使用したロガー実装
 *
 * 環境変数 `LOG_LEVEL` でログレベルを制御。
 * 開発環境では `pino-pretty` を使用して人間可読形式で出力。
 * 本番環境では JSON 形式で出力。
 */
export class PinoLogger implements Logger {
  private readonly pinoLogger: pino.Logger;

  constructor(options?: { level?: string; pretty?: boolean }) {
    const level = options?.level ?? process.env.LOG_LEVEL;
    const isDevelopment = process.env.NODE_ENV !== 'production';

    // 開発環境では pino-pretty を使用（pretty オプションが明示的に false でない場合）
    const usePretty = options?.pretty ?? isDevelopment;

    if (usePretty) {
      // 開発環境: pino-pretty を使用して人間可読形式で出力
      this.pinoLogger = pino({
        level,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        },
      });
    } else {
      // 本番環境: JSON 形式で出力
      this.pinoLogger = pino({
        level,
      });
    }
  }

  debug(msg: string, meta?: object): void {
    if (meta) {
      this.pinoLogger.debug(meta, msg);
    } else {
      this.pinoLogger.debug({}, msg);
    }
  }

  info(msg: string, meta?: object): void {
    if (meta) {
      this.pinoLogger.info(meta, msg);
    } else {
      this.pinoLogger.info({}, msg);
    }
  }

  warn(msg: string, meta?: object): void {
    if (meta) {
      this.pinoLogger.warn(meta, msg);
    } else {
      this.pinoLogger.warn({}, msg);
    }
  }

  error(msg: string, meta?: object): void {
    if (meta) {
      this.pinoLogger.error(meta, msg);
    } else {
      this.pinoLogger.error({}, msg);
    }
  }

  child(bindings: object): Logger {
    const childLogger = this.pinoLogger.child(bindings);
    return new PinoLoggerWrapper(childLogger);
  }
}

/**
 * pino の子ロガーをラップするクラス
 * PinoLogger.child() で作成された子ロガーを Logger インターフェースとして扱うため
 */
class PinoLoggerWrapper implements Logger {
  constructor(private readonly pinoLogger: pino.Logger) {}

  debug(msg: string, meta?: object): void {
    if (meta) {
      this.pinoLogger.debug(meta, msg);
    } else {
      this.pinoLogger.debug({}, msg);
    }
  }

  info(msg: string, meta?: object): void {
    if (meta) {
      this.pinoLogger.info(meta, msg);
    } else {
      this.pinoLogger.info({}, msg);
    }
  }

  warn(msg: string, meta?: object): void {
    if (meta) {
      this.pinoLogger.warn(meta, msg);
    } else {
      this.pinoLogger.warn({}, msg);
    }
  }

  error(msg: string, meta?: object): void {
    if (meta) {
      this.pinoLogger.error(meta, msg);
    } else {
      this.pinoLogger.error({}, msg);
    }
  }

  child(bindings: object): Logger {
    const childLogger = this.pinoLogger.child(bindings);
    return new PinoLoggerWrapper(childLogger);
  }
}
