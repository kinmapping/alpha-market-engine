import type { Logger } from '@/application/interfaces/Logger';
import type { MetricsCollector } from '@/application/interfaces/MetricsCollector';
import { LoggerFactory } from '@/infra/logger/LoggerFactory';
import { BackoffStrategy } from '@/infra/reconnect/BackoffStrategy';

/**
 * インフラ層: 再接続スケジューラ（connect 関数を受け取って再試行）
 *
 * 責務: 再接続のスケジュール管理。接続関数を受け取り、失敗時に自動的に再接続を試みる。
 */
export class ReconnectManager {
  private readonly backoff = new BackoffStrategy();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;
  private readonly logger: Logger;

  /**
   * @param connectFn 再接続時に実行する接続関数
   * @param logger ロガー（オプショナル、未指定の場合は LoggerFactory から取得）
   * @param metricsCollector メトリクスコレクター（オプショナル）
   */
  constructor(
    private readonly connectFn: () => Promise<void>,
    logger?: Logger,
    private readonly metricsCollector?: MetricsCollector
  ) {
    this.logger = logger ?? LoggerFactory.create();
  }

  /**
   * 再接続管理を開始する。
   */
  async start(): Promise<void> {
    this.stopped = false;
    await this.safeConnect();
  }

  /**
   * 再接続をスケジュールする。
   * 既に停止されている場合は何もしない。
   */
  scheduleReconnect(): void {
    if (this.stopped) {
      return;
    }
    const delay = this.backoff.getNextDelay();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = setTimeout(() => {
      void this.safeConnect();
    }, delay);
  }

  /**
   * 再接続管理を停止する。
   */
  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 安全に接続を試みる。
   * 成功時はバックオフをリセットし、失敗時は再接続をスケジュールする。
   */
  private async safeConnect(): Promise<void> {
    try {
      await this.connectFn();
      this.backoff.reset();
    } catch (error) {
      this.logger.error('Reconnect attempt failed', { err: error });

      // メトリクス収集: 再接続回数
      if (this.metricsCollector) {
        this.metricsCollector.incrementReconnect();
      }

      this.scheduleReconnect();
    }
  }
}
