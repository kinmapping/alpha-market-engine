"""OHLCV Generator Use Case.

Application layer: OHLCV生成ユースケース
責務: 市場データ（ticker/trade）からOHLCVを生成する
"""
import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Dict, Optional

import pandas as pd
from shared.domain.models import OHLCV

if TYPE_CHECKING:
    from shared.application.interfaces.ohlcv_repository import OhlcvRepository

logger = logging.getLogger(__name__)


class OHLCVGeneratorUseCase:
    """Generate OHLCV from raw market data.

    市場データ（ticker/trade）からOHLCV（ローソク足）を生成します。
    時間足ごと（1秒/1分/5分など）に集約します。
    """

    def __init__(self, repository: Optional["OhlcvRepository"] = None) -> None:
        """Initialize OHLCV Generator Use Case.

        Args:
            repository: OHLCV リポジトリ（オプション、将来の永続化用）
        """
        self.repository = repository
        # シンボルごとの時系列データを保持（メモリ上）
        self._ticker_buffer: Dict[str, list] = defaultdict(list)
        self._trade_buffer: Dict[str, list] = defaultdict(list)

    def _parse_message(self, message: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Redis Stream メッセージをパースします。

        Args:
            message: Redis Stream メッセージ

        Returns:
            パースされたメッセージ（None の場合は無効）
        """
        try:
            fields = message.get("fields", {})
            stream_name = message.get("stream", "")

            # Stream 名からタイプを判定
            if "ticker" in stream_name:
                msg_type = "ticker"
            elif "trade" in stream_name:
                msg_type = "trade"
            elif "orderbook" in stream_name:
                msg_type = "orderbook"
            else:
                return None

            # データをパース
            data_str = fields.get("data", "{}")
            data = json.loads(data_str) if isinstance(data_str, str) else data_str

            return {
                "type": msg_type,
                "exchange": fields.get("exchange", ""),
                "symbol": fields.get("symbol", ""),
                "ts": int(fields.get("ts", 0)),
                "data": data,
            }
        except Exception as e:
            logger.error("Failed to parse message: %s", e, exc_info=True)
            return None

    def _add_to_buffer(self, parsed: Dict[str, Any]) -> None:
        """パースされたメッセージをバッファに追加します。

        Args:
            parsed: パースされたメッセージ
        """
        symbol = parsed["symbol"]
        ts = parsed["ts"]

        if parsed["type"] == "ticker":
            data = parsed["data"]
            # ticker データから価格とボリュームを取得
            price = float(data.get("last", data.get("close", 0)))
            volume = float(data.get("volume", 0))
            self._ticker_buffer[symbol].append({"ts": ts, "price": price, "volume": volume})
        elif parsed["type"] == "trade":
            data = parsed["data"]
            price = float(data.get("price", 0))
            size = float(data.get("size", 0))
            self._trade_buffer[symbol].append({"ts": ts, "price": price, "size": size})

    def _generate_ohlcv_from_buffer(
        self, symbol: str, exchange: str, timeframe: str = "1s"
    ) -> Optional[OHLCV]:
        """バッファからOHLCVを生成します。

        Args:
            symbol: シンボル（例: "BTC_JPY"）
            exchange: 取引所名（例: "gmo"）
            timeframe: 時間足（例: "1s", "1m", "5m"）

        Returns:
            OHLCV エンティティ（データが不足している場合は None）
        """
        # ticker と trade のデータをマージ
        ticker_data = self._ticker_buffer.get(symbol, [])
        trade_data = self._trade_buffer.get(symbol, [])

        if not ticker_data and not trade_data:
            return None

        # 時間足に応じた集約
        if timeframe == "1s":
            # 1秒足: 最新の1秒間のデータを使用
            now = datetime.now()
            cutoff = now - timedelta(seconds=1)
            cutoff_ts = int(cutoff.timestamp() * 1000)

            # 最新のデータを使用
            all_data = ticker_data + trade_data
            if not all_data:
                return None

            # 最新の価格データを取得
            latest = max(all_data, key=lambda x: x["ts"])
            price = latest.get("price", 0)

            # ボリュームを集計
            volume = sum(d.get("volume", d.get("size", 0)) for d in all_data if d["ts"] >= cutoff_ts)

            # OHLCV を生成（簡易版: 同じ価格を O/H/L/C に設定）
            ohlcv = OHLCV(
                exchange=exchange,
                symbol=symbol,
                timeframe=timeframe,
                timestamp=datetime.fromtimestamp(latest["ts"] / 1000),
                open=Decimal(str(price)),
                high=Decimal(str(price)),
                low=Decimal(str(price)),
                close=Decimal(str(price)),
                volume=Decimal(str(volume)),
            )

            # バッファをクリア（1秒足の場合）
            self._ticker_buffer[symbol] = []
            self._trade_buffer[symbol] = []

            return ohlcv
        else:
            # より長い時間足の場合は pandas を使用して集約
            # 簡易実装: 1秒足を生成してからリサンプリング
            # TODO: より効率的な実装に改善
            return None

    def execute(self, raw_message: Dict[str, Any]) -> Optional[OHLCV]:
        """市場データからOHLCVを生成します。

        Args:
            raw_message: Redis Stream から取得した生メッセージ

        Returns:
            OHLCV エンティティ（生成できない場合は None）
        """
        # メッセージをパース
        parsed = self._parse_message(raw_message)
        if not parsed:
            return None

        exchange = parsed["exchange"]
        symbol = parsed["symbol"]

        # バッファに追加
        self._add_to_buffer(parsed)

        # OHLCV を生成（1秒足）
        ohlcv = self._generate_ohlcv_from_buffer(symbol, exchange, timeframe="1s")

        if ohlcv and self.repository:
            # リポジトリに保存（非同期処理は将来実装）
            try:
                self.repository.save(ohlcv)
            except Exception as e:
                logger.error("Failed to save OHLCV: %s", e, exc_info=True)

        return ohlcv
