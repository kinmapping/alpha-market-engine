from typing import Dict, Optional

from application.interfaces.strategy import Strategy
from shared.domain.models import OHLCV, Signal


class BaseStrategy(Strategy):
    """Base strategy implementation (placeholder)."""

    def calculate_indicators(self, ohlcv: OHLCV) -> Dict[str, float]:
        raise NotImplementedError

    def decide(self, ohlcv: OHLCV, indicators: Dict[str, float]) -> Optional[Signal]:
        raise NotImplementedError

