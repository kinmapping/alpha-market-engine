# Redis Stream Pending メッセージのクリーンアップ方法

## 問題

Consumer Group を使用している場合、処理されなかったメッセージが pending リストに残り続けることがあります。これは以下の原因で発生します：

1. メッセージを取得したが、ACK を送信しなかった
2. エラーが発生して処理が中断された
3. Consumer がクラッシュした
4. **Consumer Group を再作成しても、既存の pending メッセージは自動的には削除されない**

## 確認方法

### Pending メッセージの確認

```bash
# Pending メッセージ数を確認
docker-compose -f docker-compose.local.yml exec redis redis-cli --json XPENDING md:ticker strategy

# 古い pending メッセージの詳細を確認
docker-compose -f docker-compose.local.yml exec redis redis-cli XPENDING md:ticker strategy - + 10
```

### Pending メッセージの内容確認

```bash
# 特定のメッセージIDの詳細を確認
docker-compose -f docker-compose.local.yml exec redis redis-cli XPENDING md:ticker strategy - + 10
```

## 解決方法

### オプション1: Consumer Group を削除して再作成（推奨：開発環境）

**重要**: Consumer Group を再作成しても、既存の pending メッセージは自動的には削除されません。しかし、`id="$"` を使用することで、新しいメッセージのみを読み取るようになります。

```bash
# Consumer Group を削除
docker-compose -f docker-compose.local.yml exec redis redis-cli XGROUP DESTROY md:ticker strategy
docker-compose -f docker-compose.local.yml exec redis redis-cli XGROUP DESTROY md:orderbook strategy
docker-compose -f docker-compose.local.yml exec redis redis-cli XGROUP DESTROY md:trade strategy

# strategy を再起動（Consumer Group が自動的に再作成される）
# 注意: 現在の実装では id="$" を使用しているため、新しいメッセージのみを読み取る
docker-compose -f docker-compose.local.yml restart strategy
```

**注意**: 既存の pending メッセージは残り続けますが、新しいメッセージのみが処理されます。

### オプション2: 古い Pending メッセージを明示的にクリア

```bash
# XCLAIM を使用してメッセージを別の Consumer に移す（実質的にクリア）
# 注意: この方法はメッセージを再処理しません

# または、Consumer Group を削除して再作成（すべての pending がクリアされる）
docker-compose -f docker-compose.local.yml exec redis redis-cli XGROUP DESTROY md:ticker strategy
docker-compose -f docker-compose.local.yml exec redis redis-cli XGROUP CREATE md:ticker strategy $ MKSTREAM
```

### オプション3: 古い Pending メッセージを再処理

```bash
# XCLAIM を使用してメッセージを再処理キューに戻す
docker-compose -f docker-compose.local.yml exec redis redis-cli XCLAIM md:ticker strategy strategy-1 0 1764090790374-0
```

### オプション4: すべての Pending メッセージを ACK する（再処理不要な場合）

```bash
# スクリプトを使用して、すべての pending メッセージを ACK する
# 注意: この方法はメッセージを再処理しません

# Python スクリプトの例
python3 << 'EOF'
import redis
r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
stream = 'md:ticker'
group = 'strategy'
consumer = 'strategy-1'

# すべての pending メッセージを取得
pending = r.xpending_range(stream, group, min='-', max='+', count=10000)

# すべての pending メッセージを ACK
for msg in pending:
    message_id = msg['message_id']
    r.xack(stream, group, message_id)
    print(f"ACKed: {message_id}")

print(f"Total ACKed: {len(pending)}")
EOF
```

## 推奨される対処方法

### 一時的な解決（開発環境）

```bash
# Consumer Group を削除して再作成
docker-compose -f docker-compose.local.yml exec redis redis-cli XGROUP DESTROY md:ticker strategy
docker-compose -f docker-compose.local.yml exec redis redis-cli XGROUP DESTROY md:orderbook strategy
docker-compose -f docker-compose.local.yml exec redis redis-cli XGROUP DESTROY md:trade strategy

# strategy を再起動（Consumer Group が自動的に再作成される）
# 注意: id="$" を使用しているため、新しいメッセージのみを読み取る
docker-compose -f docker-compose.local.yml restart strategy
```

### 本番環境での推奨方法

1. **Pending メッセージの監視**: 定期的に pending メッセージ数を監視
2. **自動クリーンアップ**: 一定時間以上 idle しているメッセージを自動的にクリア
3. **再処理機能**: 重要なメッセージの場合は再処理機能を実装

## 予防策

1. **ACK の確実な送信**: エラー時にも ACK を送信する（現在実装済み）
2. **エラーハンドリング**: エラーが発生した場合の適切な処理
3. **監視**: Pending メッセージ数の監視とアラート
4. **Consumer Group の作成**: `id="$"` を使用して、新しいメッセージのみを読み取る（現在実装済み）

## 重要な注意点

- **Consumer Group を削除・再作成しても、既存の pending メッセージは完全にクリアされません**
  - これは Redis Stream の仕様によるものです
  - Consumer Group を削除すると、その時点での pending リストは削除されますが、再作成後に古いメッセージが pending リストに再追加される可能性があります
- `id="$"` を使用すると、新しいメッセージのみを読み取るようになりますが、既存の pending メッセージは残り続けます
- **既存の pending メッセージを完全にクリアするには、明示的に ACK する必要があります**

## 完全なクリーンアップ方法（推奨）

### 方法1: スクリプトを使用してすべての pending メッセージを ACK する（最も簡単）

```bash
# 単一の Stream の pending メッセージを ACK
./scripts/clear_redis_pending.sh md:ticker strategy ack-all

# すべての Stream の pending メッセージを ACK
./scripts/clear_redis_pending.sh '' '' ack-all-streams
```

**実行例**:
```bash
# md:ticker の pending メッセージを確認
./scripts/clear_redis_pending.sh md:ticker strategy check

# md:ticker の pending メッセージをすべて ACK
./scripts/clear_redis_pending.sh md:ticker strategy ack-all

# 確認: pending メッセージ数が 0 になっていることを確認
./scripts/clear_redis_pending.sh md:ticker strategy check
```

### 方法2: Python スクリプトを直接実行する

```bash
# strategy コンテナ内で実行
docker-compose -f docker-compose.local.yml exec strategy python3 - << 'EOF'
import redis
r = redis.Redis(host='redis', port=6379, db=0, decode_responses=True)
stream = 'md:ticker'
group = 'strategy'

pending = r.xpending_range(stream, group, min='-', max='+', count=100000)
print(f"Found {len(pending)} pending messages. ACKing all...")

acked = 0
for msg in pending:
    r.xack(stream, group, msg['message_id'])
    acked += 1
    if acked % 1000 == 0:
        print(f"  ACKed {acked}/{len(pending)} messages...")

print(f"Successfully ACKed {acked} messages.")
EOF
```

### 方法3: Redis CLI を使用して手動で ACK する（大量のメッセージがある場合）

```bash
# 注意: 大量のメッセージがある場合は時間がかかります
# まず、pending メッセージ数を確認
docker-compose -f docker-compose.local.yml exec redis redis-cli --json XPENDING md:ticker strategy

# すべての pending メッセージを取得して ACK（バッチ処理）
# 注意: この方法は大量のメッセージがある場合に効率的です
```
