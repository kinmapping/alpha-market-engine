確認方法と確認項目をまとめ

## strategy-module の動作確認方法と確認項目

### 1. Redis への接続成功

#### 確認方法
**ログ確認**:
```bash
docker-compose -f docker-compose.local.yml logs strategy-module | grep "Connected to Redis"
```

**期待されるログ**:
```
2025-12-13 15:08:52 - infrastructure.redis.consumer - INFO - Connected to Redis: redis://redis:6379/0
2025-12-13 15:08:52 - infrastructure.redis.publisher - INFO - Connected to Redis: redis://redis:6379/0
```

**確認項目**:
- [x] Consumer と Publisher の両方が接続成功している
- [x] 接続URLが正しい（`redis://redis:6379/0`）
- [x] エラーメッセージがない

**Redis CLI での確認**:
```bash
docker-compose -f docker-compose.local.yml exec redis redis-cli PING
# 期待値: PONG
```
- [x] 期待値: `PONG` がレスポンスされる

---

### 2. Consumer Group の作成成功

#### 確認方法
**ログ確認**:
```bash
docker-compose -f docker-compose.local.yml up -d strategy-module && sleep 5 && docker-compose -f docker-compose.local.yml logs strategy-module | grep -E "Created consumer group|Consumer group already exists"
```

**期待されるログ**:
```
 ✔ Container redis            Running                                                                                                                                                                                                                                           0.0s
 ✔ Container strategy-module  Running                                                                                                                                                                                                                                           0.0s
strategy-module  | 2025-12-13 15:26:59 - infrastructure.redis.consumer - INFO - Consumer group already exists: strategy-module for stream: md:ticker
strategy-module  | 2025-12-13 15:26:59 - infrastructure.redis.consumer - INFO - Consumer group already exists: strategy-module for stream: md:orderbook
strategy-module  | 2025-12-13 15:26:59 - infrastructure.redis.consumer - INFO - Consumer group already exists: strategy-module for stream: md:trade
```

**確認項目**:
- [x] 3つのStream（`md:ticker`, `md:orderbook`, `md:trade`）すべてでConsumer Groupが作成されている
- [x] Consumer Group名が `strategy-module` である
- [x] エラーメッセージがない（既に存在する場合は `BUSYGROUP` エラーは無視される）

**Redis CLI での確認**:
```bash
# Consumer Group の存在確認
docker-compose -f docker-compose.local.yml exec redis redis-cli XINFO GROUPS md:ticker
docker-compose -f docker-compose.local.yml exec redis redis-cli XINFO GROUPS md:orderbook
docker-compose -f docker-compose.local.yml exec redis redis-cli XINFO GROUPS md:trade
```

**期待される出力例**:
```
1) name: strategy-module
2) consumers: 1
3) pending: 0
4) last-delivered-id: 1734123456789-0
```

---

### 3. Redis Stream からのメッセージ購読成功

#### 確認方法
**ログ確認**:
```bash
docker-compose -f docker-compose.local.yml logs strategy-module | grep "Starting to consume"
```

**期待されるログ**:
```
2025-12-13 15:08:52 - infrastructure.redis.consumer - INFO - Starting to consume from Redis Streams: group=strategy-module, consumer=strategy-1, streams=['md:ticker', 'md:orderbook', 'md:trade']
```

**確認項目**:
- [ ] Consumer Group名が `strategy-module` である
- [ ] Consumer名が `strategy-1` である
- [ ] 3つのStream（`md:ticker`, `md:orderbook`, `md:trade`）を購読している
- [ ] メッセージ処理のログが継続的に出力されている（エラーがない）

**Redis CLI での確認**:
```bash
# 未処理メッセージの確認（Pending List）
docker-compose -f docker-compose.local.yml exec redis redis-cli --json XPENDING md:ticker strategy-module
docker-compose -f docker-compose.local.yml exec redis redis-cli --json XPENDING md:trade strategy-module

# Consumer の状態確認
docker-compose -f docker-compose.local.yml exec redis redis-cli --json XINFO CONSUMERS md:ticker strategy-module
```
オプションで出力形式を変更できます。

**期待される動作**:
- `XPENDING` の結果が `0` または少ない値（メッセージが正常に処理されている）
- Consumer が `strategy-1` として表示される

---

### 4. 移動平均クロス戦略によるシグナル生成

#### 確認方法
**ログ確認**:
```bash
docker-compose -f docker-compose.local.yml logs strategy-module | grep -E "Golden cross|Dead cross|Generated signal"
```

**期待されるログ**:
```
2025-12-13 15:08:52 - infrastructure.strategies.moving_average_cross - INFO - Golden cross detected: symbol=BTC_JPY, fast_ma=13651572.80, slow_ma=13646593.15
2025-12-13 15:08:52 - application.usecases.strategy.signal_generator - INFO - Generated signal: symbol=BTC_JPY, action=enter_long, confidence=0.7

2025-12-13 15:08:52 - infrastructure.strategies.moving_average_cross - INFO - Dead cross detected: symbol=BTC_JPY, fast_ma=13645026.80, slow_ma=13648399.95
2025-12-13 15:08:52 - application.usecases.strategy.signal_generator - INFO - Generated signal: symbol=BTC_JPY, action=exit, confidence=0.7
```

**確認項目**:
- [ ] ゴールデンクロス（`Golden cross`）が検出されている
- [ ] デッドクロス（`Dead cross`）が検出されている
- [ ] シグナルが生成されている（`Generated signal`）
- [ ] `action` が正しい（`enter_long`, `exit` など）
- [ ] `confidence` が設定されている（0.0-1.0）
- [ ] シンボルが正しい（`BTC_JPY` など）

**詳細ログ確認（DEBUG レベル）**:
```bash
# 環境変数を変更して再起動
LOG_LEVEL=DEBUG docker-compose -f docker-compose.local.yml up strategy-module
```

---

### 5. シグナルの Redis Stream への配信

#### 確認方法
**ログ確認**:
```bash
docker-compose -f docker-compose.local.yml logs strategy-module | grep "Published signal"
```

**期待されるログ**:
```
2025-12-13 15:08:52 - application.services.signal_publisher - INFO - Published signal: exchange=gmo, symbol=BTC_JPY, strategy=moving_average_cross, action=enter_long
2025-12-13 15:08:52 - application.services.signal_publisher - INFO - Published signal: exchange=gmo, symbol=BTC_JPY, strategy=moving_average_cross, action=exit
```

**確認項目**:
- [ ] シグナルが配信されている（`Published signal`）
- [ ] `exchange`, `symbol`, `strategy`, `action` が正しい
- [ ] エラーメッセージがない

**Redis CLI での確認**:
```bash
# シグナル Stream の確認
docker-compose -f docker-compose.local.yml exec redis redis-cli XINFO STREAM signal:gmo:BTC_JPY

# 最新のシグナルメッセージを取得
docker-compose -f docker-compose.local.yml exec redis redis-cli XREVRANGE signal:gmo:BTC_JPY + - COUNT 5
```

**期待される出力例**:
```
1) 1) "1734123456789-0"
   2) 1) "exchange"
      2) "gmo"
      3) "symbol"
      4) "BTC_JPY"
      5) "strategy"
      6) "moving_average_cross"
      7) "action"
      8) "enter_long"
      9) "confidence"
     10) "0.7"
     11) "price_ref"
     12) "13651572.80"
```

---

## 総合的な確認コマンド

### 1. ログの一括確認
```bash
# すべてのログを確認
docker-compose -f docker-compose.local.yml logs -f strategy-module

# エラーのみ確認
docker-compose -f docker-compose.local.yml logs strategy-module | grep -i error

# 重要なイベントのみ確認
docker-compose -f docker-compose.local.yml logs strategy-module | grep -E "Connected|Created consumer group|Starting to consume|Generated signal|Published signal"
```

### 2. Redis の状態確認
```bash
# Stream の一覧確認
docker-compose -f docker-compose.local.yml exec redis redis-cli KEYS "*"

# 各Streamのメッセージ数を確認
docker-compose -f docker-compose.local.yml exec redis redis-cli XLEN md:ticker
docker-compose -f docker-compose.local.yml exec redis redis-cli XLEN md:trade
docker-compose -f docker-compose.local.yml exec redis redis-cli XLEN signal:gmo:BTC_JPY
```

### 3. メトリクス確認
```bash
# 処理されたメッセージ数の確認
docker-compose -f docker-compose.local.yml logs strategy-module | grep "Generated signal" | wc -l

# 配信されたシグナル数の確認
docker-compose -f docker-compose.local.yml logs strategy-module | grep "Published signal" | wc -l

# クロス検出回数の確認
docker-compose -f docker-compose.local.yml logs strategy-module | grep -E "Golden cross|Dead cross" | wc -l
```

---

## 正常動作の判定基準

以下がすべて満たされていれば正常動作と判断できます：

1. **接続**: Consumer と Publisher の両方が Redis に接続成功
2. **Consumer Group**: 3つのStreamすべてでConsumer Groupが作成されている
3. **購読**: メッセージが継続的に処理されている（エラーがない）
4. **シグナル生成**: ゴールデンクロス/デッドクロスが検出され、シグナルが生成されている
5. **配信**: 生成されたシグナルが Redis Stream に配信されている
6. **エラーなし**: エラーログが出力されていない

これらの確認方法で、strategy-module の動作を検証できます。