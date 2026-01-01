import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Logger } from '@/application/interfaces/Logger';
import type { MetricsCollector } from '@/application/interfaces/MetricsCollector';

/**
 * メトリクス HTTP サーバー
 *
 * 責務: /metrics エンドポイントで Prometheus 形式のメトリクスを公開
 */
export class MetricsServer {
  private server: ReturnType<typeof createServer> | null = null;

  constructor(
    private readonly metricsCollector: MetricsCollector,
    private readonly port: number,
    private readonly logger: Logger
  ) {}

  /**
   * HTTP サーバーを起動
   */
  start(): void {
    this.server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (req.url === '/metrics' && req.method === 'GET') {
        try {
          const metrics = await this.metricsCollector.getMetrics();
          const registry = this.metricsCollector.getRegistry();
          res.setHeader('Content-Type', registry.contentType);
          res.statusCode = 200;
          res.end(metrics);
        } catch (error) {
          this.logger.error('Failed to get metrics', { err: error });
          res.statusCode = 500;
          res.end('Internal Server Error');
        }
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });

    this.server.listen(this.port, () => {
      this.logger.info('Metrics server started', { port: this.port });
    });
  }

  /**
   * HTTP サーバーを停止
   */
  stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
