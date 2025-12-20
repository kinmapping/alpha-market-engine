"""Redis Stream Consumer implementation.

Infrastructure layer: Redis Stream からの購読実装
責務: Consumer Group を使用して Redis Stream から市場データを購読する
"""
import asyncio
import logging
from typing import Any, AsyncIterator, Dict, Optional

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class RedisStreamConsumer:
    """Redis Stream Consumer using Consumer Group.

    Redis Stream から XREADGROUP を使用してメッセージを購読します。
    Consumer Group を使用することで、再起動時も取りこぼしゼロを実現します。
    """

    def __init__(self, redis_url: str) -> None:
        """Initialize Redis Stream Consumer.

        Args:
            redis_url: Redis 接続URL（例: redis://localhost:6379/0）
        """
        self.redis_url = redis_url
        self.redis: Optional[aioredis.Redis] = None
        self._running = False

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

    async def create_consumer_group(
        self, group_name: str, streams: Dict[str, str], mkstream: bool = True
    ) -> None:
        """Consumer Group を作成します。

        Args:
            group_name: Consumer Group 名（例: "strategy"）
            streams: Stream 名と開始位置の辞書（例: {"md:ticker": "0", "md:orderbook": "0"}）
            mkstream: Stream が存在しない場合に作成するかどうか
        """
        if not self.redis:
            await self.connect()

        for stream_name in streams.keys():
            try:
                # "$" を使用して、最新のメッセージ以降から読み始める
                # これにより、既存のメッセージが pending リストに追加されない
                await self.redis.xgroup_create(
                    name=stream_name,
                    groupname=group_name,
                    id="$",  # 最新のメッセージ以降から読み始める
                    mkstream=mkstream,
                )
                logger.info("Created consumer group: %s for stream: %s", group_name, stream_name)
            except aioredis.ResponseError as e:
                # Consumer Group が既に存在する場合は無視
                if "BUSYGROUP" in str(e):
                    logger.info("Consumer group already exists: %s for stream: %s", group_name, stream_name)
                    # 既存の Consumer Group の場合、pending メッセージを確認
                    # 注意: 既存の pending メッセージは自動的には削除されません
                    # 必要に応じて、XCLAIM や XACK で処理する必要があります
                else:
                    raise

    async def consume(
        self,
        group_name: str,
        consumer_name: str,
        streams: Dict[str, str],
        block: int = 1000,
        count: int = 10,
    ) -> AsyncIterator[Dict[str, Any]]:
        """Redis Stream からメッセージを購読します。

        Args:
            group_name: Consumer Group 名（例: "strategy"）
            consumer_name: Consumer 名（例: "strategy-1"）
            streams: Stream 名と開始位置の辞書（例: {"md:ticker": ">", "md:orderbook": ">"}）
            block: ブロック時間（ミリ秒、0 で非ブロッキング）
            count: 一度に取得するメッセージ数

        Yields:
            メッセージの辞書（stream名、message_id、フィールドを含む）
        """
        if not self.redis:
            await self.connect()

        # Consumer Group を作成（存在しない場合）
        await self.create_consumer_group(group_name, streams)

        self._running = True
        logger.info(
            "Starting to consume from Redis Streams: group=%s, consumer=%s, streams=%s",
            group_name,
            consumer_name,
            list(streams.keys()),
        )

        while self._running:
            try:
                # XREADGROUP でメッセージを取得
                messages = await self.redis.xreadgroup(
                    groupname=group_name,
                    consumername=consumer_name,
                    streams=streams,
                    count=count,
                    block=block,
                )

                if messages:
                    for stream_name, stream_messages in messages:
                        for message_id, fields in stream_messages:
                            # メッセージを辞書形式に変換
                            message = {
                                "stream": stream_name,
                                "id": message_id,
                                "fields": dict(fields),
                            }
                            yield message

            except asyncio.CancelledError:
                logger.info("Consumer cancelled")
                break
            except Exception as e:
                logger.error("Error consuming from Redis Stream: %s", e, exc_info=True)
                # エラー時は少し待機してから再試行
                await asyncio.sleep(1)

    async def ack(self, stream_name: str, group_name: str, message_id: str) -> None:
        """メッセージの処理完了を通知します（ACK）。

        Args:
            stream_name: Stream 名（例: "md:ticker"）
            group_name: Consumer Group 名（例: "strategy"）
            message_id: メッセージID（例: "1734123456789-0"）
        """
        if not self.redis:
            await self.connect()

        try:
            result = await self.redis.xack(stream_name, group_name, message_id)
            logger.debug("ACKed message: stream=%s, message_id=%s, result=%s", stream_name, message_id, result)
        except Exception as e:
            logger.error("Error ACKing message %s from stream %s: %s", message_id, stream_name, e, exc_info=True)
            raise

    def stop(self) -> None:
        """購読を停止します。"""
        self._running = False
        logger.info("Stopping consumer")
