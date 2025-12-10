from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal


@dataclass
class OHLCV:
    exchange: str
    symbol: str
    timeframe: str  # '1s', '1m', '5m', etc.
    timestamp: datetime
    open: Decimal
    high: Decimal
    low: Decimal
    close: Decimal
    volume: Decimal

