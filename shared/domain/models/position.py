from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional


@dataclass
class Position:
    exchange: str
    symbol: str
    side: str  # 'LONG', 'SHORT'
    size: Decimal
    average_price: Decimal
    unrealized_pnl: Decimal = Decimal("0")
    realized_pnl: Decimal = Decimal("0")
    updated_at: datetime = None

    def __post_init__(self) -> None:
        if self.updated_at is None:
            self.updated_at = datetime.now()

