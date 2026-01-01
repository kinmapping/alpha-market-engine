import type { Logger } from '@/application/interfaces/Logger';
import type { MarketDataAdapter } from '@/application/interfaces/MarketDataAdapter';
import type { MetricsCollector } from '@/application/interfaces/MetricsCollector';
import type { PublishStreamUsecase } from '@/application/usecases/PublishStreamUsecase';
import type { GmoRawMessage } from '@/infra/adapters/gmo/types/GmoRawMessage';
import { LoggerFactory } from '@/infra/logger/LoggerFactory';
import { ReconnectManager } from '@/infra/reconnect/ReconnectManager';

/**
 * プレゼンテーション層: WebSocket 接続ハンドラ
 *
 * 責務: WS接続の維持・メッセージ受信
 * - WebSocket 接続の維持
 * - 再接続管理
 * - メッセージを usecase に委譲
 */
export class WebSocketHandler {
  readonly reconnectManager: ReconnectManager;
  private readonly logger: Logger;

  constructor(
    private readonly adapter: MarketDataAdapter & {
      parseMessage?: (data: string | ArrayBuffer | Blob) => GmoRawMessage | null;
    },
    private readonly usecase: PublishStreamUsecase,
    logger?: Logger,
    private readonly metricsCollector?: MetricsCollector
  ) {
    this.logger = logger ?? LoggerFactory.create();
    // ReconnectManager に再接続時のコールバック（adapter.connect メソッド）を渡す
    this.reconnectManager = new ReconnectManager(() => this.adapter.connect(), this.logger, this.metricsCollector);
  }

  /**
   * WebSocket 接続を開始する。
   * ReconnectManager を通じて接続を試み、失敗時は自動的に再接続をスケジュールする。
   */
  async start(): Promise<void> {
    await this.reconnectManager.start();
  }

  /**
   * WebSocket 接続を切断し、再接続のスケジュールも停止する。
   */
  disconnect(): void {
    this.reconnectManager.stop();
    this.adapter.disconnect();
  }

  /**
   * メッセージを受信して処理する。
   * @param data WebSocket から受信した生データ（string | ArrayBuffer | Blob）
   */
  async handleMessage(data: string | ArrayBuffer | Blob): Promise<void> {
    const rawMessage = this.parseMessage(data);
    if (!rawMessage) {
      return;
    }

    if (this.isErrorMessage(rawMessage)) {
      this.handleErrorMessage(rawMessage as { error: string });
      return;
    }

    if (!this.hasChannel(rawMessage)) {
      this.logger.warn('message missing channel', { rawMessage });
      return;
    }

    this.recordReceivedMetrics(rawMessage);
    await this.usecase.execute(rawMessage);
  }

  /**
   * メッセージをパースする
   * @param data 生データ
   * @returns パースされたメッセージ、パースできない場合は null
   */
  private parseMessage(data: string | ArrayBuffer | Blob): unknown | null {
    if (this.adapter.parseMessage) {
      return this.adapter.parseMessage(data);
    }
    return data;
  }

  /**
   * エラーメッセージかどうかを判定
   * @param message メッセージ
   * @returns エラーメッセージの場合 true
   */
  private isErrorMessage(message: unknown): boolean {
    return typeof message === 'object' && message !== null && 'error' in message && typeof message.error === 'string';
  }

  /**
   * エラーメッセージを処理する
   * @param message エラーメッセージ
   */
  private handleErrorMessage(message: { error: string }): void {
    const errorMsg = message.error;
    this.logger.error('API error', { error: errorMsg });

    // メトリクス収集: API エラー
    if (this.metricsCollector) {
      this.metricsCollector.incrementError('api_error');
    }

    // ERR-5003 (Request too many) の場合は、購読リクエストの送信間隔が不十分
    if (errorMsg.includes('ERR-5003')) {
      this.logger.warn('Rate limit error detected. Consider increasing subscription interval.', {
        error: errorMsg,
      });
    }
  }

  /**
   * メッセージに channel プロパティがあるか判定
   * @param message メッセージ
   * @returns channel がある場合 true
   */
  private hasChannel(message: unknown): boolean {
    return typeof message === 'object' && message !== null && 'channel' in message;
  }

  /**
   * 受信メッセージのメトリクスを記録
   * @param message メッセージ
   */
  private recordReceivedMetrics(message: unknown): void {
    if (
      !this.metricsCollector ||
      typeof message !== 'object' ||
      message === null ||
      !('channel' in message) ||
      !('symbol' in message)
    ) {
      return;
    }

    this.metricsCollector.incrementReceived(String(message.channel), String(message.symbol));
  }
}
