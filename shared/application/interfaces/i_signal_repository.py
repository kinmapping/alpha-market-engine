from abc import ABC, abstractmethod

from shared.domain.models import Signal


class ISignalRepository(ABC):
    @abstractmethod
    async def save(self, signal: Signal) -> None:
        """Persist Signal."""

