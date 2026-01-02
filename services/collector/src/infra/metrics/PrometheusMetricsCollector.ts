import { Counter, Gauge, Registry } from 'prom-client';
import type { MetricsCollector } from '@/application/interfaces/MetricsCollector';

/**
 * Prometheus メトリクスコレクター実装
 * テストで別レジストリを使用するため、シングルトンパターンの実装にはしていない。
 *
 * 責務: prom-client を使用してメトリクスを収集・保持
 */
export class PrometheusMetricsCollector implements MetricsCollector {
  private readonly register: Registry;
  private readonly receivedCounter: Counter;
  private readonly publishedCounter: Counter;
  private readonly errorCounter: Counter;
  private readonly reconnectGauge: Gauge;

  constructor() {
    this.register = new Registry();

    // 受信メッセージ数カウンター
    this.receivedCounter = new Counter({
      name: 'collector_messages_received_total',
      help: 'Total number of messages received from WebSocket',
      labelNames: ['channel', 'symbol'],
      registers: [this.register],
    });

    // 配信メッセージ数カウンター
    this.publishedCounter = new Counter({
      name: 'collector_messages_published_total',
      help: 'Total number of messages published to Redis Stream',
      labelNames: ['stream', 'symbol'],
      registers: [this.register],
    });

    // エラー数カウンター
    this.errorCounter = new Counter({
      name: 'collector_errors_total',
      help: 'Total number of errors',
      labelNames: ['error_type'],
      registers: [this.register],
    });

    // 再接続回数ゲージ
    this.reconnectGauge = new Gauge({
      name: 'collector_reconnects_total',
      help: 'Total number of reconnections',
      registers: [this.register],
    });
  }

  incrementReceived(channel: string, symbol: string): void {
    this.receivedCounter.inc({ channel, symbol });
  }

  incrementPublished(stream: string, symbol: string): void {
    this.publishedCounter.inc({ stream, symbol });
  }

  incrementError(errorType: string): void {
    this.errorCounter.inc({ error_type: errorType });
  }

  incrementReconnect(): void {
    this.reconnectGauge.inc();
  }

  async getMetrics(): Promise<string> {
    return await this.register.metrics();
  }

  getRegistry() {
    // Registry は MetricsRegistry インターフェースを満たす（contentType プロパティを持つ）
    return this.register;
  }
}
