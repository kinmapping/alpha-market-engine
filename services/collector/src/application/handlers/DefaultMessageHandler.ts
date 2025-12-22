import type { EventPublisher } from '@/application/interfaces/EventPublisher';
import type { MessageHandler } from '@/application/interfaces/MessageHandler';
import type { MessageParser } from '@/application/interfaces/MessageParser';

/**
 * MessageHandler の実装。
 * パーサーとパブリッシャーを組み合わせてメッセージ処理のフローを実現する。
 */
export class DefaultMessageHandler implements MessageHandler {
  constructor(
    private readonly parser: MessageParser,
    private readonly publisher: EventPublisher
  ) {}

  async handle(rawMessage: unknown): Promise<void> {
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
