# テスト実行前のセットアップ

## 前提条件

### 1. Redis の起動

統合テストを実行するには、Redis が起動している必要があります。

#### Docker Compose を使用する場合（推奨）

```bash
# プロジェクトルートから実行
cd /path/to/alpha-market-engine
docker-compose -f docker-compose.local.yml up -d redis
```

#### ローカルの Redis を使用する場合

```bash
# Redis がインストールされている場合
redis-server

# または Docker で単独起動
docker run -d -p 6379:6379 redis:7-alpine
```

### 2. 環境変数の設定（オプション）

デフォルトでは `redis://localhost:6379/0` に接続します。
別の Redis を使用する場合は環境変数を設定してください。

```bash
export REDIS_URL=redis://localhost:6379/0
```

## テストの実行

### すべてのテストを実行

```bash
cd services/ws-collector-node
npm test
```

### 統合テストのみ実行

```bash
npm run test:integration
```

### ウォッチモード（開発時）

```bash
npm run test:watch
```

## トラブルシューティング

### Redis に接続できない

エラー: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**解決方法**:
1. Redis が起動しているか確認: `docker ps | grep redis` または `redis-cli ping`
2. `REDIS_URL` 環境変数が正しく設定されているか確認

### テストがタイムアウトする

統合テストは実際の Redis に接続するため、ネットワークの問題でタイムアウトする可能性があります。

**解決方法**:
- `vitest.config.ts` の `testTimeout` を増やす（デフォルト: 30秒）
- Redis の接続を確認

