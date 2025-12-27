# collector 接続確認方法

collector が GMO コインの WebSocket API に正常に接続し、データを Redis Stream に配信しているかを確認する方法。

## 目次

1. [ログで確認](#ログで確認)
2. [Redis Stream で確認](#redis-stream-で確認)
3. [Stream の統計情報を確認](#stream-の統計情報を確認)
4. [リアルタイム監視](#リアルタイム監視)
5. [トラブルシューティング](#トラブルシューティング)

---

## ログで確認

### redis コンテナのログを確認

```
1:C 25 Nov 2025 21:53:39.640 * oO0OoO0OoO0Oo Redis is starting oO0OoO0OoO0Oo
1:C 25 Nov 2025 21:53:39.640 * Redis version=7.4.7, bits=64, commit=00000000, modified=0, pid=1, just started
1:C 25 Nov 2025 21:53:39.640 * Configuration loaded
1:M 25 Nov 2025 21:53:39.640 * monotonic clock: POSIX clock_gettime
1:M 25 Nov 2025 21:53:39.642 * Running mode=standalone, port=6379.
1:M 25 Nov 2025 21:53:39.642 * Server initialized
1:M 25 Nov 2025 21:53:39.643 * Reading RDB base file on AOF loading...
1:M 25 Nov 2025 21:53:39.643 * Loading RDB produced by version 7.4.7
1:M 25 Nov 2025 21:53:39.643 * RDB age 17189 seconds
1:M 25 Nov 2025 21:53:39.643 * RDB memory usage when created 0.94 Mb
1:M 25 Nov 2025 21:53:39.643 * RDB is base AOF
1:M 25 Nov 2025 21:53:39.643 * Done loading RDB, keys loaded: 0, keys expired: 0.
1:M 25 Nov 2025 21:53:39.643 * DB loaded from base file appendonly.aof.1.base.rdb: 0.001 seconds
1:M 25 Nov 2025 21:53:39.645 * DB loaded from incr file appendonly.aof.1.incr.aof: 0.001 seconds
1:M 25 Nov 2025 21:53:39.645 * DB loaded from append only file: 0.002 seconds
1:M 25 Nov 2025 21:53:39.645 * Opening AOF incr file appendonly.aof.1.incr.aof on server start
1:M 25 Nov 2025 21:53:39.645 * Ready to accept connections tcp
1:M 25 Nov 2025 21:58:40.042 * 100 changes in 300 seconds. Saving...
1:M 25 Nov 2025 21:58:40.045 * Background saving started by pid 22
22:C 25 Nov 2025 21:58:40.059 * DB saved on disk
22:C 25 Nov 2025 21:58:40.059 * Fork CoW for RDB: current 0 MB, peak 0 MB, average 0 MB
1:M 25 Nov 2025 21:58:40.156 * Background saving terminated with success
```

### リアルタイムでログを監視

```bash
docker-compose -f docker-compose.local.yml logs -f collector
```

### 最新のログを確認

```bash
# 最新50行を確認
docker-compose -f docker-compose.local.yml logs collector --tail=50

# 最新100行を確認
docker-compose -f docker-compose.local.yml logs collector --tail=100
```

### 成功のサイン

- エラーメッセージがない
- `Invalid URL` エラーが出ていない
- 再接続のエラーが繰り返されていない
- WebSocket 接続成功のメッセージがある（実装による）

### 失敗のサイン

- `SyntaxError: Invalid URL:` が繰り返し表示される
  - → 環境変数 `WS_PUBLIC_URL` が正しく設定されていない
- `Reconnect attempt failed` が繰り返し表示される
  - → WebSocket 接続に失敗している
- `Redis connection error` が表示される
  - → Redis への接続に失敗している

---

## Redis Stream で確認（最も確実）

### Stream の存在確認

```bash
# すべての Stream を確認
docker exec redis redis-cli KEYS "md:*"
```

**期待される結果**:
```
md:ticker
md:orderbook
md:trade
```

### データの確認

#### ticker データ（最新レート）

```bash
# 最新5件を確認
docker exec redis redis-cli XREAD COUNT 5 STREAMS md:ticker 0
```

**期待される結果の例**:
```
1) 1) "md:ticker"
   2) 1) 1) "1764090790374-0"
         2) 1) "exchange"
             2) "gmo"
             3) "symbol"
             4) "BTC_JPY"
             5) "ts"
             6) "1764090790358"
             7) "data"
             8) "{\"last\":\"13634367\",\"bid\":\"13629789\",\"ask\":\"13634367\",\"volume\":\"1224.327\"}"
```

#### orderbook データ（板情報）

```bash
# 最新5件を確認
docker exec redis redis-cli XREAD COUNT 5 STREAMS md:orderbook 0
```

#### trade データ（約定情報）

```bash
# 最新5件を確認
docker exec redis redis-cli XREAD COUNT 5 STREAMS md:trade 0
```

### 成功のサイン

- `md:ticker`, `md:orderbook`, `md:trade` が存在する
- データが継続的に流れている（タイムスタンプが更新されている）
- `exchange` フィールドが `gmo` になっている
- `symbol` フィールドが設定したシンボル（例: `BTC_JPY`）になっている

---

## Stream の統計情報を確認

### Stream の詳細情報

```bash
# Stream の情報を確認
docker exec redis redis-cli XINFO STREAM md:ticker
```

**出力例**:
```
length 1234
first-entry 1764090790374-0 ...
last-entry 1764090795432-0 ...
```

### Stream の長さ（メッセージ数）を確認

```bash
# メッセージ数を確認
docker exec redis redis-cli XLEN md:ticker
docker exec redis redis-cli XLEN md:orderbook
docker exec redis redis-cli XLEN md:trade
```

**成功のサイン**:
- メッセージ数が増え続けている（時間経過とともに増加）

### Consumer Group の確認（使用している場合）

```bash
# Consumer Group の情報を確認
docker exec redis redis-cli XINFO GROUPS md:ticker
```

---

## リアルタイム監視

### リアルタイムでデータを監視

```bash
# 新しいメッセージをリアルタイムで監視（$ は最新のメッセージ以降）
docker exec -it redis redis-cli XREAD BLOCK 0 STREAMS md:ticker $
```

**動作**:
- 新しいメッセージが来るたびに表示される
- `Ctrl+C` で終了

### 複数の Stream を同時に監視

```bash
# ticker, orderbook, trade を同時に監視
docker exec -it redis redis-cli XREAD BLOCK 0 STREAMS md:ticker md:orderbook md:trade $ $ $
```

---

## トラブルシューティング

### 環境変数の確認

```bash
# コンテナ内の環境変数を確認
docker exec collector printenv | grep -E "(WS_PUBLIC_URL|SYMBOLS|REDIS_URL|EXCHANGE_NAME)"
```

**期待される結果**:
```
EXCHANGE_NAME=gmo
WS_PUBLIC_URL=wss://api.coin.z.com/ws/public/v1
SYMBOLS=BTC_JPY
REDIS_URL=redis://redis:6379/0
```

### コンテナの状態確認

```bash
# コンテナの状態を確認
docker-compose -f docker-compose.local.yml ps

# コンテナが起動しているか確認
docker ps | grep collector
```

### Redis への接続確認

```bash
# Redis が起動しているか確認
docker exec redis redis-cli PING
```

**期待される結果**: `PONG`

### よくある問題と解決方法

#### 1. `Invalid URL` エラー

**原因**: `WS_PUBLIC_URL` が空または不正

**解決方法**:
```bash
# docker-compose.local.yml の environment セクションを確認
# WS_PUBLIC_URL が正しく設定されているか確認
WS_PUBLIC_URL: ${WS_PUBLIC_URL:-wss://api.coin.z.com/ws/public/v1}
```

#### 2. Redis にデータが流れない

**原因**: Redis への接続失敗、または Publisher のエラー

**解決方法**:
```bash
# Redis の接続を確認
docker exec redis redis-cli PING

# collector のログでエラーを確認
docker-compose -f docker-compose.local.yml logs collector
```

#### 3. Stream が存在しない

**原因**: データがまだ配信されていない、または配信に失敗している

**解決方法**:
```bash
# コンテナを再起動
docker-compose -f docker-compose.local.yml restart collector

# 数秒待ってから Stream を確認
sleep 5
docker exec redis redis-cli KEYS "md:*"
```

---

## 確認チェックリスト

接続が正常に動作している場合、以下がすべて満たされているはずです:

- [ ] コンテナが起動している（`docker ps` で確認）
- [ ] ログにエラーがない（`docker-compose logs` で確認）
- [ ] 環境変数が正しく設定されている（`docker exec printenv` で確認）
- [ ] Redis に接続できる（`redis-cli PING` で確認）
- [ ] `md:ticker`, `md:orderbook`, `md:trade` が存在する（`KEYS md:*` で確認）
- [ ] データが継続的に流れている（`XREAD` で確認）
- [ ] メッセージ数が増え続けている（`XLEN` で確認）

---

## 参考資料

- [collector 設計](../architecture/02_collector.md)
- [GMOコイン API Documentation](https://api.coin.z.com/docs/)
- [Redis Streams ドキュメント](https://redis.io/docs/data-types/streams/)



## pino を使う

pino
- 爆速JSONログ
- 1イベント1行で後解析しやすい

WebSocket メッセージを Redis に流している部分でログを出す時に使用
留意事項として
- **データパスではなく観測パス** に置く

pino が担うべき役割として、何が起きたかを証拠として残す
- いつ接続したか
- なぜ接続が切れたか
- どれくらい流れているか
- どこで詰まったか
これを JSON で時系列に残す。

### 現在の状況

- `console.log`, `console.error`, `console.warn` を直接使用
- 手動でプレフィックス（例: `[GmoAdapter]`, `[WebSocketHandler]`）を付与
- 構造化ログなし（文字列結合のみ）
- ログレベル制御なし（環境変数での制御不可）

### pino 導入のメリット

1. **パフォーマンス**
   - 非同期I/Oで高速（特に本番環境）
   - JSON形式の構造化ログでパースが容易
   - メッセージのシリアライズが効率的

2. **構造化ログ**
  ```typescript
  // 現在
  console.error(`[GmoAdapter] socket error for ${this.symbol}:`, event);

  // pino
  logger.error({ symbol: this.symbol, event }, 'socket error');
  ```
  - メタデータを構造化して検索・集計しやすい
  - ログ集約ツール（ELK、Datadog など）との連携が容易

1. **ログレベル制御**
  ```typescript
  // 環境変数で制御可能
  LOG_LEVEL=debug npm run dev  // 開発時は詳細ログ
  LOG_LEVEL=warn npm start      // 本番は警告以上のみ
  ```
  - 環境ごとに出力レベルを切り替え可能
  - 本番では不要なデバッグログを抑制

1. **子ロガー（Child Logger）**
  ```typescript
  const adapterLogger = logger.child({ component: 'GmoAdapter', symbol: 'BTC_JPY' });
  adapterLogger.info('connected'); // 自動的にコンテキストが付与される
  ```
  - コンポーネントごとにコンテキストを付与
  - 手動プレフィックスが不要

1. **エラートラッキング**
  ```typescript
  logger.error({ err: error, symbol, wsUrl }, 'connection failed');
  // スタックトレースも自動的に構造化される
  ```
  - エラーオブジェクトを適切にシリアライズ
  - スタックトレースの構造化

1. **本番環境での最適化**
   - `pino-pretty` で開発時の可読性を維持
   - 本番では JSON 出力でパフォーマンス優先

### pino 導入のデメリット

1. **学習コスト・移行コスト**
   - 既存の `console.*` を置き換える必要がある（15箇所程度）
   - ロガーインスタンスの DI が必要
   - テストでのモック方法の変更

2. **依存関係の追加**
   - `pino` パッケージの追加（約 200KB）
   - 既に `winston` が依存に含まれているが未使用（削除推奨）

3. **開発時の可読性**
   - デフォルトは JSON 出力（開発時は読みにくい）
   - `pino-pretty` の導入が必要（開発時のみ）

4. **型安全性**
   - ログメタデータの型チェックが弱い（型定義は可能だが追加実装が必要）

5. **オーバーエンジニアリングの可能性**
   - 小規模プロジェクトでは過剰な可能性
   - ただし、リアルタイム取引システムではログの重要性が高い

### 推奨事項

**導入を推奨する理由**
1. リアルタイム取引システムではログの可観測性が重要
2. 複数シンボル・複数取引所対応時に構造化ログが有効
3. 本番環境でのパフォーマンス向上
4. ログ集約ツールとの連携が容易

### 実装方針
```typescript
// 1. ロガーをDI可能にする
// src/infra/logger/Logger.ts
export interface Logger {
  debug(msg: string, meta?: object): void;
  info(msg: string, meta?: object): void;
  warn(msg: string, meta?: object): void;
  error(msg: string, meta?: object): void;
}

// 2. pino実装を作成
// src/infra/logger/PinoLogger.ts
export class PinoLogger implements Logger { ... }

// 3. 環境変数で制御
const logger = process.env.NODE_ENV === 'production'
  ? new PinoLogger({ level: process.env.LOG_LEVEL || 'info' })
  : new PinoLogger({ level: 'debug', pretty: true });
```

### 段階的移行
1. Phase 1: ロガーインターフェースと pino 実装を作成
2. Phase 2: 新規コードから pino を使用
3. Phase 3: 既存の `console.*` を段階的に置き換え

結論: このプロジェクトでは pino の導入を推奨します。特に構造化ログとログレベル制御が、複数シンボル・複数取引所対応時に有効です。


### ログ出力ファイルについて

```typescript:services/collector/src/infra/logger/PinoLogger.ts
// 現在の実装
this.pinoLogger = pino({
  level,
  // destination が指定されていない = デフォルトで stdout に出力
});
```

現在は:
- 開発環境: `pino-pretty` で `stdout` に出力
- 本番環境: JSON形式で `stdout` に出力
- ファイル出力: 未実装

#### Docker環境での動作

Dockerコンテナで実行する場合:
- `stdout` への出力は `docker logs` で確認可能
- ログローテーションは Docker のログドライバーで管理可能

#### ファイル出力が必要な場合の実装案

ファイル出力が必要なら、以下のように実装できます：

```typescript
// PinoLogger.ts の修正案
constructor(options?: { level?: string; pretty?: boolean; destination?: string }) {
  const level = options?.level ?? process.env.LOG_LEVEL ?? 'info';
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const usePretty = options?.pretty ?? isDevelopment;
  const destination = options?.destination ?? process.env.LOG_FILE;

  const pinoOptions: pino.LoggerOptions = {
    level,
  };

  if (destination) {
    // ファイル出力を指定
    const destinationStream = pino.destination(destination);
    this.pinoLogger = pino(pinoOptions, destinationStream);
  } else if (usePretty) {
    // 開発環境: pino-pretty を使用
    this.pinoLogger = pino({
      ...pinoOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    });
  } else {
    // 本番環境: JSON 形式で stdout に出力
    this.pinoLogger = pino(pinoOptions);
  }
}
```

環境変数例:
```bash
LOG_FILE=/var/log/collector/app.log  # ファイル出力を指定
```

#### 推奨事項

Docker環境では:
- `stdout` への出力で十分（`docker logs` で確認可能）
- ログローテーションは Docker のログドライバーで管理
- ファイル出力が必要な場合のみ実装を追加

現時点ではファイル出力の実装は不要と判断できますが、必要に応じて上記の実装を追加できます。


## メトリクス集計

prom-client
- /metrics を作る
- 受信数/sec、Redis遅延、再接続回数を出せる