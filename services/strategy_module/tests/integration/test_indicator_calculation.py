"""Integration test: Indicator calculation from OHLCV.

指標計算ロジックの動作確認テスト
"""
import sys
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pytest

# shared/ を PYTHONPATH に追加
shared_path = Path(__file__).parent.parent.parent.parent / "shared"
sys.path.insert(0, str(shared_path))

from application.usecases.strategy.indicator_calculator import IndicatorCalculatorUseCase
from shared.domain.models import OHLCV


def test_indicator_calculation() -> None:
    """OHLCV から指標を計算できることを確認"""
    calculator = IndicatorCalculatorUseCase()

    # 複数のOHLCVを生成（移動平均計算用）
    base_time = datetime.now()
    prices = [100.0, 101.0, 102.0, 103.0, 104.0, 105.0]

    for i, price in enumerate(prices):
        ohlcv = OHLCV(
            exchange="gmo",
            symbol="BTC_JPY",
            timeframe="1s",
            timestamp=base_time + timedelta(seconds=i),
            open=Decimal(str(price)),
            high=Decimal(str(price + 0.5)),
            low=Decimal(str(price - 0.5)),
            close=Decimal(str(price)),
            volume=Decimal("1.0"),
        )

        # 指標を計算
        indicators = calculator.execute(ohlcv)

        # 5本目以降は移動平均が計算される
        if i >= 4:
            assert "ma_5" in indicators
            assert isinstance(indicators["ma_5"], float)


def test_indicator_calculation_insufficient_data() -> None:
    """データが不足している場合は空の辞書を返すことを確認"""
    calculator = IndicatorCalculatorUseCase()

    # 1本のOHLCVのみ
    ohlcv = OHLCV(
        exchange="gmo",
        symbol="BTC_JPY",
        timeframe="1s",
        timestamp=datetime.now(),
        open=Decimal("100.0"),
        high=Decimal("100.5"),
        low=Decimal("99.5"),
        close=Decimal("100.0"),
        volume=Decimal("1.0"),
    )

    # 指標を計算（データ不足のため空の辞書）
    indicators = calculator.execute(ohlcv)
    assert indicators == {}

