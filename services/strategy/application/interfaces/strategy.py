from abc import ABC, abstractmethod
from typing import Dict, Optional

from shared.domain.models import OHLCV, Signal


class Strategy(ABC):
    @abstractmethod
    def calculate_indicators(self, ohlcv: OHLCV) -> Dict[str, float]:
        """Calculate indicators from OHLCV."""

    @abstractmethod
    def decide(self, ohlcv: OHLCV, indicators: Dict[str, float]) -> Optional[Signal]:
        """Return a trading signal or None."""

