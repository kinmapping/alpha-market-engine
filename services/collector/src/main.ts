import 'dotenv/config';
import process from 'node:process';
import { PublishStreamUsecase } from '@/application/usecases/PublishStreamUsecase';
import { GmoAdapter } from '@/infra/adapters/gmo/GmoAdapter';
import { GmoMessageParser } from '@/infra/adapters/gmo/GmoMessageParser';
import { StreamRepository } from '@/infra/redis/StreamRepository';
import { WebSocketHandler } from '@/presentation/websocket/WebSocketHandler';

/**
 * 必須環境変数を取得する。未設定の場合はエラーを投げる。
 * @param key 環境変数名
 * @returns 環境変数の値
 * @throws {Error} 環境変数が未設定の場合
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * エントリーポイント: アプリケーションの起動処理、依存関係の注入、シグナルハンドリング
 *
 * 責務:
 * - `.env` 読み込みと環境変数の検証
 * - コンポーネントの生成と初期化
 * - シグナルハンドリング
 *
 * 注意: WebSocket の挙動や正規化ロジックは main.ts から完全に追い出し、ただ「配線するだけ」にする。
 */
async function bootstrap(): Promise<void> {
  // `.env` から起動時の基本パラメータを取得。必須項目なので未設定ならエラー。
  const EXCHANGE_NAME = requireEnv('EXCHANGE_NAME');
  const WS_PUBLIC_URL = requireEnv('WS_PUBLIC_URL');
  const SYMBOLS = requireEnv('SYMBOLS');
  const REDIS_URL = requireEnv('REDIS_URL');

  // 現状は GMO 固定実装なので他所が指定されたら早期に落として気付けるようにする。
  if (EXCHANGE_NAME !== 'gmo') {
    throw new Error(`Unsupported exchange: ${EXCHANGE_NAME}`);
  }

  // インフラ層: Stream Repository を生成
  const publisher = new StreamRepository(REDIS_URL);

  // アプリケーション層: ストリーム配信ユースケースを生成（正規化→配信のフローを組み立てる）
  const parser = new GmoMessageParser();
  const usecase = new PublishStreamUsecase(parser, publisher);

  // インフラ層: SYMBOLS (カンマ区切り) から複数ペア対応のハンドラを生成
  const symbols = SYMBOLS.split(',')
    .map((symbol) => symbol.trim())
    .filter(Boolean);

  const handlers = symbols.map((symbol) => {
    // 1. GmoAdapter を先に作成（コールバックは後から設定）
    const adapter = new GmoAdapter(symbol, WS_PUBLIC_URL);

    // 2. WebSocketHandler を作成
    const handler = new WebSocketHandler(adapter, usecase);

    // 3. コールバックを設定（handler が作成済みなので安全に参照できる）
    adapter.setOnMessage(async (data) => {
      await handler.handleMessage(data);
    });

    adapter.setOnClose(() => {
      handler.reconnectManager.scheduleReconnect();
    });

    adapter.setOnError((event) => {
      console.error(`[main] socket error for ${symbol}:`, event);
      handler.reconnectManager.scheduleReconnect();
    });

    return handler;
  });

  // すべてのハンドラを並列で起動し、WebSocket 接続を張る。
  await Promise.all(handlers.map((handler) => handler.start()));

  const shutdown = async () => {
    console.log('Shutting down collector...');
    // SIGINT/SIGTERM で全ハンドラを切断し Redis クライアントも閉じる。
    for (const handler of handlers) {
      handler.disconnect();
    }
    await publisher.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap collector:', error);
  process.exit(1);
});
