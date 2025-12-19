"""Shared database connection using SQLAlchemy async.

すべてのモジュールで共有するデータベース接続を提供します。
"""
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

logger = logging.getLogger(__name__)


class Database:
    """SQLAlchemy を使用した非同期データベース接続を管理するクラス。

    すべてのモジュール（strategy-module, execution-module）で共有します。
    """

    def __init__(self, database_url: str) -> None:
        """データベース接続を初期化します。

        Args:
            database_url: PostgreSQL 接続URL（例: postgresql://user:password@host:port/dbname）。
            自動的に postgresql+asyncpg:// に変換されます
        """
        # postgresql:// を postgresql+asyncpg:// に変換
        async_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
        self.engine: AsyncEngine = create_async_engine(
            async_url,
            pool_size=10,
            max_overflow=20,
            echo=False,  # SQL ログ出力（開発時は True に設定可能）
        )
        self.session_factory: async_sessionmaker[AsyncSession] = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False,
        )
        logger.debug("Database connection initialized: %s", async_url)

    async def connect(self) -> None:
        """接続をテストします。

        実際の接続は必要時に自動的に確立されますが、
        明示的に接続をテストする場合に使用します。

        Raises:
            Exception: データベース接続に失敗した場合
        """
        async with self.engine.begin() as conn:
            from sqlalchemy import text

            await conn.execute(text("SELECT 1"))
        logger.info("Database connection test successful")

    async def dispose(self) -> None:
        """エンジンを閉じ、すべての接続を解放します。"""
        await self.engine.dispose()
        logger.info("Database engine disposed")

    def get_session(self) -> AsyncSession:
        """新しいセッションを取得します。

        Returns:
            AsyncSession: データベースセッション

        使用例:
            async with db.get_session() as session:
                await session.execute(...)
                await session.commit()
        """
        return self.session_factory()

