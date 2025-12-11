FROM python:3.14-slim

WORKDIR /app

# システムパッケージの更新とビルド依存関係のインストール
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 共有エンティティをコピー（プロジェクトルートの shared/ から）
COPY shared/ /app/shared/

# モジュール固有のコードをコピー
COPY services/strategy_module/ /app/strategy_module/

# 作業ディレクトリを strategy_module に変更
WORKDIR /app/strategy_module

# 依存関係をインストール
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -e .

# PYTHONPATH に shared/ を追加（strategy_module から shared を参照可能にする）
ENV PYTHONPATH=/app:/app/shared

# メインエントリーポイントを実行
CMD ["python", "main.py"]

