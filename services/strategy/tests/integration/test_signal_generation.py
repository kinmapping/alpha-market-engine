"""Integration test: Signal generation from OHLCV and indicators.

シグナル生成ロジックの動作確認テスト
"""
import sys
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import pytest

# shared/ を PYTHONPATH に追加
shared_path = Path(__file__).parent.parent.parent.parent / "shared"
sys.path.insert(0, str(shared_path))

from application.usecases.strategy.signal_generator import SignalGeneratorUseCase
from infrastructure.strategies.moving_average_cross import MovingAverageCrossStrategy
from shared.domain.models import OHLCV


def test_signal_generation_golden_cross() -> None:
    """ゴールデンクロスでシグナルが生成されることを確認"""
    strategy = MovingAverageCrossStrategy(fast_window=5, slow_window=20)
    generator = SignalGeneratorUseCase(strategy=strategy)

    # OHLCV を作成
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

    # ゴールデンクロスのシミュレーション（前回: fast < slow, 今回: fast > slow）
    # 初回は前回値がないため、手動で設定
    strategy._prev_fast_ma["BTC_JPY"] = 99.0
    strategy._prev_slow_ma["BTC_JPY"] = 100.0

    indicators = {"ma_fast": 101.0, "ma_slow": 100.0}

    # シグナルを生成
    signal = generator.execute(ohlcv, indicators)

    # 結果を検証
    assert signal is not None
    assert signal.action == "enter_long"
    assert signal.symbol == "BTC_JPY"
    assert signal.strategy == "moving_average_cross"
    assert signal.confidence == Decimal("0.7")


def test_signal_generation_dead_cross() -> None:
    """デッドクロスでシグナルが生成されることを確認"""
    strategy = MovingAverageCrossStrategy(fast_window=5, slow_window=20)
    generator = SignalGeneratorUseCase(strategy=strategy)

    # OHLCV を作成
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

    # デッドクロスのシミュレーション（前回: fast > slow, 今回: fast < slow）
    strategy._prev_fast_ma["BTC_JPY"] = 101.0
    strategy._prev_slow_ma["BTC_JPY"] = 100.0

    indicators = {"ma_fast": 99.0, "ma_slow": 100.0}

    # シグナルを生成
    signal = generator.execute(ohlcv, indicators)

    # 結果を検証
    assert signal is not None
    assert signal.action == "exit"
    assert signal.symbol == "BTC_JPY"
    assert signal.strategy == "moving_average_cross"


def test_signal_generation_no_cross() -> None:
    """クロスがない場合はシグナルが生成されないことを確認"""
    strategy = MovingAverageCrossStrategy(fast_window=5, slow_window=20)
    generator = SignalGeneratorUseCase(strategy=strategy)

    # OHLCV を作成
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

    # クロスなしのシミュレーション（前回も今回も fast > slow）
    strategy._prev_fast_ma["BTC_JPY"] = 101.0
    strategy._prev_slow_ma["BTC_JPY"] = 100.0

    indicators = {"ma_fast": 102.0, "ma_slow": 101.0}

    # シグナルを生成（None が返される）
    signal = generator.execute(ohlcv, indicators)
    assert signal is None

