"""认证接口集成测试。"""

import pytest

pytestmark = pytest.mark.asyncio


async def test_register_success(client):
    resp = await client.post("/api/v1/auth/register", json={"username": "alice", "password": "secret123"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["username"] == "alice"
    assert "id" in data
    assert "created_at" in data


async def test_register_duplicate(client):
    await client.post("/api/v1/auth/register", json={"username": "bob", "password": "secret123"})
    resp = await client.post("/api/v1/auth/register", json={"username": "bob", "password": "other456"})
    assert resp.status_code == 409


async def test_register_short_password(client):
    resp = await client.post("/api/v1/auth/register", json={"username": "charlie", "password": "ab"})
    assert resp.status_code == 422


async def test_login_success(client):
    await client.post("/api/v1/auth/register", json={"username": "dave", "password": "secret123"})
    resp = await client.post("/api/v1/auth/login", json={"username": "dave", "password": "secret123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0


async def test_login_wrong_password(client):
    await client.post("/api/v1/auth/register", json={"username": "eve", "password": "secret123"})
    resp = await client.post("/api/v1/auth/login", json={"username": "eve", "password": "wrong"})
    assert resp.status_code == 401


async def test_login_nonexistent_user(client):
    resp = await client.post("/api/v1/auth/login", json={"username": "nobody", "password": "secret123"})
    assert resp.status_code == 401


async def test_me_success(client, test_user):
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {test_user['access_token']}"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "testuser"


async def test_me_no_token(client):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code in (401, 403)


async def test_me_invalid_token(client):
    resp = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid"})
    assert resp.status_code == 401


async def test_refresh_success(client, test_user):
    resp = await client.post(
        "/api/v1/auth/refresh",
        headers={"Authorization": f"Bearer {test_user['refresh_token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


async def test_refresh_with_access_token_fails(client, test_user):
    resp = await client.post(
        "/api/v1/auth/refresh",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
    )
    assert resp.status_code == 401
