"""Indicator Calculator Use Case.

Application layer: 指標計算ユースケース
責務: OHLCVからテクニカル指標を計算する
"""
import logging
from decimal import Decimal
from typing import Dict, List

import pandas as pd
import pandas_ta as ta
from shared.domain.models import OHLCV

logger = logging.getLogger(__name__)


class IndicatorCalculatorUseCase:
    """Calculate technical indicators from OHLCV.

    OHLCVデータからテクニカル指標（移動平均、RSI、ボリンジャーバンドなど）を計算します。
    """

    def __init__(self) -> None:
        """Initialize Indicator Calculator Use Case."""
        # シンボルごとのOHLCV履歴を保持（指標計算用）
        self._ohlcv_history: Dict[str, List[OHLCV]] = {}
        self._max_history_size = 200  # 最大200本のローソク足を保持

    def _add_to_history(self, ohlcv: OHLCV) -> None:
        """OHLCVを履歴に追加します。

        Args:
            ohlcv: OHLCV エンティティ
        """
        symbol = ohlcv.symbol
        if symbol not in self._ohlcv_history:
            self._ohlcv_history[symbol] = []

        self._ohlcv_history[symbol].append(ohlcv)

        # 履歴サイズを制限
        if len(self._ohlcv_history[symbol]) > self._max_history_size:
            self._ohlcv_history[symbol] = self._ohlcv_history[symbol][-self._max_history_size :]

    def _ohlcv_to_dataframe(self, symbol: str) -> Optional[pd.DataFrame]:
        """OHLCV履歴をpandas DataFrameに変換します。

        Args:
            symbol: シンボル

        Returns:
            DataFrame（履歴が不足している場合は None）
        """
        if symbol not in self._ohlcv_history or len(self._ohlcv_history[symbol]) < 2:
            return None

        ohlcv_list = self._ohlcv_history[symbol]
        data = {
            "timestamp": [o.timestamp for o in ohlcv_list],
            "open": [float(o.open) for o in ohlcv_list],
            "high": [float(o.high) for o in ohlcv_list],
            "low": [float(o.low) for o in ohlcv_list],
            "close": [float(o.close) for o in ohlcv_list],
            "volume": [float(o.volume) for o in ohlcv_list],
        }
        df = pd.DataFrame(data)
        df.set_index("timestamp", inplace=True)
        return df

    def execute(self, ohlcv: OHLCV) -> Dict[str, float]:
        """OHLCVからテクニカル指標を計算します.

        Args:
            ohlcv: OHLCV エンティティ

        Returns:
            指標の辞書（例: {'ma_5': 100.5, 'ma_20': 99.8, 'rsi': 65.2}）
        """
        # 履歴に追加
        self._add_to_history(ohlcv)

        # DataFrame に変換
        df = self._ohlcv_to_dataframe(ohlcv.symbol)
        if df is None or len(df) < 2:
            # データが不足している場合は空の辞書を返す
            return {}

        indicators: Dict[str, float] = {}

        try:
            # 移動平均（MA）
            if len(df) >= 5:
                ma_5 = ta.sma(df["close"], length=5)
                if not ma_5.empty:
                    indicators["ma_5"] = float(ma_5.iloc[-1])

            if len(df) >= 20:
                ma_20 = ta.sma(df["close"], length=20)
                if not ma_20.empty:
                    indicators["ma_20"] = float(ma_20.iloc[-1])

            if len(df) >= 50:
                ma_50 = ta.sma(df["close"], length=50)
                if not ma_50.empty:
                    indicators["ma_50"] = float(ma_50.iloc[-1])

            # RSI（相対力指数）
            if len(df) >= 14:
                rsi = ta.rsi(df["close"], length=14)
                if not rsi.empty:
                    indicators["rsi"] = float(rsi.iloc[-1])

            # ボリンジャーバンド
            if len(df) >= 20:
                bb = ta.bbands(df["close"], length=20, std=2)
                if bb is not None and not bb.empty:
                    indicators["bb_upper"] = float(bb.iloc[-1, 0])  # BB_UPPER
                    indicators["bb_middle"] = float(bb.iloc[-1, 1])  # BB_MIDDLE
                    indicators["bb_lower"] = float(bb.iloc[-1, 2])  # BB_LOWER

            # MACD
            if len(df) >= 26:
                macd = ta.macd(df["close"])
                if macd is not None and not macd.empty:
                    indicators["macd"] = float(macd.iloc[-1, 0])  # MACD
                    indicators["macd_signal"] = float(macd.iloc[-1, 1])  # MACD_Signal
                    indicators["macd_hist"] = float(macd.iloc[-1, 2])  # MACD_Hist

        except Exception as e:
            logger.error("Failed to calculate indicators: %s", e, exc_info=True)

        return indicators
