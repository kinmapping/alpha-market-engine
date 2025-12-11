"""Base Strategy implementation.

Infrastructure layer: Strategy 基底クラス
責務: Application 層の Strategy インターフェースを実装する基底クラス
"""
from typing import Dict, Optional

from application.interfaces.strategy import Strategy
from shared.domain.models import OHLCV, Signal


class BaseStrategy(Strategy):
    """Base strategy implementation.

    すべての戦略の基底クラス。共通の処理を実装します。
    """

    def calculate_indicators(self, ohlcv: OHLCV) -> Dict[str, float]:
        """OHLCV からテクニカル指標を計算（基底クラスでは未実装）。

        Args:
            ohlcv: OHLCV エンティティ

        Returns:
            指標の辞書

        Raises:
            NotImplementedError: サブクラスで実装する必要がある
        """
        raise NotImplementedError("Subclasses must implement calculate_indicators")

    def decide(self, ohlcv: OHLCV, indicators: Dict[str, float]) -> Optional[Signal]:
        """OHLCV と指標から売買シグナルを生成（基底クラスでは未実装）。

        Args:
            ohlcv: OHLCV エンティティ
            indicators: 指標の辞書

        Returns:
            Signal エンティティ（シグナルなしの場合は None）

        Raises:
            NotImplementedError: サブクラスで実装する必要がある
        """
        raise NotImplementedError("Subclasses must implement decide")
