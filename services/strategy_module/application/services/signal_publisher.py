"""Signal Publisher Service.

Application layer: シグナル配信サービス
責務: Signal エンティティを受け取り、Infrastructure 層の Publisher に委譲する
"""
import logging
from typing import TYPE_CHECKING

from shared.domain.models import Signal

if TYPE_CHECKING:
    from infrastructure.redis.publisher import RedisStreamPublisher

logger = logging.getLogger(__name__)


class SignalPublisherService:
    """Signal Publisher Service.

    Signal エンティティを受け取り、Redis Stream に配信します。
    """

    def __init__(self, publisher: "RedisStreamPublisher") -> None:
        """Initialize Signal Publisher Service.

        Args:
            publisher: Infrastructure 層の RedisStreamPublisher インスタンス
        """
        self.publisher = publisher

    async def publish(self, signal: Signal) -> None:
        """Signal を Redis Stream に配信します.

        Args:
            signal: 配信する Signal エンティティ
        """
        # Stream 名を生成（例: "signal:gmo:BTC_JPY"）
        stream_name = f"signal:{signal.exchange}:{signal.symbol}"

        # Signal エンティティを辞書形式に変換
        payload = {
            "exchange": signal.exchange,
            "symbol": signal.symbol,
            "strategy": signal.strategy,
            "action": signal.action,
            "confidence": str(signal.confidence),
            "price_ref": str(signal.price_ref),
            "timestamp": signal.timestamp.isoformat() if signal.timestamp else None,
        }

        # indicators と meta が存在する場合は JSON 文字列化
        if signal.indicators:
            payload["indicators"] = signal.indicators
        if signal.meta:
            payload["meta"] = signal.meta

        # Infrastructure 層の Publisher に委譲
        await self.publisher.publish(stream_name, payload)
        logger.info(
            "Published signal: exchange=%s, symbol=%s, strategy=%s, action=%s",
            signal.exchange,
            signal.symbol,
            signal.strategy,
            signal.action,
        )
