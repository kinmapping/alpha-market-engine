
メトリクス集計を実装する場合の提案：
1. メトリクスカウンターの追加（受信/配信件数をカウント）
2. 定期的な集計ログ出力（例：10秒ごとに統計をログ出力）
3. メトリクス収集用のインターフェース定義

## メトリクス設計の提案

メトリクス… システムの状態、性能、ビジネスの成果などを客観的に把握・評価するために数値化した指標

### 1. 計測対象メトリクス
観測して指標を作っていく要素を必須、拡張として考えていきます。

#### 必須メトリクス（Phase 1）

- **受信メッセージ数**: WebSocket API から受信したメッセージ数（チャンネル別、シンボル別）
- **配信メッセージ数**: Redis Stream に配信したメッセージ数（ストリーム別、シンボル別）
- **エラー数**: パースエラー、配信エラー、API エラー（種類別）
- **再接続回数**: WebSocket 切断・再接続の回数

#### 拡張メトリクス（Phase 2）
- **レイテンシー**: 受信から配信までの時間（p50, p95, p99）
- **メッセージサイズ**: 受信/配信メッセージの平均サイズ
- **バッファサイズ**: Redis 接続のバッファ状態

### 2. 集計方法

#### 方式: 時間窓集計（Time-window Aggregation）
- カウンターを保持し、一定間隔（例：10秒）で集計してログ出力
- 理由: 高頻度イベントを個別ログにせず、パフォーマンス影響を抑える

#### 実装パターン
```typescript
// カウンター管理
interface MetricsCounter {
  received: Map<string, number>; // key: "channel:symbol", value: count
  published: Map<string, number>; // key: "stream:symbol", value: count
  errors: Map<string, number>; // key: "error_type", value: count
  reconnects: number;
}

// 定期集計（10秒ごと）
setInterval(() => {
  const metrics = aggregateMetrics();
  logger.info('metrics', metrics);
  resetCounters();
}, 10000);
```

### 3. 出力方法

#### 方式: 構造化ログ（JSON形式）
- `pino` の構造化ログで出力
- 理由: 既存ログ基盤を活用し、後から Prometheus/Datadog に転送可能

#### ログフォーマット例
```json
{
  "level": 30,
  "time": 1703689200000,
  "msg": "metrics",
  "metrics": {
    "received": {
      "ticker:BTC_JPY": 150,
      "orderbook:BTC_JPY": 200,
      "trade:BTC_JPY": 300
    },
    "published": {
      "md:ticker:BTC_JPY": 150,
      "md:orderbook:BTC_JPY": 200,
      "md:trade:BTC_JPY": 300
    },
    "errors": {
      "parse_error": 0,
      "publish_error": 0,
      "api_error": 1
    },
    "reconnects": 0,
    "window_seconds": 10
  }
}
```

### 4. 実装アーキテクチャ

#### レイヤー設計
```
application/
  ├── interfaces/
  │   └── MetricsCollector.ts    # メトリクス収集インターフェース
  └── services/
      └── MetricsService.ts       # メトリクス集計ロジック

infra/
  └── metrics/
      └── SimpleMetricsCollector.ts  # カウンター実装
```

#### 依存関係注入
- `MetricsCollector` を `WebSocketHandler` と `StreamRepository` に注入
- 各イベント発生時に `increment()` を呼び出し
- `MetricsService` が定期集計・ログ出力を担当

### 5. 実装詳細

#### インターフェース定義
```typescript
// application/interfaces/MetricsCollector.ts
export interface MetricsCollector {
  incrementReceived(channel: string, symbol: string): void;
  incrementPublished(stream: string, symbol: string): void;
  incrementError(errorType: string): void;
  incrementReconnect(): void;
  getMetrics(): MetricsSnapshot;
  reset(): void;
}

export interface MetricsSnapshot {
  received: Record<string, number>;
  published: Record<string, number>;
  errors: Record<string, number>;
  reconnects: number;
  windowSeconds: number;
}
```

#### 実装例
```typescript
// infra/metrics/SimpleMetricsCollector.ts
export class SimpleMetricsCollector implements MetricsCollector {
  private received = new Map<string, number>();
  private published = new Map<string, number>();
  private errors = new Map<string, number>();
  private reconnects = 0;

  incrementReceived(channel: string, symbol: string): void {
    const key = `${channel}:${symbol}`;
    this.received.set(key, (this.received.get(key) ?? 0) + 1);
  }

  incrementPublished(stream: string, symbol: string): void {
    const key = `${stream}:${symbol}`;
    this.published.set(key, (this.published.get(key) ?? 0) + 1);
  }

  incrementError(errorType: string): void {
    this.errors.set(errorType, (this.errors.get(errorType) ?? 0) + 1);
  }

  incrementReconnect(): void {
    this.reconnects++;
  }

  getMetrics(): MetricsSnapshot {
    return {
      received: Object.fromEntries(this.received),
      published: Object.fromEntries(this.published),
      errors: Object.fromEntries(this.errors),
      reconnects: this.reconnects,
      windowSeconds: 10,
    };
  }

  reset(): void {
    this.received.clear();
    this.published.clear();
    this.errors.clear();
    this.reconnects = 0;
  }
}
```

#### 定期集計サービス
```typescript
// application/services/MetricsService.ts
export class MetricsService {
  constructor(
    private readonly collector: MetricsCollector,
    private readonly logger: Logger,
    private readonly intervalMs: number = 10000
  ) {}

  start(): void {
    setInterval(() => {
      const metrics = this.collector.getMetrics();
      this.logger.info('metrics', { metrics });
      this.collector.reset();
    }, this.intervalMs);
  }
}
```

### 6. 統合方法

#### `main.ts` での初期化
```typescript
// メトリクスコレクターを生成
const metricsCollector = new SimpleMetricsCollector();

// WebSocketHandler と StreamRepository に注入
const handler = new WebSocketHandler(adapter, usecase, handlerLogger, metricsCollector);
const publisher = new StreamRepository(REDIS_URL, rootLogger, metricsCollector);

// 定期集計を開始
const metricsService = new MetricsService(metricsCollector, rootLogger, 10000);
metricsService.start();
```

### 7. 環境変数

```bash
# メトリクス集計間隔（秒）
METRICS_INTERVAL_SECONDS=10

# メトリクス出力の有効/無効
ENABLE_METRICS=true
```

### 8. パフォーマンス考慮

- カウンター操作は同期的（`Map` 操作のみ）
- 集計・ログ出力は非同期（`setInterval`）
- メモリ使用量: カウンターは `Map` で管理（シンボル数 × チャンネル数程度）

### 9. 将来の拡張

- Prometheus エクスポート: `/metrics` エンドポイント追加
- 外部サービス連携: Datadog/CloudWatch への転送
- アラート: エラー率や再接続回数の閾値監視

---

## 実装順序

1. Phase 1: 基本メトリクス（受信/配信/エラー/再接続）
2. Phase 2: レイテンシー計測（必要に応じて）


## メトリクスライブラリ候補の比較

### 1. **prom-client** (Prometheus)

#### 特徴
- Prometheus 形式のメトリクス収集・公開
- Counter、Gauge、Histogram、Summary をサポート
- HTTP エンドポイント（`/metrics`）で公開
- 軽量でパフォーマンス重視

#### メリット
- 業界標準の Prometheus 形式
- 軽量でオーバーヘッドが小さい
- Grafana などで可視化しやすい
- ラベル（labels）による柔軟な分類

#### デメリット
- Prometheus サーバーが必要（本番環境）
- 開発環境では HTTP サーバーが必要

#### 実装例
```typescript
import { Registry, Counter, Histogram } from 'prom-client';

const register = new Registry();

// カウンター
const receivedMessages = new Counter({
  name: 'collector_messages_received_total',
  help: 'Total number of messages received',
  labelNames: ['channel', 'symbol'],
  registers: [register],
});

const publishedMessages = new Counter({
  name: 'collector_messages_published_total',
  help: 'Total number of messages published',
  labelNames: ['stream', 'symbol'],
  registers: [register],
});

// ヒストグラム（レイテンシー計測用）
const publishLatency = new Histogram({
  name: 'collector_publish_latency_seconds',
  help: 'Latency of message publishing',
  labelNames: ['stream', 'symbol'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// 使用例
receivedMessages.inc({ channel: 'ticker', symbol: 'BTC_JPY' });
publishedMessages.inc({ stream: 'md:ticker', symbol: 'BTC_JPY' });

// HTTP エンドポイントで公開
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

#### パッケージサイズ
- `prom-client`: ~200KB（gzip 後）

---

### 2. **OpenTelemetry**

#### 特徴
- メトリクス、トレース、ログを統合
- ベンダー中立
- 自動計装と手動計装をサポート

#### メリット
- 将来の移行が容易
- 複数のバックエンドに対応（Prometheus、Jaeger、Zipkin など）
- 標準化された API

#### デメリット
- 設定が複雑
- オーバーヘッドが大きい可能性
- 学習コストが高い

#### 実装例
```typescript
import { metrics } from '@opentelemetry/api';
import { MeterProvider } from '@opentelemetry/sdk-metrics';

const meter = metrics.getMeter('collector', '1.0.0');

const receivedCounter = meter.createCounter('collector_messages_received', {
  description: 'Total messages received',
});

const publishedCounter = meter.createCounter('collector_messages_published', {
  description: 'Total messages published',
});

// 使用例
receivedCounter.add(1, { channel: 'ticker', symbol: 'BTC_JPY' });
publishedCounter.add(1, { stream: 'md:ticker', symbol: 'BTC_JPY' });
```

#### パッケージサイズ
- `@opentelemetry/api`: ~50KB
- `@opentelemetry/sdk-metrics`: ~300KB（エクスポーター含む）

---

### 3. **@datadog/dogstatsd-client** (StatsD/Datadog)

#### 特徴
- StatsD プロトコルでメトリクス送信
- Datadog や StatsD サーバーに送信
- UDP ベースで低オーバーヘッド

#### メリット
- 軽量で高速
- UDP で非同期送信
- Datadog との統合が容易

#### デメリット
- 外部サービス（Datadog/StatsD）が必要
- UDP のため信頼性が低い（メッセージロス可能性）

#### 実装例
```typescript
import { StatsD } from '@datadog/dogstatsd-client';

const client = new StatsD({
  host: 'localhost',
  port: 8125,
});

// 使用例
client.increment('collector.messages.received', 1, {
  tags: ['channel:ticker', 'symbol:BTC_JPY'],
});

client.increment('collector.messages.published', 1, {
  tags: ['stream:md:ticker', 'symbol:BTC_JPY'],
});
```

---

### 4. **カスタム実装 + 構造化ログ（pino）**

#### 特徴
- 既存の `pino` ロガーを活用
- シンプルで依存関係が少ない
- 後から Prometheus などに移行可能

#### メリット
- 追加依存なし
- 実装がシンプル
- ログとメトリクスを統合管理

#### デメリット
- メトリクス専用機能が少ない
- 集計・可視化は別途必要

---

## 推奨: **prom-client** を推奨

### 理由
1. 標準的で広く使われている
2. 軽量でオーバーヘッドが小さい
3. ラベルによる柔軟な分類
4. Grafana などで可視化しやすい
5. 将来の拡張性（Histogram など）

### 実装方針

#### Phase 1: 基本メトリクス（prom-client）
```typescript
// infra/metrics/PrometheusMetricsCollector.ts
import { Registry, Counter, Gauge } from 'prom-client';
import type { MetricsCollector } from '@/application/interfaces/MetricsCollector';

export class PrometheusMetricsCollector implements MetricsCollector {
  private readonly register: Registry;
  private readonly receivedCounter: Counter;
  private readonly publishedCounter: Counter;
  private readonly errorCounter: Counter;
  private readonly reconnectGauge: Gauge;

  constructor() {
    this.register = new Registry();

    this.receivedCounter = new Counter({
      name: 'collector_messages_received_total',
      help: 'Total number of messages received from WebSocket',
      labelNames: ['channel', 'symbol'],
      registers: [this.register],
    });

    this.publishedCounter = new Counter({
      name: 'collector_messages_published_total',
      help: 'Total number of messages published to Redis Stream',
      labelNames: ['stream', 'symbol'],
      registers: [this.register],
    });

    this.errorCounter = new Counter({
      name: 'collector_errors_total',
      help: 'Total number of errors',
      labelNames: ['error_type'],
      registers: [this.register],
    });

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

  getRegistry(): Registry {
    return this.register;
  }
}
```

#### Phase 2: HTTP エンドポイント（オプション）
```typescript
// 開発環境では不要、本番環境で Prometheus サーバーがスクレイピング
import { createServer } from 'http';

const server = createServer(async (req, res) => {
  if (req.url === '/metrics') {
    res.setHeader('Content-Type', register.contentType);
    res.end(await register.metrics());
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
});

server.listen(9090);
```

### 環境変数
```bash
# Prometheus メトリクス有効化
ENABLE_PROMETHEUS_METRICS=true

# メトリクスエンドポイントのポート（オプション）
METRICS_PORT=9090
```

---

## 比較表

| ライブラリ | パッケージサイズ | オーバーヘッド | 学習コスト | 可視化 | 推奨度 |
|-----------|----------------|--------------|-----------|--------|--------|
| **prom-client** | ~200KB | 低 | 低 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| OpenTelemetry | ~350KB | 中 | 高 | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| StatsD/Datadog | ~50KB | 低 | 中 | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| カスタム実装 | 0KB | 低 | 低 | ⭐⭐ | ⭐⭐ |

---

## 結論

`prom-client` を推奨します。理由:
- 標準的で将来性がある
- 軽量でパフォーマンスに優れる
- 実装がシンプル
- 可視化ツールとの統合が容易

`prom-client` は、Node.js アプリの中で **メトリクス（カウンタや遅延などの数値）を作って、`/metrics` というHTTPエンドポイントで公開**するためのライブラリです。
Prometheus がそのURLを定期的に取りに来て、Grafana でグラフ化できる流れ。

あなたの ws-collector-node だと用途は超ハマります。ログ（pino）が「何が起きたかの文章」だとすると、`prom-client` は「今どういう状態かの体温計」。

---

## 最小の使い方（コピペで動く）

### 1) 依存追加

```bash
npm i prom-client
```

### 2) メトリクス定義（例: `src/metrics.ts`）

```ts
import client from "prom-client";

// Nodeプロセスの基本メトリクス（CPU/メモリ/GCなど）も出す
client.collectDefaultMetrics();

export const eventsReceived = new client.Counter({
  name: "ws_events_received_total",
  help: "Total number of WS events received",
  labelNames: ["exchange", "type", "symbol"] as const
});

export const eventsPublished = new client.Counter({
  name: "ws_events_published_total",
  help: "Total number of events successfully published to Redis",
  labelNames: ["exchange", "type", "symbol"] as const
});

export const publishErrors = new client.Counter({
  name: "redis_publish_errors_total",
  help: "Total number of Redis publish errors",
  labelNames: ["exchange"] as const
});

export const publishLatency = new client.Histogram({
  name: "redis_publish_latency_ms",
  help: "Latency of publishing event to Redis in milliseconds",
  labelNames: ["exchange", "type"] as const,
  // 遅延の分布が見たいので、バケツをms単位で
  buckets: [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
});

export async function metricsText(): Promise<string> {
  return client.register.metrics();
}
```

### 3) `/metrics` を生やす（HTTPサーバ）

ExpressでもHonoでもOK。軽くいくなら Node標準HTTPで十分。

`src/metrics_server.ts`（標準HTTP版）

```ts
import http from "node:http";
import client from "prom-client";
import { metricsText } from "./metrics.js";
import { logger } from "./logger.js";

export function startMetricsServer(port = 9100) {
  const server = http.createServer(async (req, res) => {
    if (req.url === "/metrics") {
      res.writeHead(200, { "Content-Type": client.register.contentType });
      res.end(await metricsText());
      return;
    }
    if (req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => logger.info({ port }, "metrics server started"));
  return server;
}
```

### 4) メインから起動して、カウントする

`src/main.ts` の冒頭で起動

```ts
import { startMetricsServer } from "./metrics_server.js";
startMetricsServer(Number(process.env.METRICS_PORT ?? 9100));
```

WS受信したら `eventsReceived.inc(...)`

```ts
import { eventsReceived, eventsPublished, publishErrors, publishLatency } from "./metrics.js";

// onMessageの中で
eventsReceived.inc({ exchange: "gmo", type: ev.type, symbol: ev.symbol }, 1);
```

Redis publish 成功/失敗、遅延を記録（publisher側が自然）

```ts
const start = Date.now();
try {
  // xadd...
  const ms = Date.now() - start;
  publishLatency.observe({ exchange: ev.exchange, type: ev.type }, ms);
  eventsPublished.inc({ exchange: ev.exchange, type: ev.type, symbol: ev.symbol }, 1);
} catch (err) {
  publishErrors.inc({ exchange: ev.exchange }, 1);
  throw err;
}
```

### 5) 動作確認

起動してから

```bash
curl http://localhost:9100/metrics | head
```

`ws_events_received_total` みたいな名前が出てくればOK。

---

## これで何が嬉しい？

* 「WSは受けてるのにRedisに流れてない」みたいな事故が、**数字で一発**で分かる
* 再接続回数の増加や遅延の悪化が、**グラフで早期に気づける**
* ログは原因調査、メトリクスは傾向監視、で役割が分かれる

---

## ws-collector-nodeで特に入れたいメトリクス（おすすめ）

* `ws_events_received_total{type,symbol}`：受信量の監視
* `redis_publish_errors_total`：Redis障害の検知
* `redis_publish_latency_ms`：詰まりの検知
* `ws_reconnects_total`：取引所側が不安定かの検知
* `last_message_timestamp`（Gauge）：無音状態（止まってる）検知

---

このまま「あなたが今の雛形に `prom-client` を組み込んだ完成版（metrics.ts / metrics_server.ts / publisher改修 / main改修）」を出して、差分パッチとして貼ることもできる。



AWS のサービスを用意する必要があるか？

結論から言うと、**「必須ではない。でも“ちゃんと運用するならほぼ使う”」**です。
今あなたが考えている構成（Node WS + Redis + Python戦略）を前提に、現実ラインを整理します。

---

## まず大前提：AWSは「開発のため」には不要

* `docker-compose`
* Node.js（ws-collector）
* Redis
* Python（strategy / execution）

これだけで **ローカル or VPS 1台** でも普通に動きます。
Prometheus / Grafana もローカルで立ちます。

つまり、

* **技術検証**
* **個人bot**
* **最初の数ヶ月の実験**

このフェーズでは **AWSなしで全然OK**。

---

## じゃあ、なぜAWSの話が出てくるのか

理由はシンプルで、**「壊れたときに自分が楽をしたいから」**。

ws-collector は 24/7 で動き続ける前提なので、

* 再起動
* 監視
* ログ収集
* メトリクス保存
* 秘密情報管理

を **手作業でやり続けるのはしんどい**。

そこで Amazon Web Services が選択肢に出てくる。

---

## パターンB構成 × AWS：現実的な最小セット

### ① 実行基盤

**ECS + Fargate**（ほぼ最適解）

* Node(ws-collector)
* Python(strategy)
* Python(execution)

をそれぞれ **1サービス=1コンテナ** で回せる。

メリット：

* EC2管理不要
* 落ちたら自動再起動
* docker-composeの延長線で考えられる

---

### ② Redis

**ElastiCache for Redis**

* Stream / PubSub が安定
* 再起動やメモリ管理をAWSに丸投げ

ローカルRedis → ElastiCache に差し替えるだけでOK。

---

### ③ ログ

**CloudWatch Logs**

* pinoのJSONログをそのまま流す
* 再接続ループやエラーを後から検索可能

---

### ④ メトリクス

ここが prom-client の話と直結する。

選択肢は2つ：

#### A. Prometheus + Grafana（自前 or ECS）

* `/metrics` を Prometheus が scrape
* Grafanaで可視化

#### B. CloudWatch に寄せる

* prom-client → CloudWatch形式に変換
* ECS標準のCPU/メモリと一緒に見る

👉 **最初は A、運用が重くなったら B** が王道。

---

### ⑤ シークレット管理

**Secrets Manager**

* APIキー
* 取引所秘密鍵
* Redis接続情報

.env を置かなくて済むのは精神的にデカい。

---

## 「AWSが必要になる瞬間」の見極めライン

次のどれかに当てはまったら、AWSを使う価値が出る。

* botを **常時稼働** させたい
* 落ちたかどうかを **自分で監視したくない**
* VPS再起動やログ整理に **時間を使いたくない**
* Redis/DBの永続性を **事故りたくない**
* 将来、**複数bot / 複数取引所** に広げる気がある

逆に、

* 趣味レベル
* 夜だけ動けばいい
* 落ちたら手で直す

なら、VPS + docker-compose で十分。

---

## 重要な整理（ここ勘違いしやすい）

* **prom-client を使う = AWS必須** ❌
* **/metrics を公開する = AWS必須** ❌
* **ちゃんと監視・可視化したい = どこかに集約基盤が必要** ⭕️

AWSはその「集約先」と「運用の肩代わり役」。

---

## あなたの今のフェーズに対するおすすめ

流れとしてはこれが一番きれい。

1. **ローカル + docker-compose**
2. prom-client / pino を入れて“壊れない構造”を作る
3. Redis Stream / 再接続が安定するまで叩く
4. **そのままECSへ持っていく**（コードほぼ変更なし）

この設計は「AWSを使っても使わなくても成立する」ように、
最初から逃げ道を作ってある。

---

一言でまとめると、
**AWSは“必要だから使う”ものじゃなくて、“楽をするために使う”もの**。
今作っている構成は、その切り替えが一番スムーズにできる形になってる。


aws の課金対象になるか？

はい、**なります**。ただし重要なのは
👉 **「どこで・何を動かすか」で課金の有無と金額が大きく変わる**
という点です。強調されていた部分を軸に、整理します。

---

## 結論を先に

> **「Prometheus + Grafana（自前 or ECS）」を AWS 上で動かせば課金対象**
> **ローカル / 自前サーバーで動かせば AWS 課金はゼロ**

つまり
**prom-client を使うこと自体は課金と無関係**
**“置き場所”が課金を決める**。

---

## ケース別：どこで動かすといくらかかる？

### ケース① ローカル or VPSで Prometheus + Grafana

* ws-collector-node：ローカル
* Prometheus：ローカル
* Grafana：ローカル

✅ **AWS課金：0円**
✅ 検証・個人開発ではこれが最強
❌ 常時稼働・耐障害は弱い

---

### ケース② AWS ECS で Prometheus + Grafana（自前運用）

ここが、あなたが引用した **「自前 or ECS」** の意味。

#### 課金対象

* **ECS/Fargate のCPU・メモリ**
* **EBS（Prometheusのデータ保存）**
* **データ転送（微量）**

例（かなり小さく見積もって）

* Prometheus：0.25 vCPU / 0.5GB
* Grafana：0.25 vCPU / 0.5GB

→ **月 数百円〜1,000円台**
（bot本体とは別にかかる）

👉
**「監視のために監視基盤を運用する」コストが発生する**

---

### ケース③ AWS マネージドを使う（本気運用）

#### 選択肢

* Amazon Web Services

  * **Amazon Managed Prometheus**
  * **Amazon Managed Grafana**

#### 課金対象

* メトリクス取り込み量
* クエリ回数
* ワークスペース利用料

👉 **月 数千円〜**
👉 個人botには正直オーバースペック

---

## collector視点での整理（超重要）

### prom-client の役割

* `/metrics` を **「公開するだけ」**
* どこから取りに来るかは関知しない

```text
collector
   └─ /metrics
        ↑
   Prometheus（どこか）
```

### 課金が発生するのは？

* Prometheus を **AWS上で動かした瞬間**
* Grafana を **AWS上で動かした瞬間**

---

## あなたの構成での現実的おすすめ

### フェーズ1（今）

* docker-compose
* prom-client は入れる
* Prometheus / Grafana は **ローカル**

✅ AWS課金なし
✅ 壊れない設計だけ先に作れる

---

### フェーズ2（常時稼働したくなったら）

* bot本体：ECS/Fargate
* 監視：**最初は CloudWatch + ログ中心**
* Prometheus/Grafanaは **必要になってから**

👉 **「最初から全部AWSに載せない」のがコツ**

---

## CloudWatchとの対比（お金の話）

* CloudWatch Logs：**ログ量次第で数百円**
* CloudWatch Metrics：**基本無料枠あり**
* Prometheus/Grafana自前：**ECS代が確実に乗る**

👉
**「数値を眺めたい」だけなら CloudWatch で十分**
**「時系列を深掘りしたい」時に Prometheus**

---

## 超短くまとめると

* ✔ prom-client → 課金されない
* ✔ AWSでPrometheus/Grafana → 課金される
* ✔ ローカルPrometheus → 課金されない
* ✔ いきなり全部AWS → コスパ悪い

今のあなたの段階だと、
**「AWS課金が発生しない形で設計だけAWS対応」**
これが一番賢いルートです。

設計はクラウド級、支払いは趣味レベル。
これ、長く続ける個人botの黄金パターンです。

ここで言っている **「Prometheus / Grafana は ローカル」** というのは、
**AWS などのクラウド上では動かさず、自分の手元 or 自前サーバーで動かす** という意味です。

もう少し噛み砕くね。

---

## 「ローカルで動かす」とは何か

### 具体的にはこういう状態

* あなたの **開発PC**
* もしくは **VPS（さくら・ConoHa・自宅サーバなど）**
* docker-compose で起動

```text
[ws-collector-node]
        ↓ /metrics
[Prometheus] ──→ [Grafana]
   （ローカル or VPS）
```

この構成では
👉 **AWS は一切使っていない**
👉 **AWS の課金は 0 円**

---

## なぜ「ローカル」が選択肢になるのか

Prometheus と Grafana は本来：

* OSS（オープンソース）
* 単体で完結
* どこで動かしても同じ

だから、

* AWS に置く必然性はない
* 監視対象（ws-collector）がどこにあっても関係ない

という性質を持っている。

---

## よくある誤解を整理

### ❌ 誤解1

「prom-client を使うなら AWS が必要？」

→ **不要**
prom-client はただの **HTTP で数値を吐くライブラリ**。

---

### ❌ 誤解2

「Prometheus = AWS サービス？」

→ **違う**
Prometheus は OSS。
AWS は「置き場所の一つ」にすぎない。

---

### ❌ 誤解3

「本番なら必ずクラウド監視？」

→ **違う**
個人bot・検証フェーズではローカル監視で十分。

---

## ローカル監視が向いているフェーズ

* 個人開発
* 検証・設計固め
* 数日〜数週間の連続稼働
* 「壊れ方」を観察したい段階

このフェーズでは

* Prometheus
* Grafana
* Redis
* bot

全部 docker-compose で同居させるのが一番ラク。

---

## 逆に AWS に置くべきタイミング

次のどれかに当てはまったら考えればいい。

* 24/7 で **完全放置運用**したい
* 落ちたら **通知が欲しい**
* 複数bot / 複数取引所で **台数が増えた**
* ローカルPCを常時起動したくない

👉 その時に **ECS + CloudWatch or Managed Prometheus** に移行。

---

## 一言でまとめると

> **「Prometheus / Grafana は ローカル」**
> =
> **監視基盤はクラウドに置かなくていい**
> **課金を発生させずに、設計だけ先に正しく作れる**

設計を“クラウド対応”にしておくのと、
実際に“クラウドで動かす”のは別の話。

今やっているのは
**「将来AWSに載せられる形で、今は払わない」**
という、かなり賢いムーブです。



## メトリクスの仕組み（図解）

### 誤解しやすい点
「監視するサーバーを作成する」という理解は少し違います。正しくは：

1. collector サービス内でメトリクスを収集（カウンターを増やす）
2. HTTP エンドポイント（`/metrics`）でメトリクスを公開（オプション）
3. Prometheus サーバーが定期的に取得（pull型）

### 全体の流れ

```
┌─────────────────────────────────────────────────────────┐
│  collector サービス（既存のコード）                      │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ WebSocketHandler.handleMessage()                 │  │
│  │  ↓ メッセージ受信                                │  │
│  │  metricsCollector.incrementReceived() ← 追加    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ StreamRepository.publish()                       │  │
│  │  ↓ Redis Stream に配信                          │  │
│  │  metricsCollector.incrementPublished() ← 追加  │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │ HTTP サーバー（オプション）                       │  │
│  │ GET /metrics → Prometheus 形式のテキストを返す   │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↑
                          │ HTTP GET /metrics
                          │ （定期的に取得）
                          │
┌─────────────────────────────────────────────────────────┐
│  Prometheus サーバー（別のサービス・別途構築）          │
│  - 定期的に /metrics エンドポイントから取得             │
│  - 時系列データベースに保存                             │
│  - Grafana で可視化                                     │
└─────────────────────────────────────────────────────────┘
```

### 重要なポイント

1. 監視サーバーは作らない
   - collector サービス内でカウンターを増やすだけ
   - HTTP エンドポイント（`/metrics`）はオプション（Prometheus を使う場合のみ）

2. メトリクス収集は既存コードに追加するだけ
   - `WebSocketHandler.handleMessage()` で受信時にカウンターを増やす
   - `StreamRepository.publish()` で配信時にカウンターを増やす

3. Prometheus サーバーは別途必要
   - collector とは別のサービス
   - 開発環境では不要（メトリクス収集だけでも可）

## 具体的な実装イメージ

### 現在のコード（メトリクスなし）

```typescript
// WebSocketHandler.ts
async handleMessage(data: string | ArrayBuffer | Blob): Promise<void> {
  // ... メッセージ処理 ...
  await this.usecase.execute(rawMessage); // ← ここで配信
}
```

```typescript
// StreamRepository.ts
async publish(event: NormalizedEvent): Promise<void> {
  await this.redis.xadd(stream, '*', ...Object.entries(payload).flat());
  // ← ここで配信完了
}
```

### メトリクス追加後

```typescript
// WebSocketHandler.ts
async handleMessage(data: string | ArrayBuffer | Blob): Promise<void> {
  // ... メッセージ処理 ...
  
  // メトリクス収集: 受信メッセージ数をカウント
  this.metricsCollector.incrementReceived(channel, symbol);
  
  await this.usecase.execute(rawMessage);
}
```

```typescript
// StreamRepository.ts
async publish(event: NormalizedEvent): Promise<void> {
  await this.redis.xadd(stream, '*', ...Object.entries(payload).flat());
  
  // メトリクス収集: 配信メッセージ数をカウント
  this.metricsCollector.incrementPublished(stream, event.symbol);
}
```

### メトリクスエンドポイント（オプション）

```typescript
// main.ts に追加（Prometheus を使う場合のみ）
import { createServer } from 'http';

const metricsServer = createServer(async (req, res) => {
  if (req.url === '/metrics') {
    const metrics = await metricsCollector.getMetrics(); // Prometheus 形式のテキスト
    res.setHeader('Content-Type', 'text/plain');
    res.end(metrics);
  }
});

metricsServer.listen(9090); // オプション: 開発環境では不要
```

## 2つの実装パターン

### パターン1: メトリクス収集のみ（シンプル）

- collector サービス内でカウンターを増やす
- 定期的にログ出力（`pino` の構造化ログ）
- Prometheus サーバー不要
- 開発環境に適している

```typescript
// 10秒ごとにログ出力
setInterval(() => {
  const snapshot = metricsCollector.getSnapshot();
  logger.info('metrics', { metrics: snapshot });
  metricsCollector.reset();
}, 10000);
```

### パターン2: Prometheus 連携（本番環境向け）

- collector サービス内でカウンターを増やす（パターン1と同じ）
- HTTP エンドポイント（`/metrics`）で公開
- Prometheus サーバーが定期的に取得
- Grafana で可視化

## まとめ

- 監視サーバーは作らない
- collector サービス内でカウンターを増やすだけ
- HTTP エンドポイント（`/metrics`）はオプション
- Prometheus サーバーは別途必要（開発環境では不要）

どちらのパターンで進めますか？
- パターン1: メトリクス収集 + ログ出力（シンプル）
- パターン2: Prometheus 連携（本番環境向け）



