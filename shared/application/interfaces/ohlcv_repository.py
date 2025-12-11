from abc import ABC, abstractmethod

from shared.domain.models import OHLCV


class OhlcvRepository(ABC):
    @abstractmethod
    def save(self, ohlcv: OHLCV) -> None:
        """Persist OHLCV."""

