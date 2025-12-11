from shared.domain.models import OHLCV


class OHLCVGeneratorUseCase:
    """Generate OHLCV from raw market data (placeholder)."""

    def __init__(self, repository) -> None:
        self.repository = repository

    def execute(self, raw_message: dict) -> OHLCV:
        # TODO: implement aggregation logic
        raise NotImplementedError("OHLCV generation is not implemented yet.")

