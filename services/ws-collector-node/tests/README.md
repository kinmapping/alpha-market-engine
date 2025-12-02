# ws-collector-node テスト

## 概要

ws-collector-node の動作確認を自動化するテストスイートです。

## テストの種類

### 統合テスト (`tests/integration/`)

実際の Redis に接続して、データ配信が正常に動作することを確認します。

- **redis-stream.test.ts**: Redis Stream へのデータ配信確認
  - Stream の存在確認（md:ticker, md:orderbook, md:trade）
  - データ配信確認
  - データ構造確認（正規化された形式）
  - Stream 長さの確認

- **message-normalization.test.ts**: メッセージ正規化の確認
  - GMO API メッセージの正規化
  - エラーハンドリング
  - データ型の確認

## 実行方法

### 前提条件

1. Redis が起動している必要があります
   ```bash
   # Docker Compose で起動
   docker-compose -f docker-compose.local.yml up -d redis

   # またはローカルの Redis が起動している
   redis-server
   ```

2. 環境変数が設定されている必要があります（オプション）
   ```bash
   export REDIS_URL=redis://localhost:6379/0
   ```

### すべてのテストを実行

```bash
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

## テストの確認項目

### レベル1: 基本動作確認

以下の項目が自動的に確認されます：

- ✅ `md:ticker`, `md:orderbook`, `md:trade` の3つのStreamが存在する
- ✅ 各Streamにデータが流れている
- ✅ 正規化されたデータ構造が正しい（`exchange`, `symbol`, `ts`, `data` フィールドが存在）
- ✅ タイムスタンプが適切に設定されている
- ✅ メッセージ数が増加している

### メッセージ正規化の確認

- ✅ GMO API の ticker/orderbook/trade メッセージが正規化される
- ✅ エラーメッセージが適切に処理される
- ✅ 不正な形式のメッセージが適切に処理される

## CI/CD での実行

GitHub Actions などの CI/CD 環境で実行する場合：

```yaml
# .github/workflows/test.yml の例
- name: Start Redis
  run: docker-compose -f docker-compose.local.yml up -d redis

- name: Run tests
  run: npm test
  env:
    REDIS_URL: redis://localhost:6379/0
```

## トラブルシューティング

### Redis に接続できない

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**解決方法**:
- Redis が起動しているか確認: `docker ps | grep redis`
- `REDIS_URL` 環境変数が正しく設定されているか確認

### テストがタイムアウトする

統合テストは実際の Redis に接続するため、ネットワークの問題でタイムアウトする可能性があります。

**解決方法**:
- `vitest.config.ts` の `testTimeout` を増やす（デフォルト: 30秒）
- Redis の接続を確認

## 参考資料

- [Vitest ドキュメント](https://vitest.dev/)
- [Redis Streams ドキュメント](https://redis.io/docs/data-types/streams/)
- [ws-collector-node 設計](../../docs/architecture/02_ws_collector_node.md)

