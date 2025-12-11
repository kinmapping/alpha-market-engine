from typing import Dict, Optional

from infrastructure.strategies.base import BaseStrategy
from shared.domain.models import OHLCV, Signal


class MovingAverageCrossStrategy(BaseStrategy):
    """Placeholder MA cross strategy."""

    def __init__(self, fast_window: int = 5, slow_window: int = 20) -> None:
        self.fast_window = fast_window
        self.slow_window = slow_window

    def calculate_indicators(self, ohlcv: OHLCV) -> Dict[str, float]:
        raise NotImplementedError

    def decide(self, ohlcv: OHLCV, indicators: Dict[str, float]) -> Optional[Signal]:
        raise NotImplementedError

