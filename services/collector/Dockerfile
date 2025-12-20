FROM node:24.11.1-trixie-slim

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
COPY src ./src

# ビルドは型チェック用（dist/ は使わない）
RUN npm run build

# tsx で直接 src/main.ts を実行（パスエイリアスを解決）
# tsx は dependencies に含まれているため、npm prune で削除されない
CMD ["npx", "tsx", "src/main.ts"]

