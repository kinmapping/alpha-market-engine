# Docker マルチステージビルド解説

## 概要

`services/collector/Dockerfile` はマルチステージビルドを使用して、開発・テスト用と本番用の2つのイメージを提供します。

## マルチステージビルドとは

マルチステージビルドは、1つの Dockerfile 内で複数のビルドステージを定義し、各ステージで異なる目的のイメージを構築する手法です。

### メリット

1. **イメージサイズの最適化**
   - 開発依存関係（テストツールなど）を本番イメージから除外
   - 不要なファイル（テストコードなど）を本番イメージに含めない

2. **セキュリティの向上**
   - 本番環境にテストコードや開発ツールを含めない
   - 攻撃面の削減

3. **ビルド効率の向上**
   - 共通のステージを再利用可能
   - キャッシュの効率的な利用

4. **単一 Dockerfile での管理**
   - 開発用と本番用の Dockerfile を分ける必要がない
   - メンテナンスが容易

## 実装詳細

### Stage 1: `development`（開発・テスト用）

```dockerfile
FROM node:24.11.1-trixie-slim AS development

# ... (依存関係のインストール) ...

COPY tests ./tests  # テストファイルを含む

# 開発依存関係も含む
RUN npm install
```

**特徴**:
- `tests/` ディレクトリを含む
- 開発依存関係（`devDependencies`）を含む
- テスト実行が可能

**使用例**:
```bash
# docker-compose.local.yml で使用
docker-compose -f docker-compose.local.yml build collector
docker-compose -f docker-compose.local.yml exec collector npm run test:unit
```

### Stage 2: `production`（本番用）

```dockerfile
FROM node:24.11.1-trixie-slim AS production

# ... (依存関係のインストール) ...

# tests/ はコピーしない（本番環境では不要）

# 開発依存関係を削除
RUN npm install && \
    npm prune --production
```

**特徴**:
- `tests/` ディレクトリを含まない
- 開発依存関係を削除（`npm prune --production`）
- イメージサイズが小さい

**使用例**:
```bash
# 本番環境でビルド
docker build --target production -t collector:prod ./services/collector
```

## 使用方法

### 開発環境（docker-compose.local.yml）

```yaml
collector:
  build:
    context: ./services/collector
    dockerfile: Dockerfile
    target: development  # 開発・テスト用ステージを指定
```

### 本番環境

```yaml
# docker-compose.prod.yml など
collector:
  build:
    context: ./services/collector
    dockerfile: Dockerfile
    target: production  # 本番用ステージを指定
```

または、直接ビルド：

```bash
docker build --target production -t collector:prod ./services/collector
```

## イメージサイズの比較

### development ステージ
- テストファイルを含む
- 開発依存関係を含む
- サイズ: 約 XXX MB（例）

### production ステージ
- テストファイルを含まない
- 開発依存関係を削除
- サイズ: 約 YYY MB（例、development より小さい）

## ベストプラクティス

1. **デフォルトステージの指定**
   - `docker-compose.local.yml` では `target: development` を明示
   - 本番環境では `target: production` を明示

2. **キャッシュの活用**
   - 依存関係のインストールは早期のステージで実行
   - 頻繁に変更されるファイル（`src/`, `tests/`）は後でコピー

3. **セキュリティ**
   - 本番イメージには機密情報を含めない
   - テストコードや開発ツールを含めない

4. **メンテナンス**
   - 共通の処理は可能な限り共有
   - 各ステージの目的を明確にする

## トラブルシューティング

### テストファイルが見つからない

**問題**: コンテナ内でテストを実行すると `No test files found` エラー

**原因**: `production` ステージを使用している、または `tests/` がコピーされていない

**解決策**:
- `docker-compose.local.yml` で `target: development` を指定
- または、`development` ステージでビルド

### イメージサイズが大きい

**問題**: 本番イメージが大きすぎる

**原因**: `development` ステージを使用している、または `npm prune --production` が実行されていない

**解決策**:
- 本番環境では `target: production` を指定
- `npm prune --production` が正しく実行されているか確認

## 参考資料

- [Docker マルチステージビルド公式ドキュメント](https://docs.docker.com/build/building/multi-stage/)
- [Node.js ベストプラクティス](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md)

