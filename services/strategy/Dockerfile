FROM python:3.14-slim

WORKDIR /app

# システムパッケージの更新とビルド依存関係のインストール
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 共有エンティティをコピー（プロジェクトルートの shared/ から）
COPY shared/ /app/shared/

# Alembic をコピー（マイグレーション実行用）
COPY alembic/ /app/alembic/
COPY alembic.ini /app/alembic.ini

# モジュール固有のコードをコピー
COPY services/strategy/ /app/strategy/

# 作業ディレクトリを strategy に変更
WORKDIR /app/strategy

# 依存関係をインストール
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e .

# PYTHONPATH に shared/ を追加（strategy から shared を参照可能にする）
ENV PYTHONPATH=/app:/app/shared

# 起動スクリプトをコピー
COPY services/strategy/shells/start.sh /app/shells/start.sh
RUN chmod +x /app/shells/start.sh

# 起動スクリプトを実行
CMD ["/app/shells/start.sh"]

