# collector 設計

Node.js で実装する WebSocket データコレクター。取引所の WebSocket API からリアルタイムで市場データ（ticker/orderbook/trade）を取得し、正規化して Redis Stream に配信する。

## 目次

1. [責務と基本方針](#責務と基本方針)
2. [技術スタック](#技術スタック)
3. [アーキテクチャ](#アーキテクチャ)
4. [コンポーネント設計](#コンポーネント設計)
5. [再接続・エラーハンドリング](#再接続エラーハンドリング)
6. [メッセージ正規化](#メッセージ正規化)
7. [Redis Stream への配信](#redis-stream-への配信)
8. [プロジェクト構成](#プロジェクト構成)
9. [参考資料](#参考資料)

---

## 責務と基本方針

### 責務

collector は以下の責務を持つ:

- **WebSocket 接続管理**: 取引所の Public WebSocket API に接続し、ticker/orderbook/trade を購読
- **データ正規化**: 取引所ごとに異なるメッセージ形式を統一フォーマットに変換
- **Redis Stream 配信**: 正規化されたデータを Redis Stream に配信
- **再接続・欠損検知**: 接続切断時の自動再接続とデータ欠損の検知・通知

### 基本方針

- **低遅延・高スループット**: Node.js の非同期処理を活用し、高頻度のイベントを処理
- **堅牢性**: 再接続、エラーハンドリング、データ整合性を重視
- **拡張性**: 取引所追加が容易なアダプターパターンを採用
- **観測性**: ログとメトリクスで動作状況を可視化

---

## 技術スタック

### Node.js

- **Node.js v24 以上（LTS）**: フラグなしで WebSocket が使える（ブラウザと同様の API）
- **TypeScript**: 型安全性と開発体験の向上

### WebSocket ライブラリ

- **Node.js 標準 WebSocket**: クライアント接続用（Node.js v22+）
- **ws パッケージ**: サーバー用途や追加機能が必要な場合（今回は使用しない）

### Redis クライアント

- **ioredis**: Redis Stream の操作に最適

### その他

- **dotenv**: 環境変数管理
- **winston / pino**: 構造化ログ
- **zod**: ランタイム型検証

---

## アーキテクチャ

### 全体構成

```
┌─────────────────┐
│  GMO WebSocket  │
│   (Public API)  │
└────────┬────────┘
         │ WebSocket
         │ (ticker/orderbook/trade)
         ▼
┌─────────────────┐
│ ws-collector-   │
│     node        │
│                 │
│  ┌───────────┐  │
│  │ Adapter   │  │ 正規化
│  │ (GMO)     │  │
│  └─────┬─────┘  │
│        │        │
│  ┌─────▼─────┐  │
│  │ Publisher │  │
│  │ (Redis)   │  │
│  └─────┬─────┘  │
└────────┼────────┘
         │
         │ Redis Stream
         ▼
┌─────────────────┐
│     Redis       │
│                 │
│  md:trade       │
│  md:orderbook   │
│  md:ticker      │
└─────────────────┘
```

### データフロー

1. **接続確立**: GMO コインの Public WebSocket API に接続
2. **購読**: ticker/orderbook/trade チャンネルを購読
3. **受信**: WebSocket からメッセージを受信
4. **正規化**: 取引所固有の形式を統一フォーマットに変換
5. **配信**: Redis Stream に正規化されたデータを配信
6. **再接続**: 切断時は自動再接続とスナップショット再取得

---

## コンポーネント設計

### main.ts

エントリーポイント。アダプターを初期化し、WebSocket 接続を管理する。

<!-- ```typescript
import { GMOAdapter } from './adapters/gmo';
import { RedisPublisher } from './redis/publisher';
import { ReconnectManager } from './reconnect/manager';

async function main() {
  const exchange = process.env.EXCHANGE_NAME || 'gmo';
  const symbols = (process.env.SYMBOLS || 'BTC_JPY').split(',');
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379/0';

  const publisher = new RedisPublisher(redisUrl);
  const adapter = new GMOAdapter(publisher);
  const reconnectManager = new ReconnectManager(adapter);

  // 各シンボルに対して WebSocket 接続を確立
  for (const symbol of symbols) {
    await reconnectManager.connect(symbol);
  }

  // シグナルハンドリング
  process.on('SIGTERM', () => {
    reconnectManager.disconnectAll();
    process.exit(0);
  });
}

main().catch(console.error);
``` -->

### adapters/gmo.ts

GMO コインの WebSocket API を処理するアダプター。

```typescript
import WebSocket from 'ws';
import { NormalizedEvent, EventPublisher } from '../types';
import { ReconnectManager } from '../reconnect/manager';

export class GMOAdapter {
  private ws: WebSocket | null = null;
  private wsUrl = 'wss://api.coin.z.com/ws/public/v1';
  private reconnectManager: ReconnectManager;

  constructor(
    private publisher: EventPublisher,
    reconnectManager?: ReconnectManager
  ) {
    this.reconnectManager = reconnectManager || new ReconnectManager(this);
  }

  async connect(symbol: string): Promise<void> {
    const url = `${this.wsUrl}`;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      this.subscribe(symbol);
    });

    this.ws.on('message', (data: Buffer) => {
      this.handleMessage(data, symbol);
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.reconnectManager.scheduleReconnect(symbol);
    });

    this.ws.on('close', () => {
      console.log('WebSocket closed');
      this.reconnectManager.scheduleReconnect(symbol);
    });
  }

  private subscribe(symbol: string): void {
    // GMO コインの購読メッセージ
    const subscribeMessages = [
      {
        command: 'subscribe',
        channel: 'ticker',
        symbol: symbol
      },
      {
        command: 'subscribe',
        channel: 'orderbooks',
        symbol: symbol
      },
      {
        command: 'subscribe',
        channel: 'trades',
        symbol: symbol
      }
    ];

    for (const msg of subscribeMessages) {
      this.ws?.send(JSON.stringify(msg));
    }
  }

  private handleMessage(data: Buffer, symbol: string): void {
    try {
      const message = JSON.parse(data.toString());
      const normalized = this.normalize(message, symbol);
      if (normalized) {
        this.publisher.publish(normalized);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }

  private normalize(message: any, symbol: string): NormalizedEvent | null {
    // GMO コインのメッセージ形式を正規化
    // 実装は後述の「メッセージ正規化」セクションを参照
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
```

### redis/publisher.ts

Redis Stream への配信を担当。

```typescript
import Redis from 'ioredis';
import { NormalizedEvent } from '../types';

export class RedisPublisher {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async publish(event: NormalizedEvent): Promise<void> {
    const streamName = this.getStreamName(event.type);
    const message = {
      exchange: event.exchange,
      symbol: event.symbol,
      ts: event.ts.toString(),
      data: JSON.stringify(event.data)
    };

    await this.redis.xadd(streamName, '*', ...Object.entries(message).flat());
  }

  private getStreamName(type: string): string {
    const streamMap: Record<string, string> = {
      trade: 'md:trade',
      orderbook: 'md:orderbook',
      ticker: 'md:ticker'
    };
    return streamMap[type] || `md:${type}`;
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
```

### reconnect/manager.ts

再接続ロジックを管理。

```typescript
import { BackoffStrategy } from './backoff';

export class ReconnectManager {
  private backoff = new BackoffStrategy();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(private adapter: any) {}

  scheduleReconnect(symbol: string): void {
    const delay = this.backoff.getNextDelay();

    if (this.reconnectTimers.has(symbol)) {
      clearTimeout(this.reconnectTimers.get(symbol)!);
    }

    const timer = setTimeout(async () => {
      try {
        await this.adapter.connect(symbol);
        this.backoff.reset();
      } catch (error) {
        console.error(`Reconnect failed for ${symbol}:`, error);
        this.scheduleReconnect(symbol);
      }
    }, delay);

    this.reconnectTimers.set(symbol, timer);
  }

  disconnectAll(): void {
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
    this.adapter.disconnect();
  }
}
```

### reconnect/backoff.ts

指数バックオフ戦略。

```typescript
export class BackoffStrategy {
  private attempt = 0;
  private readonly baseDelay = 1000; // 1秒
  private readonly maxDelay = 30000; // 30秒

  getNextDelay(): number {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.attempt),
      this.maxDelay
    );
    this.attempt++;
    return delay;
  }

  reset(): void {
    this.attempt = 0;
  }
}
```

---

## 再接続・エラーハンドリング

### 再接続戦略

**方針**:
- 指数バックオフ（1s, 2s, 4s... max 30s）
- 接続復旧時はスナップショット再取得（板の整合性回復）
- heartbeat/ping 監視で接続状態を確認

**実装ポイント**:
- WebSocket の `close` イベントで再接続をスケジュール
- 接続成功時にバックオフをリセット
- 最大リトライ回数は設定可能（デフォルト: 無制限）

### エラーハンドリング

**想定されるエラー**:
- ネットワーク切断
- WebSocket プロトコルエラー
- メッセージパースエラー
- Redis 接続エラー

**対応方針**:
- すべてのエラーをログに記録
- 致命的でないエラーは再接続で回復を試みる
- Redis エラーはリトライ（指数バックオフ）

---

## メッセージ正規化

### 正規化インターフェース

```typescript
export interface NormalizedEvent {
  type: 'trade' | 'orderbook' | 'ticker';
  exchange: string;
  symbol: string;
  ts: number; // ミリ秒エポック
  data: any;
}
```

### GMO コインの正規化例

**ticker メッセージ**:
```typescript
// GMO コインの形式
{
  "channel": "ticker",
  "symbol": "BTC_JPY",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "last": 6123456,
  "bid": 6123000,
  "ask": 6124000,
  "volume": 123.45
}

// 正規化後
{
  type: "ticker",
  exchange: "gmo",
  symbol: "BTC_JPY",
  ts: 1704067200000,
  data: {
    last: 6123456,
    bid: 6123000,
    ask: 6124000,
    volume: 123.45
  }
}
```

**orderbook メッセージ**:
```typescript
// GMO コインの形式
{
  "channel": "orderbooks",
  "symbol": "BTC_JPY",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "bids": [[6123000, 0.5], [6122000, 0.8]],
  "asks": [[6124000, 0.4], [6125000, 1.2]]
}

// 正規化後
{
  type: "orderbook",
  exchange: "gmo",
  symbol: "BTC_JPY",
  ts: 1704067200000,
  data: {
    is_snapshot: false, // 差分かスナップショットか
    bids: [[6123000, 0.5], [6122000, 0.8]],
    asks: [[6124000, 0.4], [6125000, 1.2]]
  }
}
```

**trade メッセージ**:
```typescript
// GMO コインの形式
{
  "channel": "trades",
  "symbol": "BTC_JPY",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "price": 6123456,
  "size": 0.01,
  "side": "BUY"
}

// 正規化後
{
  type: "trade",
  exchange: "gmo",
  symbol: "BTC_JPY",
  ts: 1704067200000,
  data: {
    price: 6123456,
    size: 0.01,
    side: "buy" // 統一（小文字）
  }
}
```

---

## Redis Stream への配信

### Stream 名の規則

- `md:trade`: 約定情報
- `md:orderbook`: 板情報
- `md:ticker`: 最新レート

### メッセージ形式

Redis Stream の各エントリは以下の形式:

```
{
  "exchange": "gmo",
  "symbol": "BTC_JPY",
  "ts": "1704067200000",
  "data": "{\"price\":6123456,\"size\":0.01,\"side\":\"buy\"}"
}
```

### 配信の最適化

- **バッチ処理**: 複数メッセージをまとめて配信（オプション）
- **圧縮**: 大きなメッセージ（orderbook など）は圧縮を検討
- **優先度**: ticker を最優先で配信

---

## プロジェクト構成

### ディレクトリ構造

```
services/
└── collector/
    ├── src/
    │   ├── main.ts                 # エントリーポイント
    │   ├── types.ts                # 型定義
    │   ├── adapters/
    │   │   ├── base.ts             # ベースアダプター
    │   │   ├── gmo.ts              # GMO コインアダプター
    │   │   └── bybit.ts            # Bybit アダプター（将来）
    │   ├── redis/
    │   │   └── publisher.ts        # Redis Stream 配信
    │   └── reconnect/
    │       ├── manager.ts          # 再接続管理
    │       └── backoff.ts          # 指数バックオフ
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    └── .env.example
```

---

## 参考資料

- [Node.js v22 WebSocket](https://nodejs.org/en/blog/announcements/v22-release-announce#websocket) - Node.js v22 でフラグなしで使える WebSocket
- [Node.js と ws でシンプルな WebSocketサーバー](https://qiita.com/youtoy/items/9e1eeae728dc98f15679) - WebSocket の実装例
- [GMOコイン API Documentation](https://api.coin.z.com/docs/#t-spot_param_list_symbol) - GMO コインの WebSocket API
- [architecture.md](./01_architecture.md) - システム全体のアーキテクチャ

