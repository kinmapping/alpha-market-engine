"""Moving Average Cross Strategy.

Infrastructure layer: 移動平均クロス戦略の実装
責務: 短期MAと長期MAのクロスでシグナルを生成する
"""
import logging
from decimal import Decimal
from typing import Dict, Optional

from infrastructure.strategies.base import BaseStrategy
from shared.domain.models import OHLCV, Signal

logger = logging.getLogger(__name__)


class MovingAverageCrossStrategy(BaseStrategy):
    """Moving Average Cross Strategy.

    短期移動平均と長期移動平均のクロス（ゴールデンクロス/デッドクロス）で
    シグナルを生成します。
    """

    def __init__(self, fast_window: int = 5, slow_window: int = 20) -> None:
        """Initialize Moving Average Cross Strategy.

        Args:
            fast_window: 短期MAの期間（デフォルト: 5）
            slow_window: 長期MAの期間（デフォルト: 20）
        """
        self.fast_window = fast_window
        self.slow_window = slow_window
        # 前回のMA値を保持（クロス判定用）
        self._prev_fast_ma: Dict[str, float] = {}
        self._prev_slow_ma: Dict[str, float] = {}

    def calculate_indicators(self, ohlcv: OHLCV) -> Dict[str, float]:
        """OHLCV から移動平均を計算します。

        Args:
            ohlcv: OHLCV エンティティ

        Returns:
            指標の辞書（ma_fast, ma_slow を含む）
        """
        # このメソッドは IndicatorCalculatorUseCase で計算されるため、
        # ここでは前回の値を返すだけ（実際の計算は IndicatorCalculatorUseCase で行う）
        symbol = ohlcv.symbol
        return {
            "ma_fast": self._prev_fast_ma.get(symbol, float(ohlcv.close)),
            "ma_slow": self._prev_slow_ma.get(symbol, float(ohlcv.close)),
        }

    def decide(self, ohlcv: OHLCV, indicators: Dict[str, float]) -> Optional[Signal]:
        """移動平均クロスでシグナルを生成します.

        Args:
            ohlcv: OHLCV エンティティ
            indicators: 指標の辞書（ma_fast, ma_slow を含む）

        Returns:
            Signal エンティティ（シグナルなしの場合は None）
        """
        symbol = ohlcv.symbol

        # 指標から移動平均を取得
        fast_ma = indicators.get("ma_fast") or indicators.get(f"ma_{self.fast_window}")
        slow_ma = indicators.get("ma_slow") or indicators.get(f"ma_{self.slow_window}")

        if fast_ma is None or slow_ma is None:
            # 移動平均が計算されていない場合はシグナルなし
            return None

        # 前回の値を取得
        prev_fast = self._prev_fast_ma.get(symbol)
        prev_slow = self._prev_slow_ma.get(symbol)

        # 現在の値を更新
        self._prev_fast_ma[symbol] = fast_ma
        self._prev_slow_ma[symbol] = slow_ma

        if prev_fast is None or prev_slow is None:
            # 前回の値がない場合はシグナルなし（初回）
            return None

        # クロス判定
        action = None
        confidence = Decimal("0.5")  # デフォルトの信頼度

        # ゴールデンクロス（短期MAが長期MAを上抜け）
        if prev_fast <= prev_slow and fast_ma > slow_ma:
            action = "enter_long"
            confidence = Decimal("0.7")
            logger.info(
                "Golden cross detected: symbol=%s, fast_ma=%.2f, slow_ma=%.2f",
                symbol,
                fast_ma,
                slow_ma,
            )
        # デッドクロス（短期MAが長期MAを下抜け）
        elif prev_fast >= prev_slow and fast_ma < slow_ma:
            action = "exit"
            confidence = Decimal("0.7")
            logger.info(
                "Dead cross detected: symbol=%s, fast_ma=%.2f, slow_ma=%.2f",
                symbol,
                fast_ma,
                slow_ma,
            )

        if action:
            return Signal(
                exchange=ohlcv.exchange,
                symbol=ohlcv.symbol,
                strategy="moving_average_cross",
                action=action,
                confidence=confidence,
                price_ref=ohlcv.close,
                indicators=indicators,
                meta={
                    "fast_window": self.fast_window,
                    "slow_window": self.slow_window,
                    "fast_ma": fast_ma,
                    "slow_ma": slow_ma,
                },
                timestamp=ohlcv.timestamp,
            )

        return None
