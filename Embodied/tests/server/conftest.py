"""测试共享 fixture。"""

import asyncio
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from server.db import Base, get_db

# 确保所有模型被导入，以便 create_all 能创建表
import server.auth.models  # noqa: F401

TEST_JWT_SECRET = "test-secret-key-for-testing"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def app_client():
    """创建测试用的 FastAPI 客户端，使用内存数据库。"""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with factory() as session:
            yield session

    mock_worker = MagicMock()
    mock_worker.model_path = "test-model"
    mock_worker.family = "locateanything"
    mock_worker.device = "cpu"
    mock_worker.dtype = "float32"

    with patch.dict("os.environ", {"JWT_SECRET": TEST_JWT_SECRET}):
        from server.config import get_settings
        get_settings.cache_clear()

        from server.main import create_app
        app = create_app(skip_lifespan=True)
        app.dependency_overrides[get_db] = override_get_db

        from server.api.inference_router import set_worker
        set_worker(mock_worker)

        # 跳过 lifespan（避免 init_db 和模型加载）
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac

        set_worker(None)
        app.dependency_overrides.clear()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(app_client):
    return app_client


@pytest_asyncio.fixture
async def test_user(app_client):
    """注册一个测试用户并返回 token。"""
    resp = await app_client.post("/api/v1/auth/register", json={"username": "testuser", "password": "testpass123"})
    assert resp.status_code == 201, f"注册失败: {resp.text}"

    resp = await app_client.post("/api/v1/auth/login", json={"username": "testuser", "password": "testpass123"})
    assert resp.status_code == 200, f"登录失败: {resp.text}"
    data = resp.json()
    return {
        "access_token": data["access_token"],
        "refresh_token": data["refresh_token"],
    }
