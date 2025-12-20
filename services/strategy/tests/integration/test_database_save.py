"""Integration test: Database save functionality.

OHLCV と Signal のデータベース保存機能の動作確認テスト
"""
import os
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import text

# shared/ を PYTHONPATH に追加
shared_path = Path(__file__).parent.parent.parent.parent / "shared"
sys.path.insert(0, str(shared_path))

from infrastructure.database.repositories.ohlcv_repository import OhlcvRepository
from infrastructure.database.repositories.signal_repository import SignalRepository
from shared.domain.models import OHLCV, Signal
from shared.infrastructure.database.connection import Database


@pytest.fixture
async def database():
    """データベース接続のフィクスチャ。"""
    database_url = os.getenv(
        "DATABASE_URL", "postgresql://trading:trading_password@localhost:5432/trading_db"
    )
    db = Database(database_url)
    await db.connect()

    # 注意: テスト前に Alembic でマイグレーションを適用していることを前提とします
    # または、テスト用のスキーマを手動で作成する必要があります

    yield db

    # クリーンアップ: テストデータを削除
    async with db.get_session() as session:
        await session.execute(text("DELETE FROM signals"))
        await session.execute(text("DELETE FROM ohlcv"))
        await session.commit()

    await db.dispose()


@pytest.mark.asyncio
async def test_ohlcv_save(database):
    """OHLCV の保存をテストします。"""
    repository = OhlcvRepository(database)

    ohlcv = OHLCV(
        exchange="gmo",
        symbol="BTC_JPY",
        timeframe="1s",
        timestamp=datetime.now(),
        open=Decimal("5000000"),
        high=Decimal("5010000"),
        low=Decimal("4990000"),
        close=Decimal("5005000"),
        volume=Decimal("1.5"),
    )

    # 保存
    await repository.save(ohlcv)

    # 確認: データが保存されているか確認
    async with database.get_session() as session:
        result = await session.execute(
            text("SELECT * FROM ohlcv WHERE exchange = :exchange AND symbol = :symbol"),
            {"exchange": "gmo", "symbol": "BTC_JPY"},
        )
        rows = result.fetchall()
        assert len(rows) == 1
        row = rows[0]
        assert row.exchange == "gmo"
        assert row.symbol == "BTC_JPY"
        assert row.timeframe == "1s"
        assert float(row.open) == 5000000.0
        assert float(row.close) == 5005000.0


@pytest.mark.asyncio
async def test_ohlcv_save_duplicate(database):
    """OHLCV の重複保存をテストします（ON CONFLICT DO NOTHING）。"""
    repository = OhlcvRepository(database)

    timestamp = datetime.now()
    ohlcv = OHLCV(
        exchange="gmo",
        symbol="BTC_JPY",
        timeframe="1s",
        timestamp=timestamp,
        open=Decimal("5000000"),
        high=Decimal("5010000"),
        low=Decimal("4990000"),
        close=Decimal("5005000"),
        volume=Decimal("1.5"),
    )

    # 1回目: 保存
    await repository.save(ohlcv)

    # 2回目: 同じデータを保存（重複）
    await repository.save(ohlcv)

    # 確認: データが1件のみ保存されている
    async with database.get_session() as session:
        result = await session.execute(
            text(
                "SELECT * FROM ohlcv WHERE exchange = :exchange AND symbol = :symbol AND timeframe = :timeframe AND timestamp = :timestamp"
            ),
            {
                "exchange": "gmo",
                "symbol": "BTC_JPY",
                "timeframe": "1s",
                "timestamp": timestamp,
            },
        )
        rows = result.fetchall()
        assert len(rows) == 1


@pytest.mark.asyncio
async def test_signal_save(database):
    """Signal の保存をテストします。"""
    repository = SignalRepository(database)

    signal = Signal(
        exchange="gmo",
        symbol="BTC_JPY",
        strategy="moving_average_cross",
        action="enter_long",
        confidence=Decimal("0.75"),
        price_ref=Decimal("5000000"),
        indicators={"ma_5": 5000000.0, "ma_20": 4990000.0},
        meta={"reason": "MA cross detected"},
        timestamp=datetime.now(),
    )

    # 保存
    await repository.save(signal)

    # 確認: データが保存されているか確認
    async with database.get_session() as session:
        result = await session.execute(
            text(
                "SELECT * FROM signals WHERE exchange = :exchange AND symbol = :symbol AND strategy = :strategy"
            ),
            {"exchange": "gmo", "symbol": "BTC_JPY", "strategy": "moving_average_cross"},
        )
        rows = result.fetchall()
        assert len(rows) == 1
        row = rows[0]
        assert row.exchange == "gmo"
        assert row.symbol == "BTC_JPY"
        assert row.strategy == "moving_average_cross"
        assert row.action == "enter_long"
        assert float(row.confidence) == 0.75
        assert float(row.price_ref) == 5000000.0
        # JSONB フィールドの確認
        assert row.indicators is not None
        assert row.meta is not None


@pytest.mark.asyncio
async def test_signal_save_without_optional_fields(database):
    """Signal の保存をテストします（オプショナルフィールドなし）。"""
    repository = SignalRepository(database)

    signal = Signal(
        exchange="gmo",
        symbol="BTC_JPY",
        strategy="moving_average_cross",
        action="hold",
        confidence=Decimal("0.5"),
        price_ref=Decimal("5000000"),
        indicators=None,
        meta=None,
        timestamp=datetime.now(),
    )

    # 保存
    await repository.save(signal)

    # 確認: データが保存されているか確認
    async with database.get_session() as session:
        result = await session.execute(
            text("SELECT * FROM signals WHERE exchange = :exchange AND symbol = :symbol"),
            {"exchange": "gmo", "symbol": "BTC_JPY"},
        )
        rows = result.fetchall()
        assert len(rows) == 1
        row = rows[0]
        assert row.indicators is None
        assert row.meta is None

