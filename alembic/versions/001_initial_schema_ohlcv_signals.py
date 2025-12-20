"""Initial schema: ohlcv and signals tables

Revision ID: 001_initial_schema
Revises:
Create Date: 2025-12-XX XX:XX:XX.XXXXXX

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # OHLCV テーブル
    op.create_table(
        "ohlcv",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("exchange", sa.String(length=50), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("timeframe", sa.String(length=10), nullable=False),
        sa.Column("timestamp", sa.DateTime(), nullable=False),
        sa.Column("open", sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column("high", sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column("low", sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column("close", sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column("volume", sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("exchange", "symbol", "timeframe", "timestamp", name="uq_ohlcv"),
    )
    op.create_index(
        "idx_ohlcv_exchange_symbol_timeframe",
        "ohlcv",
        ["exchange", "symbol", "timeframe", sa.text("timestamp DESC")],
        unique=False,
    )
    op.create_index("idx_ohlcv_timestamp", "ohlcv", [sa.text("timestamp DESC")], unique=False)

    # Signal テーブル
    op.create_table(
        "signals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("exchange", sa.String(length=50), nullable=False),
        sa.Column("symbol", sa.String(length=20), nullable=False),
        sa.Column("strategy", sa.String(length=100), nullable=False),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("confidence", sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column("price_ref", sa.Numeric(precision=20, scale=8), nullable=False),
        sa.Column("indicators", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("timestamp", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_signals_exchange_symbol_strategy",
        "signals",
        ["exchange", "symbol", "strategy", sa.text("timestamp DESC")],
        unique=False,
    )
    op.create_index("idx_signals_timestamp", "signals", [sa.text("timestamp DESC")], unique=False)
    op.create_index("idx_signals_action", "signals", ["action", sa.text("timestamp DESC")], unique=False)


def downgrade() -> None:
    # Signal テーブルを削除（外部キー参照があるため先に削除）
    op.drop_index("idx_signals_action", table_name="signals")
    op.drop_index("idx_signals_timestamp", table_name="signals")
    op.drop_index("idx_signals_exchange_symbol_strategy", table_name="signals")
    op.drop_table("signals")

    # OHLCV テーブルを削除
    op.drop_index("idx_ohlcv_timestamp", table_name="ohlcv")
    op.drop_index("idx_ohlcv_exchange_symbol_timeframe", table_name="ohlcv")
    op.drop_table("ohlcv")

