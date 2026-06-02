"""任务管理接口测试。"""

import pytest

pytestmark = pytest.mark.asyncio


async def test_list_tasks_empty(client, test_user):
    resp = await client.get(
        "/api/v1/tasks",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["tasks"] == []


async def test_list_tasks_no_auth(client):
    resp = await client.get("/api/v1/tasks")
    assert resp.status_code in (401, 403)


async def test_get_task_not_found(client, test_user):
    resp = await client.get(
        "/api/v1/tasks/nonexistent-id",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
    )
    assert resp.status_code == 404


async def test_cancel_task_not_found(client, test_user):
    resp = await client.delete(
        "/api/v1/tasks/nonexistent-id",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
    )
    assert resp.status_code == 404
