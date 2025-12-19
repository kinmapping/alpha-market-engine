from abc import ABC, abstractmethod

from shared.domain.models import OHLCV


class IOhlcvRepository(ABC):
    @abstractmethod
    async def save(self, ohlcv: OHLCV) -> None:
        """Persist OHLCV."""

