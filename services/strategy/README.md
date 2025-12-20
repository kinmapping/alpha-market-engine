# Strategy Module

Strategy module は、Redis Stream から市場データを購読し、OHLCV生成、テクニカル指標計算、シグナル生成を行う Python サービスです。

## 機能

- **Redis Stream 購読**: `md:ticker`, `md:orderbook`, `md:trade` を Consumer Group で購読
- **OHLCV 生成**: 市場データから OHLCV（1秒/1分/5分など）を生成
- **指標計算**: pandas-ta を使用してテクニカル指標（MA、RSI、ボリンジャーバンド、MACD）を計算
- **シグナル生成**: 戦略ロジック（移動平均クロスなど）で売買シグナルを生成
- **シグナル配信**: 生成したシグナルを Redis Stream（`signal:*`）に配信

## セットアップ

### 依存関係のインストール

```bash
cd services/strategy
pip install -e ".[dev]"
```

### 環境変数の設定

環境変数は2つのファイルで管理します：

1. **プロジェクトルートの `.env`**（共有環境変数）
   - `REDIS_URL`, `LOG_LEVEL`, `SYMBOLS`, `DATABASE_URL` など、全サービスで共通の設定

2. **`services/strategy/.env`**（strategy 固有の環境変数）
   - `STRATEGY_NAME`, `ENABLE_HTTP`, `HTTP_PORT` など、strategy 固有の設定

**セットアップ手順**:

1. プロジェクトルートに共有環境変数ファイルを作成

```bash
# strategy 固有の環境変数ファイルを作成
cd services/strategy
cp env.example .env
# .env を編集して STRATEGY_NAME などを設定
```

**注意**: `.env` ファイルは `.gitignore` に含まれているため、Git にはコミットされません。

## 実行

### 開発環境での実行

```bash
python main.py
```

### Docker での実行

プロジェクトルートから以下のコマンドで起動します：

```bash
# ビルドと起動
docker-compose -f docker-compose.local.yml up --build strategy

# バックグラウンドで起動
docker-compose -f docker-compose.local.yml up -d strategy

# ログ確認
docker-compose -f docker-compose.local.yml logs -f strategy

# 停止
docker-compose -f docker-compose.local.yml stop strategy
```

### テストの実行

```bash
# 開発環境
pytest tests/integration/ -v

# Docker コンテナ内で実行
docker-compose -f docker-compose.local.yml exec strategy pytest tests/integration/ -v
```

## アーキテクチャ

レイヤードアーキテクチャを採用しています：

- **Domain 層**: エンティティクラス（`shared/domain/models/` から共有）
- **Application 層**: ユースケース（OHLCV生成、指標計算、シグナル生成）
- **Infrastructure 層**: Redis接続、データベース接続、戦略実装

詳細は `docs/architecture/03_strategy.md` を参照してください。


