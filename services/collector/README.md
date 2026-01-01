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
## テストの種類

### 単体テスト (`tests/unit/`)

個別のコンポーネントを独立してテストします。モックを使用して外部依存を排除します。


## 実行方法

### 前提条件
統合テストのために Redis が起動している必要があります

```bash
# すべてのテストを実行
npm test

# 単体テストのみ実行
npm run test:unit


# 統合テストのみ実行
npm run test:integration

# ウォッチモード（開発時）
npm run test:watch
```

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

---
## リンター
TypeScript には Biome を使用。

### Biome と ESLint の併用

このプロジェクトでは、**Biome** と **ESLint** を併用しています：

- **Biome**: フォーマット、スタイル、基本的なリンタールールを担当
- **ESLint**: 複雑度関連のルール（`max-depth`, `complexity` など）を担当

### 実行方法

```bash
# Biome と ESLint の両方を実行
npm run lint

# Biome のみ実行
npm run lint:biome

# フォーマット実行
npm run format

# ESLint のみ実行
npm run lint:eslint

# 自動修正（Biome と ESLint の両方）
npm run lint:fix

# 型チェック（TypeScript）
npm run type-check
```

### ESLint の複雑度ルール

ESLint では以下の複雑度ルールが設定されています：

- **`max-depth`**: ネストの深さは最大4階層（エラー）
- **`complexity`**: 循環的複雑度は最大15（警告）
- **`max-lines-per-function`**: 関数の行数は最大100行（警告、テストファイルは400行）
- **`max-params`**: パラメータ数は最大5個（警告）

テストファイル（`tests/**/*.ts`）は、複雑なテストケースを含むことが多いため、上限が緩和されています。

### Biome のコマンドによる設定解釈の違い

Biome 2.3.8 では、コマンドによって設定ファイルの解釈が異なる場合があります：

- **`biome check .`** (プロジェクト全体): `assist.actions.source.organizeImports` と `overrides[].includes`（複数形）を使用
- **`biome lint <path>`** (個別ファイル): `organizeImports`（ルートレベル）と `overrides[].include`（単数形）を要求

**推奨**: `npm run lint`（`biome check . && eslint .`）を使用してください。

### カスタムESLintルール: `limit-chain-depth`

このプロジェクトでは、チェーンメソッドの深さを制限するカスタムルール `custom-rules/limit-chain-depth` を実装しています。

#### 目的

チェーンメソッドが深すぎると可読性が低下するため、中間変数を使用することを推奨します。

```typescript
// ❌ 警告: 4段階のチェーンメソッド（上限: 3段階）
const result = data.map(x => x.value).filter(v => v > 0).sort().reverse();

// ✅ 推奨: 中間変数を使用
const mapped = data.map(x => x.value);
const filtered = mapped.filter(v => v > 0);
const sorted = filtered.sort();
const result = sorted.reverse();
```

#### 設定

最大3段階（`maxDepth: 3`）


設定は `eslint.config.ts` で管理されています：

```typescript
// 通常のソースコード
'custom-rules/limit-chain-depth': ['warn', { maxDepth: 3 }],

// テストファイル（tests/**/*.ts）
'custom-rules/limit-chain-depth': ['warn', { maxDepth: 3 }],
```

#### ルールの無効化

特定の行でルールを無効化する場合：

```typescript
// eslint-disable-next-line custom-rules/limit-chain-depth
const result = data.map(x => x.value).filter(v => v > 0).sort().reverse();
```

ファイル全体で無効化する場合：

```typescript
/* eslint-disable custom-rules/limit-chain-depth */
```

#### 運用上の留意点

1. **TypeScript で管理**
   - カスタムルールは `.eslint/custom-rules/*.ts` で TypeScript として管理されています
   - 型安全性が確保され、IDE の補完が効きます

2. **ルールの修正・拡張**
   - ルールのロジックを変更する場合は `.eslint/custom-rules/limit-chain-depth.ts` を編集
   - 変更後は `npm run type-check` で型エラーを確認
   - `npm run lint:eslint` で動作確認

3. **`maxDepth` の調整**
   - プロジェクトの方針に合わせて `maxDepth` を調整可能
   - 現在は通常のソースコードとテストファイルの両方で3段階に統一

4. **パフォーマンス**
   - カスタムルールは AST を走査するため、大きなファイルでは若干のオーバーヘッドが発生する可能性があります
   - 通常のプロジェクト規模では問題になりません

5. **他のプロジェクトへの移植**
   - `.eslint/custom-rules/` ディレクトリごとコピー
   - `eslint.config.ts` でプラグインとして登録
   - `jiti` パッケージが必要（ESLint v9 が TypeScript 設定を読み込むため）

#### トラブルシューティング

**カスタムルールが動作しない**

```bash
# ESLint の設定を確認
npm run lint:eslint

# TypeScript の型チェック
npm run type-check
```

**`jiti` が見つからないエラー**

```bash
npm install --save-dev jiti
```

ESLint v9 は `jiti` を使用して TypeScript 設定ファイル（`eslint.config.ts`）を読み込みます。


---
## 参考資料

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [Vitest ドキュメント](https://vitest.dev/)
- [Redis Streams ドキュメント](https://redis.io/docs/data-types/streams/)
- [collector 設計](../docs/architecture/02_collector.md)
- [Biome ドキュメント](https://biomejs.dev/)