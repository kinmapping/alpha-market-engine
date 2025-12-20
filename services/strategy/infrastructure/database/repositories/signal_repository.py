"""Signal repository implementation using SQLAlchemy."""
import logging

from sqlalchemy import insert

from shared.application.interfaces.i_signal_repository import ISignalRepository
from shared.domain.models import Signal
from shared.infrastructure.database.connection import Database
from shared.infrastructure.database.schema import signals

logger = logging.getLogger(__name__)


class SignalRepository(ISignalRepository):
    """Signal リポジトリの実装。

    SQLAlchemy を使用して PostgreSQL にシグナルデータを保存します。
    """

    def __init__(self, database: Database) -> None:
        """Signal リポジトリを初期化します。

        Args:
            database: データベース接続オブジェクト（shared の Database クラス）
        """
        self.database = database

    async def save(self, signal_entity: Signal) -> None:
        """シグナルをデータベースに保存します.

        Args:
            signal_entity: 保存する Signal エンティティ

        Raises:
            RuntimeError: データベース接続が初期化されていない場合
            sqlalchemy.exc.SQLAlchemyError: データベース操作に失敗した場合
        """
        try:
            async with self.database.get_session() as session:
                stmt = insert(signals).values(
                    exchange=signal_entity.exchange,
                    symbol=signal_entity.symbol,
                    strategy=signal_entity.strategy,
                    action=signal_entity.action,
                    confidence=float(signal_entity.confidence),
                    price_ref=float(signal_entity.price_ref),
                    indicators=signal_entity.indicators,  # dict をそのまま渡す（JSONB に自動変換）
                    meta=signal_entity.meta,  # dict をそのまま渡す（JSONB に自動変換）
                    timestamp=signal_entity.timestamp,
                )
                await session.execute(stmt)
                await session.commit()

            logger.debug(
                "Saved Signal: exchange=%s, symbol=%s, strategy=%s, action=%s, timestamp=%s",
                signal_entity.exchange,
                signal_entity.symbol,
                signal_entity.strategy,
                signal_entity.action,
                signal_entity.timestamp,
            )
        except Exception as e:
            logger.error(
                "Failed to save Signal: exchange=%s, symbol=%s, strategy=%s, error=%s",
                signal_entity.exchange,
                signal_entity.symbol,
                signal_entity.strategy,
                e,
                exc_info=True,
            )
            raise

