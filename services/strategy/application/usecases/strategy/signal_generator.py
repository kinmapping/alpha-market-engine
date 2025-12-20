"""Signal Generator Use Case.

Application layer: シグナル生成ユースケース
責務: OHLCVと指標から戦略ロジックを使用してシグナルを生成する
"""
import logging
from typing import TYPE_CHECKING, Dict, Optional

from shared.domain.models import OHLCV, Signal

if TYPE_CHECKING:
    from application.interfaces.strategy import Strategy

logger = logging.getLogger(__name__)


class SignalGeneratorUseCase:
    """Generate trading signals from OHLCV and indicators.

    OHLCVと指標から戦略ロジックを使用してシグナルを生成します。
    """

    def __init__(self, strategy: "Strategy") -> None:
        """Initialize Signal Generator Use Case.

        Args:
            strategy: Strategy インターフェースの実装（Infrastructure 層）
        """
        self.strategy = strategy

    def execute(self, ohlcv: OHLCV, indicators: Dict[str, float]) -> Optional[Signal]:
        """OHLCVと指標からシグナルを生成します.

        Args:
            ohlcv: OHLCV エンティティ
            indicators: 指標の辞書

        Returns:
            Signal エンティティ（シグナルなしの場合は None）
        """
        try:
            # Strategy の decide メソッドに委譲
            signal = self.strategy.decide(ohlcv, indicators)
            if signal:
                logger.info(
                    "Generated signal: symbol=%s, action=%s, confidence=%s",
                    signal.symbol,
                    signal.action,
                    signal.confidence,
                )
            return signal
        except Exception as e:
            logger.error("Failed to generate signal: %s", e, exc_info=True)
            return None
