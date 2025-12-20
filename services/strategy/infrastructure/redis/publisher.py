"""Redis Stream Publisher implementation.

Infrastructure layer: Redis Stream への配信実装
責務: シグナルを Redis Stream に XADD する
"""
import json
import logging
from typing import Optional

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class RedisStreamPublisher:
    """Redis Stream Publisher.

    Redis Stream に XADD を使用してメッセージを配信します。
    """

    def __init__(self, redis_url: str) -> None:
        """Initialize Redis Stream Publisher.

        Args:
            redis_url: Redis 接続URL（例: redis://localhost:6379/0）
        """
        self.redis_url = redis_url
        self.redis: Optional[aioredis.Redis] = None

    async def connect(self) -> None:
        """Redis 接続を確立します。"""
        if self.redis is None:
            self.redis = await aioredis.from_url(self.redis_url, decode_responses=True)
            logger.info("Connected to Redis: %s", self.redis_url)

    async def close(self) -> None:
        """Redis 接続を閉じます。"""
        if self.redis:
            await self.redis.close()
            self.redis = None
            logger.info("Disconnected from Redis")

    def _get_stream_name(self, exchange: str, symbol: str) -> str:
        """シグナルの Stream 名を生成します。

        Args:
            exchange: 取引所名（例: "gmo"）
            symbol: シンボル（例: "BTC_JPY"）

        Returns:
            Stream 名（例: "signal:gmo:BTC_JPY"）
        """
        return f"signal:{exchange}:{symbol}"

    async def publish(self, stream: str, payload: dict) -> None:
        """Redis Stream にメッセージを配信します。

        Args:
            stream: Stream 名（例: "signal:gmo:BTC_JPY"）
            payload: 配信するデータ（辞書形式）
        """
        if not self.redis:
            await self.connect()

        try:
            # ペイロードをフィールドに変換（JSON 文字列化）
            fields = {}
            for key, value in payload.items():
                if isinstance(value, (dict, list)):
                    fields[key] = json.dumps(value)
                else:
                    fields[key] = str(value)

            # XADD でメッセージを追加（* は自動ID生成）
            message_id = await self.redis.xadd(stream, fields, maxlen=10000, approximate=True)
            logger.debug("Published to stream: %s, message_id: %s", stream, message_id)
        except Exception as e:
            logger.error("Error publishing to Redis Stream %s: %s", stream, e, exc_info=True)
            raise
