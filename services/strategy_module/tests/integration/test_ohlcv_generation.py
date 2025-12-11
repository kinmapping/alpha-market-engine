"""Integration test: OHLCV generation from market data.

OHLCV生成ロジックの動作確認テスト
"""
import json
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import pytest

# shared/ を PYTHONPATH に追加
shared_path = Path(__file__).parent.parent.parent.parent / "shared"
sys.path.insert(0, str(shared_path))

from application.usecases.strategy.ohlcv_generator import OHLCVGeneratorUseCase
from shared.domain.models import OHLCV


def test_ohlcv_generation_from_ticker() -> None:
    """ticker データから OHLCV を生成できることを確認"""
    generator = OHLCVGeneratorUseCase()

    # ticker メッセージをシミュレート
    message = {
        "stream": "md:ticker",
        "id": "1234567890-0",
        "fields": {
            "exchange": "gmo",
            "symbol": "BTC_JPY",
            "ts": "1732312345000",
            "data": json.dumps({"last": 6123456, "volume": 1.5}),
        },
    }

    # OHLCV を生成
    ohlcv = generator.execute(message)

    # 結果を検証
    assert ohlcv is not None
    assert ohlcv.exchange == "gmo"
    assert ohlcv.symbol == "BTC_JPY"
    assert ohlcv.timeframe == "1s"
    assert ohlcv.close == Decimal("6123456")
    assert ohlcv.volume == Decimal("1.5")


def test_ohlcv_generation_from_trade() -> None:
    """trade データから OHLCV を生成できることを確認"""
    generator = OHLCVGeneratorUseCase()

    # trade メッセージをシミュレート
    message = {
        "stream": "md:trade",
        "id": "1234567890-0",
        "fields": {
            "exchange": "gmo",
            "symbol": "BTC_JPY",
            "ts": "1732312345000",
            "data": json.dumps({"price": 6123456, "size": 0.01, "side": "buy"}),
        },
    }

    # OHLCV を生成
    ohlcv = generator.execute(message)

    # 結果を検証
    assert ohlcv is not None
    assert ohlcv.exchange == "gmo"
    assert ohlcv.symbol == "BTC_JPY"
    assert ohlcv.close == Decimal("6123456")
    assert ohlcv.volume == Decimal("0.01")


def test_ohlcv_generation_invalid_message() -> None:
    """無効なメッセージの場合は None を返すことを確認"""
    generator = OHLCVGeneratorUseCase()

    # 無効なメッセージ
    message = {
        "stream": "invalid",
        "id": "1234567890-0",
        "fields": {},
    }

    # OHLCV を生成（None が返される）
    ohlcv = generator.execute(message)
    assert ohlcv is None

