from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional


@dataclass
class Order:
    exchange: str
    symbol: str
    order_id: str  # 取引所の注文ID
    signal_id: Optional[int] = None
    side: str  # 'BUY', 'SELL'
    order_type: str  # 'LIMIT', 'MARKET'
    price: Optional[Decimal] = None
    size: Decimal = Decimal("0")
    status: str = "NEW"  # 'NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED'
    filled_size: Decimal = Decimal("0")
    average_price: Optional[Decimal] = None
    timestamp: datetime = None

    def __post_init__(self) -> None:
        if self.timestamp is None:
            self.timestamp = datetime.now()

