import type { NormalizedEvent } from '@/domain/types';

/**
 * アプリケーション層: メッセージ処理のオーケストレーション
 *
 * 責務: 「何をするか」を決める（実装の詳細は持たない）。
 * WebSocket から受信した RawMessage を正規化し、Redis に配信するフローを組み立てる。
 *
 * 注意: 正規化や Redis 書き込みの実装は持たず、インフラ層のコンポーネントを組み合わせるだけ。
 */
export interface MessageHandler {
  /**
   * メッセージを処理する（正規化→配信のフローを実行）。
   * @param rawMessage 取引所固有の生メッセージ
   */
  handle(rawMessage: unknown): Promise<void>;
}

/**
 * メッセージパーサーのインターフェイス（インフラ層で実装される）。
 */
export interface MessageParser {
  /**
   * 生メッセージを正規化されたイベントに変換する。
   * @param rawMessage 取引所固有の生メッセージ
   * @returns 正規化されたイベント。変換できない場合は null
   */
  parse(rawMessage: unknown): NormalizedEvent | null;
}

/**
 * イベントパブリッシャーのインターフェイス（インフラ層で実装される）。
 */
export interface EventPublisher {
  /**
   * 正規化されたイベントを配信する。
   * @param event 正規化されたイベント
   */
  publish(event: NormalizedEvent): Promise<void>;
}

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
