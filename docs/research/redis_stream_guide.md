# Redis と Redis Stream の基礎

本プロジェクトで使用する Redis と Redis Stream について、なぜ使うのか、どのように動作するのかを説明します。

## 目次

1. [Redis とは](#redis-とは)
2. [なぜ Redis を使うのか](#なぜ-redis-を使うのか)
3. [Redis Stream とは](#redis-stream-とは)
4. [Redis Stream vs 他の選択肢](#redis-stream-vs-他の選択肢)
5. [RedisPublisher の役割](#redispublisher-の役割)
6. [実装例と使い方](#実装例と使い方)
7. [参考資料](#参考資料)

---

## Redis とは

### 基本概念

**Redis**（Remote Dictionary Server）は、**インメモリデータストア**です。データをメモリ上に保存するため、非常に高速にアクセスできます。

**特徴**:
- **高速**: メモリ上で動作するため、読み書きが非常に速い（マイクロ秒単位）
- **データ構造**: 文字列、リスト、セット、ハッシュ、ストリームなど、多様なデータ構造をサポート
- **永続化**: オプションでディスクにデータを保存可能（AOF、RDB）
- **分散**: レプリケーションやクラスタリングをサポート

### 主な用途

1. **キャッシュ**: データベースの前に配置して、頻繁にアクセスするデータを高速に取得
2. **セッション管理**: Web アプリケーションのセッションデータを保存
3. **メッセージキュー**: サービス間のメッセージング（Pub/Sub、Stream）
4. **リアルタイムデータ**: ランキング、カウンター、リアルタイム分析

---

## なぜ Redis を使うのか

### 本プロジェクトでの使用目的

本プロジェクトでは、**サービス間のメッセージング**（イベントバス）として Redis を使用しています。

**具体的な用途**:
- **ws-collector-node** → **trading-engine (Strategy)**: 市場データ（ticker/orderbook/trade）を配信
- **trading-engine (Strategy)** → **trading-engine (Execution)**: シグナルを配信

### Redis を選ぶ理由

#### 1. **低遅延**

市場データは**マイクロ秒単位**で変化します。データベース（PostgreSQL）に書き込んでから読み出すのでは遅すぎます。

```
WebSocket 受信 → Redis Stream → trading-engine (Strategy) 処理
（数ミリ秒以内）
```

#### 2. **高スループット**

1秒間に数千件のメッセージを処理する必要があります。Redis はメモリ上で動作するため、このような高頻度の処理に適しています。

#### 3. **取りこぼしゼロ**

Redis Stream の **Consumer Group** 機能により、サービスが再起動しても、処理していないメッセージを取りこぼしません。

#### 4. **シンプルな構成**

Kafka などの本格的なメッセージブローカーと比べて、シンプルで運用が容易です。

---

## Redis Stream とは

### 基本概念

**Redis Stream** は、Redis 5.0 で追加されたデータ構造で、**時系列のメッセージログ**を保存します。

**特徴**:
- **時系列**: メッセージが時系列順に保存される
- **永続化**: ディスクに保存されるため、再起動してもデータが残る
- **Consumer Group**: 複数のコンシューマーが同じメッセージを処理できる
- **ACK 機能**: メッセージの処理完了を通知できる

### データ構造

```
Stream: md:ticker
├── 1234567890-0: {exchange: "gmo", symbol: "BTC_JPY", price: 6123456, ...}
├── 1234567891-0: {exchange: "gmo", symbol: "BTC_JPY", price: 6123500, ...}
├── 1234567892-0: {exchange: "gmo", symbol: "BTC_JPY", price: 6123400, ...}
└── ...
```

各メッセージには**一意のID**（タイムスタンプ-シーケンス番号）が付与されます。

### Consumer Group

**Consumer Group** は、複数のコンシューマー（処理者）が同じ Stream を処理するための仕組みです。

```
Stream: md:ticker
│
├── Consumer Group: trading-engine-strategy
│   ├── Consumer: strategy-1 (処理中: 1234567890-0)
│   └── Consumer: strategy-2 (処理中: 1234567891-0)
│
└── Consumer Group: analytics-engine
    └── Consumer: analytics-1 (処理中: 1234567890-0)
```

**メリット**:
- **負荷分散**: 複数のコンシューマーで並列処理
- **取りこぼしゼロ**: 再起動時も未処理メッセージを再取得
- **複数の用途**: 同じデータを異なる用途で処理可能

### メッセージの処理フロー

1. **Producer（ws-collector-node）**: メッセージを Stream に追加（`XADD`）
2. **Consumer（trading-engine-strategy）**: Consumer Group でメッセージを取得（`XREADGROUP`）
3. **ACK**: 処理完了を通知（`XACK`）
4. **再取得**: 未ACKのメッセージを再取得可能（`XREADGROUP` with `>`）

---

## Redis Stream vs 他の選択肢

### 比較表

| 機能 | Redis Stream | Redis Pub/Sub | Kafka | RabbitMQ | PostgreSQL |
|------|-------------|---------------|-------|----------|------------|
| **低遅延** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **高スループット** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| **取りこぼしゼロ** | ✅ | ❌ | ✅ | ✅ | ✅ |
| **永続化** | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Consumer Group** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **運用の簡単さ** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **スケーラビリティ** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |

### Redis Pub/Sub との比較

**Redis Pub/Sub**:
- ✅ **非常に高速**: メッセージを即座に配信
- ❌ **取りこぼしあり**: コンシューマーが落ちている間のメッセージは失われる
- ❌ **永続化なし**: メッセージは保存されない

**Redis Stream**:
- ✅ **取りこぼしゼロ**: Consumer Group で未処理メッセージを保持
- ✅ **永続化**: ディスクに保存される
- ⚠️ **若干の遅延**: Pub/Sub より若干遅い（ただし、マイクロ秒単位）

**結論**: 市場データは「落としたら負ける系」なので、**Redis Stream が正解**です。

### Kafka との比較

**Kafka**:
- ✅ **非常に高いスループット**: 1秒間に数百万メッセージを処理可能
- ✅ **分散処理**: 複数ノードでクラスタリング可能
- ❌ **運用が複雑**: Zookeeper やクラスタ管理が必要
- ❌ **オーバースペック**: 本プロジェクトの規模には過剰

**Redis Stream**:
- ✅ **シンプル**: 単一ノードで動作、設定が簡単
- ✅ **十分な性能**: 本プロジェクトの要件（1秒数千件）には十分
- ⚠️ **スケーラビリティ**: 大規模な分散処理には不向き

**結論**: 本プロジェクトの規模では、**Redis Stream で十分**です。

### PostgreSQL との比較

**PostgreSQL**:
- ✅ **永続化**: データが確実に保存される
- ✅ **複雑なクエリ**: SQL で柔軟にデータを取得
- ❌ **遅延**: ディスクI/O のため、ミリ秒単位の遅延
- ❌ **スループット**: 高頻度の書き込みには不向き

**Redis Stream**:
- ✅ **低遅延**: メモリ上で動作するため、マイクロ秒単位
- ✅ **高スループット**: 1秒間に数万件のメッセージを処理可能
- ⚠️ **永続化**: オプションで有効化可能（AOF）

**結論**: **リアルタイム処理には Redis Stream、永続化には PostgreSQL** を使い分けます。

---

## RedisPublisher の役割

### 概要

`RedisPublisher` は、**正規化された市場データを Redis Stream に配信するコンポーネント**です。

### 責務

1. **正規化データの受け取り**: `NormalizedEvent` を受け取る
2. **Stream 名の決定**: イベントタイプ（trade/orderbook/ticker）に応じて Stream 名を決定
3. **メッセージの配信**: Redis Stream に `XADD` コマンドでメッセージを追加

### 実装例

```typescript
export class RedisPublisher implements EventPublisher {
  private readonly redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async publish(event: NormalizedEvent): Promise<void> {
    // イベントタイプに応じて Stream 名を決定
    const stream = this.getStreamName(event.type);

    // メッセージを Redis Stream に追加
    const payload = {
      exchange: event.exchange,
      symbol: event.symbol,
      ts: event.ts.toString(),
      data: JSON.stringify(event.data)
    };

    // XADD コマンドでメッセージを追加
    await this.redis.xadd(stream, '*', ...Object.entries(payload).flat());
  }

  private getStreamName(type: MarketDataType): string {
    switch (type) {
      case 'trade':
        return 'md:trade';
      case 'orderbook':
        return 'md:orderbook';
      case 'ticker':
        return 'md:ticker';
      default:
        return `md:${type}`;
    }
  }
}
```

### データフロー

```
GMO WebSocket
    ↓
GmoAdapter (正規化)
    ↓
MessageHandler
    ↓
RedisPublisher
    ↓
Redis Stream (md:ticker, md:orderbook, md:trade)
    ↓
trading-engine-strategy (Consumer Group で購読)
```

### Stream 名の規則

- `md:trade`: 約定情報
- `md:orderbook`: 板情報
- `md:ticker`: 最新レート

**命名規則**: `md:` プレフィックスは "market data" の略です。

---

## 実装例と使い方

### Producer 側（ws-collector-node）

```typescript
// RedisPublisher を使用してメッセージを配信
const publisher = new RedisPublisher('redis://redis:6379/0');

const event: NormalizedEvent = {
  type: 'ticker',
  exchange: 'gmo',
  symbol: 'BTC_JPY',
  ts: Date.now(),
  data: {
    last: 6123456,
    bid: 6123000,
    ask: 6124000,
    volume: 123.45
  }
};

await publisher.publish(event);
// → Redis Stream 'md:ticker' にメッセージが追加される
```

### Consumer 側（trading-engine-strategy）

```python
import redis

redis_client = redis.Redis(host='redis', port=6379, db=0)

# Consumer Group を作成（初回のみ）
try:
    redis_client.xgroup_create('md:ticker', 'trading-engine-strategy', id='0', mkstream=True)
except redis.exceptions.ResponseError:
    pass  # 既に存在する場合は無視

# Consumer Group でメッセージを購読
while True:
    messages = redis_client.xreadgroup(
        groupname='trading-engine-strategy',
        consumername='strategy-1',
        streams={'md:ticker': '>'},
        count=10,
        block=1000  # 1秒待機
    )

    for stream, message_list in messages:
        for message_id, data in message_list:
            # メッセージを処理
            process_ticker(data)

            # 処理完了を通知（ACK）
            redis_client.xack('md:ticker', 'trading-engine-strategy', message_id)
```

### メッセージの形式

Redis Stream に保存されるメッセージの形式：

```
Stream: md:ticker
Message ID: 1732312345123-0
Fields:
  - exchange: "gmo"
  - symbol: "BTC_JPY"
  - ts: "1732312345123"
  - data: '{"last":6123456,"bid":6123000,"ask":6124000,"volume":123.45}'
```

### 未処理メッセージの再取得

Consumer が再起動した場合、未処理（未ACK）のメッセージを再取得できます：

```python
# 未処理メッセージを取得
pending_messages = redis_client.xpending_range(
    name='md:ticker',
    groupname='trading-engine-strategy',
    min='-',
    max='+',
    count=100
)

for msg in pending_messages:
    # メッセージを再取得して処理
    messages = redis_client.xclaim(
        name='md:ticker',
        groupname='trading-engine-strategy',
        consumername='strategy-1',
        min_idle_time=60000,  # 60秒以上未処理のもの
        message_ids=[msg['message_id']]
    )

    for message_id, data in messages:
        process_ticker(data)
        redis_client.xack('md:ticker', 'trading-engine-strategy', message_id)
```

---

## 参考資料

- [Redis 公式ドキュメント](https://redis.io/docs/)
- [Redis Streams 公式ドキュメント](https://redis.io/docs/data-types/streams/)
- [Redis Streams チュートリアル](https://redis.io/docs/data-types/streams-tutorial/)
- [ioredis ドキュメント](https://github.com/redis/ioredis)
- [redis-py ドキュメント](https://redis-py.readthedocs.io/)

---

## まとめ

### Redis を使う理由

1. **低遅延**: メモリ上で動作するため、マイクロ秒単位の処理が可能
2. **高スループット**: 1秒間に数万件のメッセージを処理可能
3. **取りこぼしゼロ**: Consumer Group で未処理メッセージを保持
4. **シンプル**: Kafka などと比べて運用が簡単

### Redis Stream を使う理由

1. **時系列データ**: 市場データは時系列なので、Stream が最適
2. **永続化**: ディスクに保存されるため、再起動してもデータが残る
3. **Consumer Group**: 複数のコンシューマーで並列処理可能
4. **ACK 機能**: メッセージの処理完了を通知できる

### RedisPublisher の役割

- **正規化データの配信**: `NormalizedEvent` を Redis Stream に配信
- **Stream 名の決定**: イベントタイプに応じて適切な Stream を選択
- **シンプルなインターフェース**: `publish()` メソッドで簡単に配信可能

