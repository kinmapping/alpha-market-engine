"""OHLCV repository implementation using SQLAlchemy."""
import logging

from sqlalchemy.dialects.postgresql import insert

from shared.application.interfaces.i_ohlcv_repository import IOhlcvRepository
from shared.domain.models import OHLCV
from shared.infrastructure.database.connection import Database
from shared.infrastructure.database.schema import ohlcv

logger = logging.getLogger(__name__)


class OhlcvRepository(IOhlcvRepository):
    """OHLCV リポジトリの実装。

    SQLAlchemy を使用して PostgreSQL に OHLCV データを保存します。
    """

    def __init__(self, database: Database) -> None:
        """OHLCV リポジトリを初期化します。

        Args:
            database: データベース接続オブジェクト（shared の Database クラス）
        """
        self.database = database

    async def save(self, ohlcv_entity: OHLCV) -> None:
        """OHLCV をデータベースに保存します。

        Args:
            ohlcv_entity: 保存する OHLCV エンティティ

        Raises:
            RuntimeError: データベース接続が初期化されていない場合
            sqlalchemy.exc.SQLAlchemyError: データベース操作に失敗した場合
        """
        try:
            async with self.database.get_session() as session:
                stmt = (
                    insert(ohlcv)
                    .values(
                        exchange=ohlcv_entity.exchange,
                        symbol=ohlcv_entity.symbol,
                        timeframe=ohlcv_entity.timeframe,
                        timestamp=ohlcv_entity.timestamp,
                        open=float(ohlcv_entity.open),
                        high=float(ohlcv_entity.high),
                        low=float(ohlcv_entity.low),
                        close=float(ohlcv_entity.close),
                        volume=float(ohlcv_entity.volume),
                    )
                    .on_conflict_do_nothing(
                        index_elements=["exchange", "symbol", "timeframe", "timestamp"]
                    )
                )
                await session.execute(stmt)
                await session.commit()

            logger.debug(
                "Saved OHLCV: exchange=%s, symbol=%s, timeframe=%s, timestamp=%s",
                ohlcv_entity.exchange,
                ohlcv_entity.symbol,
                ohlcv_entity.timeframe,
                ohlcv_entity.timestamp,
            )
        except Exception as e:
            logger.error(
                "Failed to save OHLCV: exchange=%s, symbol=%s, timeframe=%s, error=%s",
                ohlcv_entity.exchange,
                ohlcv_entity.symbol,
                ohlcv_entity.timeframe,
                e,
                exc_info=True,
            )
            raise

