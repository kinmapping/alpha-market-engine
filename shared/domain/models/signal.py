from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional


@dataclass
class Signal:
    exchange: str
    symbol: str
    strategy: str
    action: str  # 'enter_long', 'exit', 'enter_short', 'hold'
    confidence: Decimal  # 0.00 - 1.00
    price_ref: Decimal
    indicators: Optional[Dict[str, Any]] = None
    meta: Optional[Dict[str, Any]] = None
    timestamp: datetime = None

    def __post_init__(self) -> None:
        if self.timestamp is None:
            self.timestamp = datetime.now()

