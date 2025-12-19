"""Shared database schema definitions using SQLAlchemy.

すべてのテーブル定義を単一の MetaData で管理します。
strategy-module と execution-module が共有するデータベースのスキーマを定義します。
"""
from sqlalchemy import (
    MetaData,
    Table,
    Column,
    Integer,
    String,
    DateTime,
    Numeric,
    Index,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB

# 単一の MetaData オブジェクトで全テーブルを管理
metadata = MetaData()

# ============================================================================
# Strategy Module のテーブル
# ============================================================================

ohlcv = Table(
    "ohlcv",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("exchange", String(50), nullable=False),
    Column("symbol", String(20), nullable=False),
    Column("timeframe", String(10), nullable=False),  # '1s', '1m', '5m', etc.
    Column("timestamp", DateTime, nullable=False),
    Column("open", Numeric(20, 8), nullable=False),
    Column("high", Numeric(20, 8), nullable=False),
    Column("low", Numeric(20, 8), nullable=False),
    Column("close", Numeric(20, 8), nullable=False),
    Column("volume", Numeric(20, 8), nullable=False),
    Column("created_at", DateTime, server_default="CURRENT_TIMESTAMP"),
    UniqueConstraint("exchange", "symbol", "timeframe", "timestamp", name="uq_ohlcv"),
)

# OHLCV テーブルのインデックス
Index(
    "idx_ohlcv_exchange_symbol_timeframe",
    ohlcv.c.exchange,
    ohlcv.c.symbol,
    ohlcv.c.timeframe,
    ohlcv.c.timestamp.desc(),
)
Index("idx_ohlcv_timestamp", ohlcv.c.timestamp.desc())

signals = Table(
    "signals",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("exchange", String(50), nullable=False),
    Column("symbol", String(20), nullable=False),
    Column("strategy", String(100), nullable=False),
    Column("action", String(20), nullable=False),  # 'enter_long', 'exit', 'enter_short', 'hold'
    Column("confidence", Numeric(5, 2), nullable=False),  # 0.00 - 1.00
    Column("price_ref", Numeric(20, 8), nullable=False),
    Column("indicators", JSONB, nullable=True),  # 指標データ（JSON形式）
    Column("meta", JSONB, nullable=True),  # メタデータ（理由、パラメータなど）
    Column("timestamp", DateTime, nullable=False, server_default="CURRENT_TIMESTAMP"),
    Column("created_at", DateTime, server_default="CURRENT_TIMESTAMP"),
)

# Signal テーブルのインデックス
Index(
    "idx_signals_exchange_symbol_strategy",
    signals.c.exchange,
    signals.c.symbol,
    signals.c.strategy,
    signals.c.timestamp.desc(),
)
Index("idx_signals_timestamp", signals.c.timestamp.desc())
Index("idx_signals_action", signals.c.action, signals.c.timestamp.desc())

# ============================================================================
# Execution Module のテーブル（将来実装用）
# ============================================================================

# orders テーブル（signals テーブルを参照）
orders = Table(
    "orders",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("exchange", String(50), nullable=False),
    Column("symbol", String(20), nullable=False),
    Column("order_id", String(100), nullable=False, unique=True),  # 取引所の注文ID
    Column("signal_id", Integer, ForeignKey("signals.id"), nullable=True),
    Column("side", String(10), nullable=False),  # 'BUY', 'SELL'
    Column("order_type", String(20), nullable=False),  # 'LIMIT', 'MARKET'
    Column("price", Numeric(20, 8), nullable=True),
    Column("size", Numeric(20, 8), nullable=False),
    Column("status", String(20), nullable=False),  # 'NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED'
    Column("filled_size", Numeric(20, 8), server_default="0"),
    Column("average_price", Numeric(20, 8), nullable=True),
    Column("timestamp", DateTime, nullable=False, server_default="CURRENT_TIMESTAMP"),
    Column("created_at", DateTime, server_default="CURRENT_TIMESTAMP"),
    Column("updated_at", DateTime, server_default="CURRENT_TIMESTAMP", onupdate="CURRENT_TIMESTAMP"),
)

# Orders テーブルのインデックス
Index("idx_orders_exchange_symbol", orders.c.exchange, orders.c.symbol, orders.c.timestamp.desc())
Index("idx_orders_status", orders.c.status, orders.c.timestamp.desc())
Index("idx_orders_signal_id", orders.c.signal_id)

# executions テーブル（orders テーブルを参照）
executions = Table(
    "executions",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("exchange", String(50), nullable=False),
    Column("symbol", String(20), nullable=False),
    Column("order_id", Integer, ForeignKey("orders.id"), nullable=False),
    Column("execution_id", String(100), nullable=False, unique=True),  # 取引所の約定ID
    Column("side", String(10), nullable=False),  # 'BUY', 'SELL'
    Column("price", Numeric(20, 8), nullable=False),
    Column("size", Numeric(20, 8), nullable=False),
    Column("fee", Numeric(20, 8), server_default="0"),
    Column("timestamp", DateTime, nullable=False),
    Column("created_at", DateTime, server_default="CURRENT_TIMESTAMP"),
)

# Executions テーブルのインデックス
Index("idx_executions_exchange_symbol", executions.c.exchange, executions.c.symbol, executions.c.timestamp.desc())
Index("idx_executions_order_id", executions.c.order_id)
Index("idx_executions_timestamp", executions.c.timestamp.desc())

# positions テーブル
positions = Table(
    "positions",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("exchange", String(50), nullable=False),
    Column("symbol", String(20), nullable=False),
    Column("side", String(10), nullable=False),  # 'LONG', 'SHORT'
    Column("size", Numeric(20, 8), nullable=False),
    Column("average_price", Numeric(20, 8), nullable=False),
    Column("unrealized_pnl", Numeric(20, 8), server_default="0"),
    Column("realized_pnl", Numeric(20, 8), server_default="0"),
    Column("updated_at", DateTime, server_default="CURRENT_TIMESTAMP", onupdate="CURRENT_TIMESTAMP"),
    UniqueConstraint("exchange", "symbol", name="uq_positions_exchange_symbol"),
)

# Positions テーブルのインデックス
Index("idx_positions_exchange_symbol", positions.c.exchange, positions.c.symbol)

