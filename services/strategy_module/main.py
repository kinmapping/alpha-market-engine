import asyncio
import logging

from config import load_settings


logger = logging.getLogger(__name__)


async def run_worker() -> None:
    """Main entrypoint for the strategy worker.

    NOTE: Core logic (Redis consumption, OHLCV/indicator/signal generation) is to be implemented in later phases.
    """
    logger.info("Strategy worker started (placeholder). Implement consume/publish logic in Phase 3+.")
    while True:
        await asyncio.sleep(5)


def configure_logging(level: str) -> None:
    logging.basicConfig(level=getattr(logging, level.upper(), logging.INFO))


def main() -> None:
    settings = load_settings()
    configure_logging(settings.log_level)
    logger.info("Settings loaded: symbols=%s strategy=%s http=%s", settings.symbols, settings.strategy_name, settings.enable_http)
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()

