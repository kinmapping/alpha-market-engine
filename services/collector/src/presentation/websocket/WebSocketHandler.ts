import type { Logger } from '@/application/interfaces/Logger';
import type { MarketDataAdapter } from '@/application/interfaces/MarketDataAdapter';
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
    logger?: Logger
  ) {
    this.logger = logger ?? LoggerFactory.create();
    // ReconnectManager に再接続時のコールバック（adapter.connect メソッド）を渡す
    this.reconnectManager = new ReconnectManager(() => this.adapter.connect(), this.logger);
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
    // アダプタが parseMessage メソッドを持っている場合、それを使用
    let rawMessage: unknown = data;
    if (this.adapter.parseMessage) {
      rawMessage = this.adapter.parseMessage(data);
      if (!rawMessage) {
        return;
      }

      // エラーメッセージの場合は早期 return（エラーメッセージには channel がない）
      if (
        typeof rawMessage === 'object' &&
        rawMessage !== null &&
        'error' in rawMessage &&
        typeof rawMessage.error === 'string'
      ) {
        const errorMsg = rawMessage.error;
        this.logger.error('API error', { error: errorMsg });

        // ERR-5003 (Request too many) の場合は、購読リクエストの送信間隔が不十分
        if (errorMsg.includes('ERR-5003')) {
          this.logger.warn('Rate limit error detected. Consider increasing subscription interval.', {
            error: errorMsg,
          });
        }
        return;
      }

      // channel がないメッセージは無視
      if (typeof rawMessage === 'object' && rawMessage !== null && !('channel' in rawMessage)) {
        this.logger.warn('message missing channel', { rawMessage });
        return;
      }

      // DEBUG: 受信したメッセージのチャンネルをログ出力(不要になったためコメントアウト、メトリクス集計処理に委譲する)
      // if (typeof rawMessage === 'object' && rawMessage !== null && 'channel' in rawMessage && 'symbol' in rawMessage) {
      //   this.logger.debug('received message', {
      //     channel: String(rawMessage.channel),
      //     symbol: String(rawMessage.symbol),
      //   });
      // }
    }

    // ユースケースに処理を委譲（正規化→配信）
    await this.usecase.execute(rawMessage);
  }
}
