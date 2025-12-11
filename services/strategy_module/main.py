"""Main entrypoint for strategy module.

Strategy module のメインエントリーポイント。
Redis Stream から市場データを購読し、OHLCV生成、指標計算、シグナル生成を行います。
"""
import asyncio
import logging
import sys
from pathlib import Path
from typing import Any

from config import Settings, load_settings

# shared/ を PYTHONPATH に追加
shared_path = Path(__file__).parent.parent / "shared"
sys.path.insert(0, str(shared_path))

from application.services.signal_publisher import SignalPublisherService
from application.usecases.strategy.indicator_calculator import IndicatorCalculatorUseCase
from application.usecases.strategy.ohlcv_generator import OHLCVGeneratorUseCase
from application.usecases.strategy.signal_generator import SignalGeneratorUseCase
from infrastructure.database.repositories.ohlcv_repository import OhlcvRepositoryImpl
from infrastructure.database.repositories.signal_repository import SignalRepositoryImpl
from infrastructure.redis.consumer import RedisStreamConsumer
from infrastructure.redis.publisher import RedisStreamPublisher
from infrastructure.strategies.moving_average_cross import MovingAverageCrossStrategy

logger = logging.getLogger(__name__)


def create_strategy(strategy_name: str, **kwargs: Any) -> Any:
    """Strategy インスタンスを作成します。

    Args:
        strategy_name: 戦略名（例: "moving_average_cross"）
        **kwargs: 戦略のパラメータ

    Returns:
        Strategy インスタンス
    """
    if strategy_name == "moving_average_cross":
        fast_window = kwargs.get("fast_window", 5)
        slow_window = kwargs.get("slow_window", 20)
        return MovingAverageCrossStrategy(fast_window=fast_window, slow_window=slow_window)
    else:
        raise ValueError(f"Unknown strategy: {strategy_name}")


async def run_worker(settings: Settings) -> None:
    """Main worker loop.

    Redis Stream から市場データを購読し、OHLCV生成、指標計算、シグナル生成を行います。

    Args:
        settings: 設定オブジェクト
    """
    # Infrastructure 層のコンポーネントを初期化
    redis_consumer = RedisStreamConsumer(settings.redis_url)
    redis_publisher = RedisStreamPublisher(settings.redis_url)

    try:
        await redis_consumer.connect()
        await redis_publisher.connect()

        # リポジトリを初期化（将来のDB接続用）
        ohlcv_repo = OhlcvRepositoryImpl() if settings.database_url else None
        signal_repo = SignalRepositoryImpl() if settings.database_url else None

        # Application 層のユースケースを初期化
        ohlcv_generator = OHLCVGeneratorUseCase(repository=ohlcv_repo)
        indicator_calculator = IndicatorCalculatorUseCase()
        strategy = create_strategy(settings.strategy_name)
        signal_generator = SignalGeneratorUseCase(strategy=strategy)
        signal_publisher = SignalPublisherService(publisher=redis_publisher)

        # Consumer Group で市場データを購読
        streams = {
            "md:ticker": ">",
            "md:orderbook": ">",
            "md:trade": ">",
        }

        logger.info(
            "Starting strategy worker: group=strategy-module, streams=%s",
            list(streams.keys()),
        )

        async for message in redis_consumer.consume(
            group_name="strategy-module",
            consumer_name="strategy-1",
            streams=streams,
            block=1000,  # 1秒ブロック
            count=10,  # 一度に10件取得
        ):
            try:
                # OHLCV 生成
                ohlcv = ohlcv_generator.execute(message)
                if not ohlcv:
                    continue

                # 指標計算
                indicators = indicator_calculator.execute(ohlcv)

                # シグナル生成
                signal = signal_generator.execute(ohlcv, indicators)

                if signal:
                    # シグナルを配信
                    await signal_publisher.publish(signal)

                    # シグナルを保存（将来のDB接続用）
                    if signal_repo:
                        try:
                            signal_repo.save(signal)
                        except Exception as e:
                            logger.error("Failed to save signal: %s", e, exc_info=True)

            except Exception as e:
                logger.error("Error processing message: %s", e, exc_info=True)
                continue

    except KeyboardInterrupt:
        logger.info("Received interrupt signal, shutting down...")
    except Exception as e:
        logger.error("Fatal error in worker: %s", e, exc_info=True)
        raise
    finally:
        # クリーンアップ
        redis_consumer.stop()
        await redis_consumer.close()
        await redis_publisher.close()
        logger.info("Worker stopped")


def configure_logging(level: str) -> None:
    """ログ設定を構成します。

    Args:
        level: ログレベル（例: "INFO", "DEBUG"）
    """
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )


def main() -> None:
    """Main entrypoint."""
    settings = load_settings()
    configure_logging(settings.log_level)

    logger.info(
        "Starting strategy module: symbols=%s, strategy=%s, redis_url=%s",
        settings.symbols,
        settings.strategy_name,
        settings.redis_url,
    )

    try:
        asyncio.run(run_worker(settings))
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error("Fatal error: %s", e, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
