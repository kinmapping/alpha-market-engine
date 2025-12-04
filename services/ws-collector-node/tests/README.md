# ws-collector-node テスト

## 概要

ws-collector-node の動作確認を自動化するテストスイートです。

## テストの種類

### 単体テスト (`tests/unit/`)

個別のコンポーネントを独立してテストします。モックを使用して外部依存を排除します。

**テストファイルは `src` のディレクトリ構造に合わせて配置されています。**

#### Infrastructure層

- **reconnect/BackoffStrategy.test.ts**: 指数バックオフ戦略のテスト
  - 指数関数的な遅延計算
  - MAX_DELAY の上限チェック
  - reset() の動作確認

- **reconnect/ReconnectManager.test.ts**: 再接続管理のテスト
  - start() の動作確認
  - scheduleReconnect() の動作確認
  - stop() の動作確認
  - バックオフ戦略の適用

- **redis/RedisPublisher.test.ts**: Redis Stream への配信テスト
  - publish() の動作確認（ticker/orderbook/trade）
  - データの JSON シリアライズ確認
  - Redis接続エラーのハンドリング
  - Stream名の取得ロジック
  - close() の動作確認

- **adapters/gmo/GmoMessageParser.test.ts**: GMO メッセージパーサーのテスト
  - 正常系: ticker/orderbook/trade メッセージの正規化
  - エッジケース: 不正なタイムスタンプ、不正なデータ型、部分的なデータ欠損
  - エラーメッセージの処理
  - 未知のチャンネル、パースエラーの処理

- **adapters/gmo/GmoWebSocketClient.test.ts**: GMO WebSocket クライアントのテスト
  - WebSocket接続の確立（成功/失敗）
  - 購読リクエストの送信（レート制限対策含む）
  - メッセージのパース（string/ArrayBuffer/Blob対応）
  - 接続の切断

- **adapters/gmo/GmoAdapter.test.ts**: GMO アダプタのテスト
  - start(), connect(), disconnect() の動作確認
  - handleMessage() のエラーハンドリング
  - 再接続ロジックとの連携

- **websocket/WebSocketConnection.test.ts**: WebSocket接続ラッパーのテスト
  - イベントリスナーの管理
  - コールバックの登録と実行
  - WebSocket メソッドの呼び出し

#### Application層

- **application/MessageHandler.test.ts**: メッセージハンドラーのテスト
  - 正常系: パーサー→パブリッシャーのフロー
  - エッジケース: パーサーが null を返す場合
  - エラーハンドリング: パブリッシャーがエラーを投げる場合

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

### 単体テストのみ実行

```bash
npm run test:unit
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

### レベル1: 基本動作確認（統合テスト）

以下の項目が自動的に確認されます：

- ✅ `md:ticker`, `md:orderbook`, `md:trade` の3つのStreamが存在する
- ✅ 各Streamにデータが流れている
- ✅ 正規化されたデータ構造が正しい（`exchange`, `symbol`, `ts`, `data` フィールドが存在）
- ✅ タイムスタンプが適切に設定されている
- ✅ メッセージ数が増加している

### メッセージ正規化の確認（統合テスト）

- ✅ GMO API の ticker/orderbook/trade メッセージが正規化される
- ✅ エラーメッセージが適切に処理される
- ✅ 不正な形式のメッセージが適切に処理される

### ユニットテスト (`tests/unit/`)

#### Infrastructure層

- ✅ **reconnect/BackoffStrategy.test.ts** (11 tests)
  - 指数バックオフの計算ロジック
  - MAX_DELAY の上限チェック
  - reset() の動作確認

- ✅ **reconnect/ReconnectManager.test.ts** (16 tests)
  - start() の動作確認
  - scheduleReconnect() の動作確認
  - stop() の動作確認
  - バックオフ戦略の適用
  - エラーハンドリング
  - 統合的な動作確認

- ✅ **redis/RedisPublisher.test.ts** (17 tests)
  - publish() の動作確認（ticker/orderbook/trade）
  - データの JSON シリアライズ確認
  - Redis接続エラーのハンドリング
  - Stream名の取得ロジック
  - close() の動作確認
  - 複数のイベント配信
  - エッジケース: 特殊なデータ形式

- ✅ **adapters/gmo/GmoMessageParser.test.ts** (21 tests)
  - 正常系: ticker/orderbook/trade メッセージの正規化
  - エッジケース: 不正なタイムスタンプ、不正なデータ型、部分的なデータ欠損
  - エラーメッセージの処理
  - 未知のチャンネル、パースエラーの処理
  - 境界値テスト（大きな数値、負の数値、ゼロ値）

- ✅ **adapters/gmo/GmoWebSocketClient.test.ts** (14 tests)
  - connect() メソッド: WebSocket接続の成功/失敗シナリオ
  - subscribe() メソッド: 3つのチャンネルへの購読、レート制限対策
  - parseMessage() メソッド: string/ArrayBuffer/Blob 形式のパース、エラーハンドリング
  - disconnect() メソッド: 接続の切断処理

- ✅ **adapters/gmo/GmoAdapter.test.ts** (14 tests)
  - コンストラクタ、start(), connect(), disconnect() の動作確認
  - handleMessage() のエラーハンドリング（ERR-5003、channel がないメッセージなど）
  - 再接続ロジックとの連携

- ✅ **websocket/WebSocketConnection.test.ts** (15 tests)
  - StandardWebSocketConnection のイベントリスナー管理
  - onOpen/onMessage/onClose/onError のコールバック登録と実行
  - send/close/removeAllListeners/terminate メソッドの動作確認
  - 複数のコールバックの登録と実行順序

#### Application層

- ✅ **MessageHandler.test.ts** (9 tests)
  - 正常フロー（parser → publisher）
  - エッジケース（parser が null を返す場合）
  - エラーハンドリング（publisher がエラーを投げる場合）
  - 複数メッセージの処理

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

