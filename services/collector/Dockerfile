# ============================================================================
# Stage 1: 開発・テスト用ビルド
# ============================================================================
FROM node:24.11.1-trixie-slim AS development

WORKDIR /app

# Debian パッケージの脆弱性を修正
RUN apt-get update && apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

# Node.js の npm パッケージの脆弱性を修正するため、最新の npm に更新
RUN npm install -g npm@latest

COPY package.json ./
# package-lock.json を削除して overrides を確実に適用
RUN rm -f package-lock.json && \
    npm install

COPY tsconfig.json ./tsconfig.json
COPY vitest.config.ts ./vitest.config.ts
COPY src ./src
# テストファイルを含む（開発・テスト用）
COPY tests ./tests

# ビルドは型チェック用（dist/ は使わない）
RUN npm run build

# tsx で直接 src/main.ts を実行（パスエイリアスを解決）
# tsx は dependencies に含まれているため、npm prune で削除されない
CMD ["npx", "tsx", "src/main.ts"]

# ============================================================================
# Stage 2: 本番用ビルド（軽量化）
# ============================================================================
FROM node:24.11.1-trixie-slim AS production

WORKDIR /app

# Debian パッケージの脆弱性を修正
RUN apt-get update && apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

# Node.js の npm パッケージの脆弱性を修正するため、最新の npm に更新
RUN npm install -g npm@latest

COPY package.json ./
# package-lock.json を削除して overrides を確実に適用
RUN rm -f package-lock.json && \
    npm install && \
    npm prune --production  # 開発依存関係を削除してイメージサイズを削減

COPY tsconfig.json ./tsconfig.json
COPY src ./src
# tests/ はコピーしない（本番環境では不要）

# ビルドは型チェック用（dist/ は使わない）
RUN npm run build

# tsx で直接 src/main.ts を実行（パスエイリアスを解決）
# tsx は dependencies に含まれているため、npm prune で削除されない
CMD ["npx", "tsx", "src/main.ts"]

