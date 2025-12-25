import type { MessageParser } from '@/application/interfaces/MessageParser';
import type { StreamPublisher } from '@/domain/repositories/StreamPublisher';

/**
 * アプリケーション層: ストリーム配信ユースケース
 *
 * 責務: 受信データを検証し、Stream へ配信する司令塔
 */
export class PublishStreamUsecase {
  constructor(
    private readonly parser: MessageParser,
    private readonly publisher: StreamPublisher
  ) {}

  async execute(rawMessage: unknown): Promise<void> {
    // 1. 正規化（インフラ層のパーサーを使用）
    const normalized = this.parser.parse(rawMessage);
    // 2. 正規化に失敗した場合は何もしない
    if (!normalized) {
      return;
    }

    // 3. 配信（インフラ層のパブリッシャーを使用）
    await this.publisher.publish(normalized);
  }
}
