"""Indicator Calculator Use Case.

Application layer: 指標計算ユースケース
責務: OHLCVからテクニカル指標を計算する
"""
import logging
from decimal import Decimal
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
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
            close = df["close"]

            # 移動平均（MA）
            if len(df) >= 5:
                ma_5 = close.rolling(window=5).mean()
                if not ma_5.empty and not pd.isna(ma_5.iloc[-1]):
                    indicators["ma_5"] = float(ma_5.iloc[-1])

            if len(df) >= 20:
                ma_20 = close.rolling(window=20).mean()
                if not ma_20.empty and not pd.isna(ma_20.iloc[-1]):
                    indicators["ma_20"] = float(ma_20.iloc[-1])

            if len(df) >= 50:
                ma_50 = close.rolling(window=50).mean()
                if not ma_50.empty and not pd.isna(ma_50.iloc[-1]):
                    indicators["ma_50"] = float(ma_50.iloc[-1])

            # RSI（相対力指数）
            if len(df) >= 14:
                rsi = self._calculate_rsi(close, period=14)
                if rsi is not None and not pd.isna(rsi):
                    indicators["rsi"] = float(rsi)

            # ボリンジャーバンド
            if len(df) >= 20:
                bb_middle = close.rolling(window=20).mean()
                bb_std = close.rolling(window=20).std()
                if not bb_middle.empty and not pd.isna(bb_middle.iloc[-1]):
                    indicators["bb_middle"] = float(bb_middle.iloc[-1])
                    indicators["bb_upper"] = float(bb_middle.iloc[-1] + 2 * bb_std.iloc[-1])
                    indicators["bb_lower"] = float(bb_middle.iloc[-1] - 2 * bb_std.iloc[-1])

            # MACD
            if len(df) >= 26:
                macd_result = self._calculate_macd(close)
                if macd_result:
                    indicators["macd"] = float(macd_result["macd"])
                    indicators["macd_signal"] = float(macd_result["signal"])
                    indicators["macd_hist"] = float(macd_result["hist"])

        except Exception as e:
            logger.error("Failed to calculate indicators: %s", e, exc_info=True)

        return indicators

    def _calculate_rsi(self, close: pd.Series, period: int = 14) -> Optional[float]:
        """RSI（相対力指数）を計算します。

        Args:
            close: 終値のSeries
            period: 期間（デフォルト: 14）

        Returns:
            RSI値（計算できない場合は None）
        """
        if len(close) < period + 1:
            return None

        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()

        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))

        if rsi.empty or pd.isna(rsi.iloc[-1]):
            return None

        return float(rsi.iloc[-1])

    def _calculate_macd(
        self, close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9
    ) -> Optional[Dict[str, float]]:
        """MACDを計算します。

        Args:
            close: 終値のSeries
            fast: 短期EMA期間（デフォルト: 12）
            slow: 長期EMA期間（デフォルト: 26）
            signal: シグナル線の期間（デフォルト: 9）

        Returns:
            MACD、シグナル、ヒストグラムの辞書（計算できない場合は None）
        """
        if len(close) < slow + signal:
            return None

        # EMA計算
        ema_fast = close.ewm(span=fast, adjust=False).mean()
        ema_slow = close.ewm(span=slow, adjust=False).mean()

        # MACD線
        macd_line = ema_fast - ema_slow

        # シグナル線
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()

        # ヒストグラム
        histogram = macd_line - signal_line

        if macd_line.empty or pd.isna(macd_line.iloc[-1]):
            return None

        return {
            "macd": float(macd_line.iloc[-1]),
            "signal": float(signal_line.iloc[-1]),
            "hist": float(histogram.iloc[-1]),
        }
