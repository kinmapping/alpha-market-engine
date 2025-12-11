from shared.application.interfaces.ohlcv_repository import OhlcvRepository
from shared.domain.models import OHLCV


class OhlcvRepositoryImpl(OhlcvRepository):
    def save(self, ohlcv: OHLCV) -> None:
        # TODO: implement persistence
        raise NotImplementedError("OHLCV repository save not implemented.")

