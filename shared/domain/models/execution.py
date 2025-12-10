from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional


@dataclass
class Execution:
    exchange: str
    symbol: str
    order_id: Optional[int]
    execution_id: str  # 取引所の約定ID
    side: str  # 'BUY', 'SELL'
    price: Decimal
    size: Decimal
    fee: Decimal = Decimal("0")
    timestamp: datetime = None

    def __post_init__(self) -> None:
        if self.timestamp is None:
            self.timestamp = datetime.now()

