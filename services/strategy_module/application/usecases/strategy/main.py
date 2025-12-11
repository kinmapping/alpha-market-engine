from typing import Iterable

from application.usecases.strategy.ohlcv_generator import OHLCVGeneratorUseCase
from application.usecases.strategy.indicator_calculator import IndicatorCalculatorUseCase
from application.usecases.strategy.signal_generator import SignalGeneratorUseCase
from application.services.signal_publisher import SignalPublisherService
from shared.domain.models import OHLCV, Signal


class StrategyPipeline:
    """Orchestrates OHLCV -> indicators -> signal -> publish."""

    def __init__(
        self,
        ohlcv_generator: OHLCVGeneratorUseCase,
        indicator_calculator: IndicatorCalculatorUseCase,
        signal_generator: SignalGeneratorUseCase,
        publisher: SignalPublisherService,
    ) -> None:
        self.ohlcv_generator = ohlcv_generator
        self.indicator_calculator = indicator_calculator
        self.signal_generator = signal_generator
        self.publisher = publisher

    def process(self, raw_messages: Iterable[dict]) -> None:
        for raw in raw_messages:
            ohlcv: OHLCV = self.ohlcv_generator.execute(raw)
            indicators = self.indicator_calculator.execute(ohlcv)
            signal: Signal | None = self.signal_generator.execute(ohlcv, indicators)
            if signal:
                self.publisher.publish(signal)

