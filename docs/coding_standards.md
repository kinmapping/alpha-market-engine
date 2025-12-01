# コード規約

本プロジェクトの TypeScript/Node.js コード規約を定義します。

## 目次

1. [命名規則](#命名規則)
2. [ファイル構成](#ファイル構成)
3. [型定義](#型定義)
4. [インポート/エクスポート](#インポートエクスポート)
5. [コメント](#コメント)
6. [エラーハンドリング](#エラーハンドリング)
7. [レイヤードアーキテクチャ](#レイヤードアーキテクチャ)
8. [その他](#その他)

---

## 命名規則

### 定数

クラス内の定数（`readonly` フィールド）は **大文字スネークケース** を使用します。

```typescript
export class BackoffStrategy {
  private readonly BASE_DELAY = 1000; // 1秒
  private readonly MAX_DELAY = 30000; // 30秒
}

export class GmoWebSocketClient {
  private readonly SUBSCRIPTION_INTERVAL = 1000; // 1秒
}
```

### クラス名

**PascalCase** を使用します。

```typescript
export class GmoAdapter implements MarketDataAdapter { }
export class BackoffStrategy { }
export class RedisPublisher implements EventPublisher { }
```

### インターフェース名

**PascalCase** を使用します。インターフェース名は名詞または形容詞で始めます。

```typescript
export interface MarketDataAdapter { }
export interface MessageHandler { }
export interface EventPublisher { }
```

### 型エイリアス（Type Alias）

**PascalCase** を使用します。

```typescript
export type MarketDataType = 'trade' | 'orderbook' | 'ticker';
export type GmoRawMessage = { /* ... */ };
```

### 関数名・メソッド名

**camelCase** を使用します。動詞で始めることを推奨します。

```typescript
async function bootstrap(): Promise<void> { }
function requireEnv(key: string): string { }
async connect(): Promise<void> { }
getNextDelay(): number { }
```

### 変数名

**camelCase** を使用します。

```typescript
const publisher = new RedisPublisher(REDIS_URL);
const messageHandler = new DefaultMessageHandler(parser, publisher);
const adapters = SYMBOLS.split(',');
```

### プライベートメンバー

クラスのプライベートメンバーには `private` 修飾子を使用します。

```typescript
export class GmoAdapter {
  private connection: WebSocketConnection | null = null;
  private readonly reconnectManager: ReconnectManager;
  private readonly CONNECTION_DELAY = 500;
}
```

### ファイル名

- クラスファイル: **PascalCase**（例: `GmoAdapter.ts`, `BackoffStrategy.ts`）
- 型定義ファイル: **PascalCase**（例: `GmoRawMessage.ts`, `GmoCommand.ts`）
- ユーティリティファイル: **camelCase**（例: `utils.ts`）

---

## ファイル構成

### ディレクトリ構造

レイヤードアーキテクチャに基づいて、以下のディレクトリ構造を使用します。

```
src/
├── domain/              # ドメイン層: ビジネスロジックと型定義
│   └── types.ts
├── application/         # アプリケーション層: ビジネス操作の組み合わせ(ユースケース)と契約(インターフェース)
│   ├── interfaces/
│   └── handlers/
└── infrastructure/      # インフラ層: 外部システムとの連携
    ├── adapters/
    ├── redis/
    ├── reconnect/
    └── websocket/
```

### ファイルの責務

- **domain**:
  - ビジネスロジックに依存しない、純粋な型定義やドメインモデル
  - ビジネスルール・概念の定義
- **application**:
  - アプリケーションのユースケースとインターフェース(契約)定義
  - オーケストレーション(複数のドメインサービスやインフラコンポーネントを組み合わせて、1つのビジネス操作を実現する)
  - トランザクション管理(複数の操作を1つのトランザクションとして管理する)
  - 入力の検証・変換(外部からの入力を検証し、ドメイン層が扱える形式に変換する)
  - ワークフローの制御(「AをしてからBをする」といった順序や条件分岐を制御する)
  > アプリケーション層がやること
  > - 「正規化してから配信する」という流れを組み立てる
  > - エラーが起きた時の処理を決める
  > - ログを出力するタイミングを決める

- **infrastructure**:
  - 外部システム（WebSocket、Redis など）との連携実装
    - 外部システムとの接続
    - 外部システムからの受け取り(正規化)
    - 外部システムへの書き込み

---

## 型定義

### 型の明示

可能な限り型を明示します。TypeScript の `strict` モードを有効にしています。

```typescript
// 良い例
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

// 避けるべき例（型推論に任せすぎない）
function requireEnv(key) { // 型が不明確
  // ...
}
```

### 型エイリアス vs インターフェース

- **型エイリアス（`type`）**: ユニオン型、交差型、プリミティブ型の組み合わせに使用
- **インターフェース（`interface`）**: オブジェクトの形状を定義する場合に使用

```typescript
// 型エイリアス: ユニオン型
export type MarketDataType = 'trade' | 'orderbook' | 'ticker';

// インターフェース: オブジェクトの形状
export interface NormalizedEvent {
  type: MarketDataType;
  exchange: string;
  symbol: string;
  ts: number;
  data: unknown;
}
```

### `readonly` の使用

変更されないフィールドには `readonly` を付与します。

```typescript
export class GmoAdapter {
  private readonly reconnectManager: ReconnectManager;
  private readonly webSocketClient: GmoWebSocketClient;
  private readonly CONNECTION_DELAY = 500;
}
```

---

## インポート/エクスポート

### パスエイリアス

プロジェクトルートからの絶対パスには `@/` エイリアスを使用します。

```typescript
// 良い例
import { NormalizedEvent } from '@/domain/types';
import { MarketDataAdapter } from '@/application/interfaces/MarketDataAdapter';
import { MessageHandler } from '@/application/handlers/MessageHandler';

// 避けるべき例（相対パスが深くなる場合）
import { NormalizedEvent } from '../../../domain/types';
```

### 相対パス

同じディレクトリ内または近いディレクトリのファイルには相対パスを使用します。

```typescript
// 同じディレクトリ内
import { GmoWebSocketClient } from './GmoWebSocketClient';
import { GmoMessageParser } from './GmoMessageParser';

// 親ディレクトリ
import { BackoffStrategy } from '../reconnect/BackoffStrategy';
```

### 拡張子

- **パスエイリアス（`@/`）を使用する場合**: 拡張子を付けない
- **相対パスを使用する場合**: `.ts` 拡張子を付ける（TypeScript 5.9+ の `allowImportingTsExtensions` 設定により）

```typescript
// パスエイリアス（拡張子なし）
import { NormalizedEvent } from '@/domain/types';

// 相対パス（.ts 拡張子あり）
import { GmoWebSocketClient } from './GmoWebSocketClient.ts';
```

### エクスポート

- クラス、インターフェース、型は `export` を使用
- デフォルトエクスポートは使用しない（名前付きエクスポートを推奨）

```typescript
// 良い例
export class GmoAdapter { }
export interface MarketDataAdapter { }
export type MarketDataType = 'trade' | 'orderbook' | 'ticker';

// 避けるべき例
export default class GmoAdapter { }
```

---

## コメント

### JSDoc コメント

公開メソッド、クラス、インターフェースには JSDoc コメントを記述します。

```typescript
/**
 * インフラ層: MarketDataAdapter 実装
 *
 * 責務: GMO コインの WebSocket API を処理するアダプタ。
 * WebSocket 接続、購読、メッセージ受信、正規化、Redis への配信を統合する。
 */
export class GmoAdapter implements MarketDataAdapter {
  /**
   * GmoAdapter を初期化する。
   * @param symbol 取引ペア（例: 'BTC_JPY'）
   * @param wsUrl GMO コインの WebSocket エンドポイント URL
   * @param messageHandler メッセージ処理のハンドラ（正規化→配信を担当）
   */
  constructor(
    private readonly symbol: string,
    private readonly wsUrl: string,
    messageHandler: MessageHandler
  ) { }

  /**
   * 次の再接続までの遅延時間（ミリ秒）を取得する。
   * @returns 遅延時間（ミリ秒）
   */
  getNextDelay(): number {
    // ...
  }
}
```

### インラインコメント

複雑なロジックや意図が明確でない箇所にはインラインコメントを記述します。

```typescript
// レート制限対策: 各購読リクエストの間に 1秒の間隔を設ける
// GMO API のレート制限が厳しいため、間隔を長めに設定
for (let i = 0; i < channels.length; i++) {
  // ...
  if (i < channels.length - 1) {
    await new Promise((resolve) => setTimeout(resolve, this.SUBSCRIPTION_INTERVAL));
  }
}
```

---

## エラーハンドリング

### エラーの明示的な処理

エラーは可能な限り明示的に処理します。

```typescript
// 良い例
try {
  const message = JSON.parse(text) as GmoRawMessage;
  return message;
} catch (error) {
  console.error('[GmoWebSocketClient] failed to parse message:', error);
  return null;
}

// エラーメッセージの処理
if ('error' in rawMessage && typeof rawMessage.error === 'string') {
  console.error(`[GmoAdapter] API error: ${rawMessage.error}`);
  return;
}
```

### エラーログ

エラーログにはコンテキスト情報（クラス名、メソッド名など）を含めます。

```typescript
console.error('[GmoWebSocketClient] failed to parse message:', error);
console.error(`[GmoAdapter] API error: ${rawMessage.error}`);
console.warn(`[GmoAdapter] socket closed for ${this.symbol}`);
```

---

## レイヤードアーキテクチャ

### レイヤーの責務

各レイヤーは以下の責務を持ちます。

#### Domain 層

- ビジネスロジックに依存しない、純粋な型定義
- ドメインモデル（エンティティ、値オブジェクト）

```typescript
// domain/types.ts
export type MarketDataType = 'trade' | 'orderbook' | 'ticker';
export interface NormalizedEvent {
  type: MarketDataType;
  exchange: string;
  symbol: string;
  ts: number;
  data: unknown;
}
```

#### Application 層

- ユースケースのインターフェース定義
- アプリケーションのビジネスロジック

```typescript
// application/interfaces/MarketDataAdapter.ts
export interface MarketDataAdapter {
  connect(): Promise<void>;
  disconnect(): void;
}

// application/handlers/MessageHandler.ts
export interface MessageHandler {
  handle(rawMessage: unknown): Promise<void>;
}
```

#### Infrastructure 層

- 外部システムとの連携実装
- 具体的な技術的実装（WebSocket、Redis など）

```typescript
// infrastructure/adapters/gmo/GmoAdapter.ts
export class GmoAdapter implements MarketDataAdapter {
  // GMO API との具体的な連携実装
}

// infrastructure/redis/RedisPublisher.ts
export class RedisPublisher implements EventPublisher {
  // Redis との具体的な連携実装
}
```

### 依存関係の方向

- **Domain** ← **Application** ← **Infrastructure**
- 上位レイヤーは下位レイヤーに依存しない
- Infrastructure 層は Application 層のインターフェースを実装する

---

## その他

### 非同期処理

非同期処理には `async/await` を使用します。`Promise` チェーンは避けます。

```typescript
// 良い例
async function bootstrap(): Promise<void> {
  const publisher = new RedisPublisher(REDIS_URL);
  await Promise.all(adapters.map((adapter) => adapter.start()));
}

// 避けるべき例
function bootstrap(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Promise チェーン
  });
}
```

### 環境変数

環境変数は必須であることを前提とし、デフォルト値は設定しません。

```typescript
// 良い例
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

const EXCHANGE_NAME = requireEnv('EXCHANGE_NAME');
const WS_PUBLIC_URL = requireEnv('WS_PUBLIC_URL');
```

### コードフォーマット

- インデント: 2スペース
- セミコロン: 使用する
- クォート: シングルクォート（`'`）を使用
- 行の長さ: 100文字を目安（可読性を優先）

### TypeScript 設定

`tsconfig.json` の `strict` モードを有効にしています。

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ES2022"
  }
}
```

---

## リンター
TypeScript には Biome を使用。

使用方法

```bash
# リンター実行
npm run lint

# 自動修正
npm run lint:fix

# フォーマット実行
npm run format

# 型チェック（TypeScript）
npm run type-check
```

---

## 参考資料

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

