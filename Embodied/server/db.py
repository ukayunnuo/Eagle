"""SQLAlchemy 异步数据库引擎、Session 工厂和初始化函数。"""

import re

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from server.config import get_settings
from server.log import get_logger

logger = get_logger(__name__)


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory = None


def _get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(settings.db_url, echo=False)
        safe_url = re.sub(r"://.*@", "://***@", settings.db_url)
        logger.info("数据库引擎已创建: %s", safe_url)
    return _engine


def get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(_get_engine(), class_=AsyncSession, expire_on_commit=False)
    return _session_factory


async def get_db():
    """FastAPI 依赖注入：yield 一个数据库 session。"""
    factory = get_session_factory()
    async with factory() as session:
        yield session


async def init_db():
    """创建所有表。启动时调用。"""
    import server.auth.models  # noqa: F401
    import server.tasks.models  # noqa: F401

    engine = _get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("数据库表已同步")
