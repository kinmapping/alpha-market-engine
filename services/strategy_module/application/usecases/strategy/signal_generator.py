from shared.domain.models import OHLCV, Signal


class SignalGeneratorUseCase:
    """Generate trading signals from OHLCV and indicators (placeholder)."""

    def __init__(self, strategy) -> None:
        self.strategy = strategy

    def execute(self, ohlcv: OHLCV, indicators: dict) -> Signal | None:
        # TODO: delegate to strategy implementation
        raise NotImplementedError("Signal generation is not implemented yet.")

