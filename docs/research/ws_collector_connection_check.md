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

