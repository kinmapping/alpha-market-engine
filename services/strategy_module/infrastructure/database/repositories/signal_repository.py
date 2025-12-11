from shared.application.interfaces.signal_repository import SignalRepository
from shared.domain.models import Signal


class SignalRepositoryImpl(SignalRepository):
    def save(self, signal: Signal) -> None:
        # TODO: implement persistence
        raise NotImplementedError("Signal repository save not implemented.")

