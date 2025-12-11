from abc import ABC, abstractmethod

from shared.domain.models import Signal


class SignalRepository(ABC):
    @abstractmethod
    def save(self, signal: Signal) -> None:
        """Persist Signal."""

