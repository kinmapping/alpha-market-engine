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

```mermaid
flowchart TB
    GMO@{ shape: cloud, label: "<strong>GMO WebSocket</strong><br/>(Public API)" }

    subgraph Collector
      Adapter1["Adapter<br>(GMO)"]
      Adapter2["Adapter<br>(BitFlyer)"]
      Adapter3["Adapter<br>(Binance)"]
      Publisher["Publisher(Redis)"]
    end

    Redis@{shape: das, label: "<strong>Redis</strong><br/>(Stream)<br>FIFO(先入先出)<br>:メッセージは追加順に処理される"}
    %% redis_comment@{ shape: comment, label: "Comment" }

    %% relation
    GMO e1@<==>|WebSocket<br>チャンネル<br>（ticker/orderbook/trade）<br>を購読| Adapter1
    GMO e2@<==>|WebSocket<br>チャンネル<br>（ticker/orderbook/trade）<br>を購読| Adapter2
    GMO e3@<==>|WebSocket<br>チャンネル<br>（ticker/orderbook/trade）<br>を購読| Adapter3
    %% Adapter2 ~~~ Publisher
    Adapter1 e4@==>|メッセージの正規化| Publisher
    Adapter2 e5@==>|メッセージの正規化| Publisher
    Adapter3 e6@==>|メッセージの正規化| Publisher

    Publisher e7@==>|"XADD(書き込み)<br>md:trade<br>md:orderbook<br>md:ticker"| Redis


    e1@{ animate: true }
    e2@{ animate: true }
    e3@{ animate: true }
    e4@{ animate: true }
    e5@{ animate: true }
    e6@{ animate: true }
    e7@{ animate: true }
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

### クラス図

```mermaid
classDiagram
direction LR

namespace `presentation/websocket` {
    class WebSocketHandler {
        +reconnectManager: ReconnectManager
        -adapter: MarketDataAdapter
        -usecase: PublishStreamUsecase
        +constructor(adapter: MarketDataAdapter, usecase: PublishStreamUsecase)
        +start(): Promise<void>
        +disconnect(): void
        +handleMessage(data: string | ArrayBuffer | Blob): Promise<void>
    }
}

namespace `infra/adapters/gmo` {
    class GmoAdapter {
        -connection: WebSocketConnection | null
        -webSocketClient: GmoWebSocketClient
        -CONNECTION_DELAY: number
        -symbol: string
        -wsUrl: string
        -onMessageCallback: (data: string | ArrayBuffer | Blob) => Promise<void>
        -onCloseCallback: () => void
        -onErrorCallback: (event: Event) => void
        +constructor(symbol: string, wsUrl: string, onMessage?: ..., onClose?: ..., onError?: ...)
        +setOnMessage(callback: (data: string | ArrayBuffer | Blob) => Promise<void>): void
        +setOnClose(callback: () => void): void
        +setOnError(callback: (event: Event) => void): void
        +connect(): Promise<void>
        +disconnect(): void
        +parseMessage(data: string | ArrayBuffer | Blob): GmoRawMessage | null
    }

    class GmoWebSocketClient {
        -connection: WebSocketConnection | null
        -SUBSCRIPTION_INTERVAL: number
        +connect(wsUrl: string): Promise<WebSocketConnection>
        +subscribe(connection: WebSocketConnection, symbol: string): Promise<void>
        +disconnect(): void
        +parseMessage(data: string | ArrayBuffer | Blob): GmoRawMessage | null
    }

    class GmoMessageParser {
        +parse(rawMessage: unknown): NormalizedEvent | null
    }
}

namespace `infra/websocket` {
    class WebSocketConnection {
        <<interface>>
        +onOpen(callback: () => void): void
        +onMessage(callback: (data: string | ArrayBuffer | Blob) => void): void
        +onClose(callback: () => void): void
        +onError(callback: (error: Event) => void): void
        +send(data: string): void
        +close(): void
        +removeAllListeners(): void
        +terminate(): void
    }

    class StandardWebSocketConnection {
        -openCallbacks: Array<() => void>
        -messageCallbacks: Array<(data: string | ArrayBuffer | Blob) => void>
        -closeCallbacks: Array<() => void>
        -errorCallbacks: Array<(error: Event) => void>
        -socket: WebSocket
        +constructor(socket: WebSocket)
        +onOpen(callback: () => void): void
        +onMessage(callback: (data: string | ArrayBuffer | Blob) => void): void
        +onClose(callback: () => void): void
        +onError(callback: (error: Event) => void): void
        +send(data: string): void
        +close(): void
        +removeAllListeners(): void
        +terminate(): void
    }


}


namespace `application/interfaces` {
    class MarketDataAdapter {
        <<interface>>
        +connect(): Promise<void>
        +disconnect(): void
    }

    class MessageParser {
        <<interface>>
        +parse(rawMessage: unknown): NormalizedEvent | null
    }
}

namespace `application/usecase` {
    class PublishStreamUsecase {
        -parser: MessageParser
        -publisher: StreamPublisher
        +constructor(parser: MessageParser, publisher: StreamPublisher)
        +execute(rawMessage: unknown): Promise<void>
    }
}

namespace `infra/reconnect` {
    class ReconnectManager {
        -backoff: BackoffStrategy
        -reconnectTimer: NodeJS.Timeout | null
        -stopped: boolean
        -connectFn: () => Promise<void>
        +constructor(connectFn: () => Promise<void>)
        +start(): Promise<void>
        +scheduleReconnect(): void
        +stop(): void
        -safeConnect(): Promise<void>
    }

    class BackoffStrategy {
        -attempt: number
        -BASE_DELAY: number
        -MAX_DELAY: number
        +getNextDelay(): number
        +reset(): void
    }
}

namespace `domain/repositories` {
    class StreamPublisher {
        <<interface>>
        +publish(event: NormalizedEvent): Promise<void>
    }
}

namespace `infra/redis` {
    class StreamRepository {
        -redis: Redis
        +constructor(redisUrl: string)
        +publish(event: NormalizedEvent): Promise<void>
        +close(): Promise<void>
        -getStreamName(type: MarketDataType): string
    }
}

namespace `domain/models` {
    class NormalizedEvent {
        <<interface>>
        +type: MarketDataType
        +exchange: string
        +symbol: string
        +ts: number
        +data: T
    }

    class MarketDataType {
        <<enumeration>>
        trade
        orderbook
        ticker
    }
}

WebSocketHandler --> MarketDataAdapter: DI(依存)
WebSocketHandler --> PublishStreamUsecase: DI(依存)
WebSocketHandler --> ReconnectManager: creates(生成)
WebSocketHandler ..> GmoAdapter: uses(使用・実装)

GmoAdapter ..|> MarketDataAdapter: implements(実装)
GmoAdapter ..> GmoWebSocketClient: DI(依存)
GmoAdapter ..> WebSocketConnection: uses(型依存・間接取得)
GmoWebSocketClient ..> WebSocketConnection: DI(依存)
GmoWebSocketClient --> StandardWebSocketConnection: uses(使用)
GmoMessageParser ..|> MessageParser: implements(実装)
GmoMessageParser --> NormalizedEvent: returns(返却)

StandardWebSocketConnection ..|> WebSocketConnection: implements(実装)
ReconnectManager --> BackoffStrategy: uses(使用)
PublishStreamUsecase --> MessageParser: DI(依存)
PublishStreamUsecase --> StreamPublisher: DI(依存)
StreamRepository ..|> StreamPublisher: implements(実装)
StreamRepository --> NormalizedEvent: uses(使用)
StreamPublisher --> NormalizedEvent: uses(使用)
MessageParser --> NormalizedEvent: uses(型依存)
NormalizedEvent --> MarketDataType: uses(使用)
```


### ディレクトリ構成
```
collector/
└── src/
    ├── main.ts
    ├── presentation/ (外部からの入力口)
    │   └── websocket/
    │       └── WebSocketHandler.ts      (WS接続の維持・メッセージ受信・再接続管理)
    ├── application/  (ビジネスプロセスの制御)
    │   ├── interfaces/
    │   │   ├── MarketDataAdapter.ts      (取引所アダプタのインターフェース)
    │   │   └── MessageParser.ts          (メッセージパーサーのインターフェース)
    │   └── usecases/
    │       └── PublishStreamUsecase.ts   (受信データを検証しStreamへ投げる司令塔)
    ├── domain/       (業務ルールとインターフェース)
    │   ├── models/           (扱うデータの型・値オブジェクト)
    │   │   └── NormalizedEvent.ts        (正規化されたイベントの型定義)
    │   └── repositories/
    │       └── StreamPublisher.ts        (Redis等への保存口となるインターフェース)
    └── infra/        (具体的な技術実装)
        ├── adapters/
        │   └── gmo/
        │       ├── GmoAdapter.ts         (GMO取引所のアダプタ実装)
        │       ├── GmoMessageParser.ts   (GMOメッセージのパーサー)
        │       ├── GmoWebSocketClient.ts (GMO WebSocket接続・購読)
        │       └── types/
        │           ├── GmoCommand.ts     (GMOコマンドの型定義)
        │           └── GmoRawMessage.ts  (GMO生メッセージの型定義)
        ├── reconnect/
        │   ├── ReconnectManager.ts       (再接続管理)
        │   └── BackoffStrategy.ts        (指数バックオフ戦略)
        ├── redis/
        │   └── StreamRepository.ts       (Redis StreamへのXADD等の実処理)
        └── websocket/
            ├── interfaces/
            │   └── WebSocketConnection.ts (WebSocket接続のインターフェース)
            └── StandardWebSocketConnection.ts (標準WebSocket接続の実装)
```

### 各層の役割とデータの流れ

- **Presentation層 (`presentation/websocket/WebSocketHandler`)**
  - 外部（取引所API）からのWebSocket接続を受け取ります
  - 接続の維持・再接続管理を担当します
  - 受信した「生データ」をApplication層のUseCaseに委譲します
  - `MarketDataAdapter` を使用して取引所固有の接続を管理します

- **Application層 (`application/usecases/PublishStreamUsecase`)**
  - 「受信したデータをどのStreamに流すか」という手順（シナリオ）を記述します
  - `MessageParser` を使用して生データを正規化し、`StreamPublisher` インターフェースを通じて配信します
  - ここにはRedisの具体的なコードは書かず、Domain層で定義されたインターフェース（Repository等）を通じて処理を依頼します

- **Domain層**
  - **`domain/models/NormalizedEvent`**: データのバリデーションルールや、ビジネス上の意味を持つデータ構造を定義します
  - **`domain/repositories/StreamPublisher`**: 「抽象的なインターフェース」を定義し、具体的な技術（Redis）に依存させないのがDDDの肝です

- **Infrastructure層 (`infra/`)**
  - **`infra/redis/StreamRepository`**: Redis クライアント（ ioredis 等）を使用して、実際に XADD などのコマンドを実行して Redis Stream へデータを流し込みます
  - **`infra/adapters/gmo/`**: GMO取引所固有のWebSocketプロトコル実装（接続、購読、メッセージパース）
  - **`infra/reconnect/`**: 再接続管理と指数バックオフ戦略の実装
  - **`infra/websocket/`**: WebSocket接続の抽象化と標準実装

### この構成のメリット

**交換可能性:**
将来的にRedis StreamではなくKafkaやRabbitMQに変更したくなった場合、infra/ の中身を書き換えるだけで済み、ビジネスロジック（Domain/Application）を修正する必要がありません。

**テストのしやすさ:**
Application層のテストにおいて、Redisの実機を使わずに「モック（偽物のPublisher）」を注入してロジックの検証が可能です。

**スケール対応:**
Redis Streamを介在させることで、WebSocketサーバーが複数台にスケールしても、後続のコンシューマーが一貫してデータを処理できる構成になります。

### main.ts

取引所の銘柄ごとに WS 接続を開始する。
SIGINT 命令、SIGTERM 命令を受け取ると WS 接続を終了する。

WS 接続は、WebSocketHandler で以下の責務を負う
- WS 接続の開始
- 受信メッセージを stream に流す
- 接続の維持 (再接続)、切断

エントリーポイント。依存関係の注入とコンポーネントの初期化を担当します。
- `PublishStreamUsecase` を生成
- `GmoAdapter` と `WebSocketHandler` を生成
- シグナルハンドリング（SIGINT/SIGTERM）でクリーンアップ

### presentation/websocket/WebSocketHandler.ts

WebSocket接続の維持・メッセージ受信・再接続管理を担当します。
- `MarketDataAdapter` を使用して接続を管理
- `ReconnectManager` を使用して再接続を管理
- メッセージを `PublishStreamUsecase` に委譲

### application/usecases/PublishStreamUsecase.ts

受信データを検証し、Streamへ配信する司令塔です。
- `MessageParser` を使用して生データを正規化
- `StreamPublisher` インターフェースを通じて配信

### domain/models/NormalizedEvent.ts

正規化されたマーケットデータイベントの型定義です。
- `MarketDataType`: マーケットデータ種別（'trade' | 'orderbook' | 'ticker'）
- `NormalizedEvent<T>`: 正規化されたイベントのインターフェース

### domain/repositories/StreamPublisher.ts

ストリームパブリッシャーのインターフェースです。
- `publish(event: NormalizedEvent): Promise<void>` メソッドを定義
- インフラ層で実装される（`StreamRepository`）

### infra/redis/StreamRepository.ts

Redis Stream への書き込み実装です。
- `StreamPublisher` インターフェースを実装
- ioredis を使用して XADD コマンドを実行

### infra/adapters/gmo/GmoAdapter.ts

GMO コインの WebSocket API を処理するアダプターです。
- `MarketDataAdapter` インターフェースを実装
- 取引所固有のWebSocketプロトコル実装（接続、購読、メッセージパース）

### infra/adapters/gmo/GmoMessageParser.ts

GMO コインのメッセージを正規化するパーサーです。
- `MessageParser` インターフェースを実装
- GMO固有のメッセージ形式を `NormalizedEvent` に変換

### infra/reconnect/ReconnectManager.ts

再接続ロジックを管理します。
- 指数バックオフ戦略を使用
- 接続失敗時に自動的に再接続をスケジュール

### infra/reconnect/BackoffStrategy.ts

指数バックオフ戦略の実装です。

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

## 参考資料

- [Node.js v22 WebSocket](https://nodejs.org/en/blog/announcements/v22-release-announce#websocket) - Node.js v22 でフラグなしで使える WebSocket
- [Node.js と ws でシンプルな WebSocketサーバー](https://qiita.com/youtoy/items/9e1eeae728dc98f15679) - WebSocket の実装例
- [GMOコイン API Documentation](https://api.coin.z.com/docs/#t-spot_param_list_symbol) - GMO コインの WebSocket API
- [システムアーキテクチャ](./01_architecture.md) - システム全体のアーキテクチャ
- [レイヤードアーキテクチャを採用した際のWebSocket実装例](https://blog.p1ass.com/posts/websocket-with-layerd-architecture/#:~:text=%E6%98%8E%E7%A2%BA%E3%81%AB%20DDD%20%E3%82%84%20Clean%20Architecture%20%E3%81%A7%E3%81%82%E3%82%8B%E3%81%A8%E3%81%AF%E8%A8%80%E3%81%88%E3%81%AA%E3%81%84%E3%81%A7%E3%81%99%E3%81%8C%E3%80%81%E3%81%9D%E3%81%AE%E6%80%9D%E6%83%B3%E3%82%92%E5%8F%96%E3%82%8A%E5%85%A5%E3%82%8C%E3%81%A4%E3%81%A4%E7%8B%AC%E8%87%AA%E3%81%AB%E3%82%AB%E3%82%B9%E3%82%BF%E3%83%9E%E3%82%A4%E3%82%BA%E3%81%97%E3%81%A6%E3%81%84%E3%81%BE%E3%81%99%E3%80%82%5B%5E1%5D.%20%5B%5E1%5D%20%E3%81%93%E3%81%93%E3%81%A7%E3%81%AF%E3%81%93%E3%81%AE%E3%82%A2%E3%83%BC%E3%82%AD%E3%83%86%E3%82%AF%E3%83%81%E3%83%A3%E3%81%AE%E8%89%AF%E3%81%97%E6%82%AA%E3%81%97%E3%81%AB%E3%81%A4%E3%81%84%E3%81%A6%E3%81%AF%E8%AA%9E%E3%82%8A%E3%81%BE%E3%81%9B%E3%82%93%E3%80%82%E8%A9%B1%E3%81%8C%E9%80%B8%E3%82%8C%E3%81%99%E3%81%8E%E3%82%8B%E3%81%AE%E3%81%A7%E3%80%82%20WebSocket%20%E3%81%AE%E6%A9%9F%E8%83%BD%E8%A6%81%E4%BB%B6)

