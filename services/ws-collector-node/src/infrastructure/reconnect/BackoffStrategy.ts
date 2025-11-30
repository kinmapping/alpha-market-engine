/**
 * インフラ層: 指数バックオフ戦略の実装
 *
 * 再接続時の遅延を指数関数的に増加させる戦略を実装する。
 */
export class BackoffStrategy {
  private attempt = 0;
  private readonly BASE_DELAY = 1000; // 1秒
  private readonly MAX_DELAY = 30000; // 30秒

  /**
   * 次の再接続までの遅延時間（ミリ秒）を取得する。
   * @returns 遅延時間（ミリ秒）
   */
  getNextDelay(): number {
    const delay = Math.min(this.BASE_DELAY * 2 ** this.attempt, this.MAX_DELAY);
    this.attempt += 1;
    return delay;
  }

  /**
   * バックオフカウンターをリセットする。
   * 接続成功時に呼び出される。
   */
  reset(): void {
    this.attempt = 0;
  }
}
