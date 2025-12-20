---
name: SQLAlchemy+Alembic(中央集約)
overview: strategy/execution が同一 PostgreSQL を共有し外部キー依存があるため、Alembic のマイグレーションはプロジェクト単位で一元管理する。各モジュールは shared 側の schema/connection を参照して DB I/O を行う。
todos:
  - id: add-sqlalchemy-deps
    content: SQLAlchemy + Alembic を依存に追加（asyncpg は継続）
    status: completed
  - id: add-shared-db-layer
    content: shared/infrastructure/database に schema/connection を統合（単一 MetaData）
    status: completed
    dependencies:
      - add-sqlalchemy-deps
  - id: init-root-alembic
    content: リポジトリルートに Alembic を初期化し shared.metadata を参照
    status: completed
    dependencies:
      - add-shared-db-layer
  - id: create-initial-migration
    content: ohlcv/signals の初期マイグレーション作成（autogenerate 前提）
    status: completed
    dependencies:
      - init-root-alembic
  - id: refactor-strategy-db
    content: strategy の DB 層を shared 参照＋SQLAlchemy Core insert に移行。main.py の schema init を削除
    status: completed
    dependencies:
      - add-shared-db-layer
      - create-initial-migration
  - id: update-tests
    content: DB 保存テストを SQLAlchemy/Alembic 前提に更新
    status: completed
    dependencies:
      - refactor-strategy-db
  - id: legacy-cleanup
    content: 旧 SQL schema/migrations を整理（削除 or legacy 退避）
    status: completed
    dependencies:
      - create-initial-migration
---

# SQLAlchemy + Alembic 移行プラン（マイグレーション中央集約）

## ねらい

- **同一DBを複数モジュールが共有**し、`orders.signal_id -> signals.id` のような **FK依存**があるため、マイグレーションを各サービス配下で分散管理すると破綻しやすい。
- よって **Alembic はプロジェクトで一元管理**し、スキーマ定義も **shared 側に統合**する。

## 方針（確定）

- **Alembic はリポジトリルートに1つ**（`alembic/`, `alembic.ini`）
- **SQLAlchemy Table 定義は shared に統合**（単一 `MetaData`）
- `strategy` / `execution` は **shared の schema/connection を参照**してリポジトリ実装を行う
- 起動時に `CREATE TABLE IF NOT EXISTS ...` を叩くのはやめ、**DB作成は alembic upgrade** に寄せる

---

## 変更対象（主に触る場所）

- `shared/infrastructure/database/`（新設）
- `alembic/`（新設）と `alembic.ini`（新設）
- `services/strategy/infrastructure/database/`（shared 参照に寄せて整理）
- `services/strategy/main.py`（起動時 schema init を削除）

---

## 実装手順（具体）

### 1) 依存関係追加（strategy/execution 両方で使えるように）

- 追加する依存:
  - `sqlalchemy[asyncio]>=2.0.0`
  - `alembic>=1.13.0`
  - `asyncpg` は継続（SQLAlchemy の async ドライバ）

**コード案（pyproject.toml の dependencies 追加例）**

```toml
"sqlalchemy[asyncio]>=2.0.0",
"alembic>=1.13.0",
```

> 依存の置き場所は2パターンあり：

> - A: 各サービスの `services/*/pyproject.toml` に同じ依存を入れる

> - B: ルートに Python プロジェクトを作って shared も含めて管理

>

> 現状はサービスごとに pyproject を持ってるので、まずは **A** で進める。

---

### 2) shared に SQLAlchemy スキーマを統合（単一 MetaData）

**新設**: `shared/infrastructure/database/schema.py`

- `metadata = MetaData()` を1つ
- `ohlcv`, `signals`, さらに将来の `orders`, `executions`, `positions` もここに追加していく
- 外部キー（例: `orders.signal_id -> signals.id`）もここで宣言する

**コード案（抜粋）**

```python
from sqlalchemy import MetaData, Table, Column, Integer, String, DateTime, Numeric, Index, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB

metadata = MetaData()

ohlcv = Table(
    "ohlcv",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("exchange", String(50), nullable=False),
    Column("symbol", String(20), nullable=False),
    Column("timeframe", String(10), nullable=False),
    Column("timestamp", DateTime, nullable=False),
    Column("open", Numeric(20, 8), nullable=False),
    Column("high", Numeric(20, 8), nullable=False),
    Column("low", Numeric(20, 8), nullable=False),
    Column("close", Numeric(20, 8), nullable=False),
    Column("volume", Numeric(20, 8), nullable=False),
    UniqueConstraint("exchange", "symbol", "timeframe", "timestamp", name="uq_ohlcv"),
)
Index("idx_ohlcv_exchange_symbol_timeframe", ohlcv.c.exchange, ohlcv.c.symbol, ohlcv.c.timeframe, ohlcv.c.timestamp.desc())
Index("idx_ohlcv_timestamp", ohlcv.c.timestamp.desc())

signals = Table(
    "signals",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("exchange", String(50), nullable=False),
    Column("symbol", String(20), nullable=False),
    Column("strategy", String(100), nullable=False),
    Column("action", String(20), nullable=False),
    Column("confidence", Numeric(5, 2), nullable=False),
    Column("price_ref", Numeric(20, 8), nullable=False),
    Column("indicators", JSONB, nullable=True),
    Column("meta", JSONB, nullable=True),
    Column("timestamp", DateTime, nullable=False),
)
Index("idx_signals_exchange_symbol_strategy", signals.c.exchange, signals.c.symbol, signals.c.strategy, signals.c.timestamp.desc())
```

---

### 3) shared に SQLAlchemy Async 接続レイヤを置く

**新設**: `shared/infrastructure/database/connection.py`

- `DATABASE_URL` を `postgresql+asyncpg://...` に変換
- `create_async_engine` と `async_sessionmaker` を提供

**コード案（抜粋）**

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

class Database:
    def __init__(self, database_url: str) -> None:
        url = database_url.replace("postgresql://", "postgresql+asyncpg://")
        self.engine = create_async_engine(url, pool_size=10, max_overflow=20)
        self.session_factory = async_sessionmaker(self.engine, expire_on_commit=False)

    def session(self) -> AsyncSession:
        return self.session_factory()

    async def dispose(self) -> None:
        await self.engine.dispose()
```

---

### 4) Alembic をルートに初期化し、shared.metadata を参照

**新設**:

- `alembic.ini`
- `alembic/env.py`
- `alembic/versions/`

`env.py` の `target_metadata` は `shared.infrastructure.database.schema.metadata`

**コード案（env.py の要点）**

```python
from shared.infrastructure.database.schema import metadata

target_metadata = metadata

# DATABASE_URL を読み、postgresql+asyncpg に変換
```

---

### 5) 初期マイグレーション作成（strategy分だけでもOK）

- 最初は `ohlcv` と `signals` だけで migration を作る
- 後で execution の `orders/executions/positions` を足す migration を追加する

運用フロー:

- `alembic revision --autogenerate -m "init_ohlcv_signals"`
- `alembic upgrade head`

---

### 6) strategy の DB 実装を shared に寄せる

- `services/strategy/infrastructure/database/schema.py` は **廃止**（shared を参照）
- `services/strategy/infrastructure/database/connection.py` も **廃止**（shared を参照）
- `OhlcvRepositoryImpl` / `SignalRepositoryImpl` は SQLAlchemy Core の `insert()` を使う

**コード案（OHLCV 保存：抜粋）**

```python


from sqlalchemy.dialects.postgresql import insert
from shared.infrastructure.database.schema import ohlcv

stmt = insert(ohlcv).values(...).on_conflict_do_nothing(
    index_elements=["exchange", "symbol", "timeframe", "timestamp"]
)
```

---

### 7) main.py から schema init を削除

- 現状の `CREATE_INITIAL_SCHEMA` 実行を削除
- 代わりに「起動前に alembic upgrade head を適用している」前提にする

---

### 8) テストの更新

- いまの DB 保存テストを SQLAlchemy セッションベースに合わせる
- 可能ならテスト前に `alembic upgrade head` 相当を実行（またはテスト用 DB を事前準備）

---

## 追加の設計メモ（重要）

- **マイグレーションは『DB全体の真実』**なので、サービス単位に分けない。
- execution 側で `orders` を作るときに `signals` を参照するので、**同じ metadata / 同じ alembic** に統合しておくのが安全。

---

## 実装TODO（更新版）

- `add-sqlalchemy-deps`: SQLAlchemy + Alembic を依存に追加
- `add-shared-db-layer`: `shared/infrastructure/database/{schema.py,connection.py}` を新設
- `init-root-alembic`: ルートに Alembic を初期化し shared.metadata を参照
- `create-initial-migration`: `ohlcv`/`signals` の初期マイグレーション作成
- `refactor-strategy-db`: strategy の DB 層を shared 参照に変更（schema init 削除含む）
- `update-tests`: DB 保存テストを SQLAlchemy/Alembic 前提に更新
- `legacy-cleanup`: `services/strategy/infrastructure/database/migrations/001_initial_schema.sql` 等の旧資産を整理（削除 or legacy に退避）

---

## 参考

- SQLAlchemy 2.0: `https://docs.sqlalchemy.org/en/20/`
- Alembic: `https://alembic.sqlalchemy.org/`