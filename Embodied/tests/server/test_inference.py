"""推理接口测试。"""

import io
import json

import pytest
from PIL import Image
from unittest.mock import MagicMock

pytestmark = pytest.mark.asyncio


def _make_test_image() -> bytes:
    """创建一个测试用的小图片。"""
    img = Image.new("RGB", (100, 100), color="red")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


async def test_image_inference(client, test_user):
    # mock worker 的返回值
    from server.api.inference_router import _get_worker
    worker = _get_worker()
    worker.detect.return_value = {"answer": "<ref>person</ref><box><100><200><300><400></box>"}
    worker.parse_boxes.return_value = [{"label": "person", "x1": 10, "y1": 20, "x2": 30, "y2": 40}]
    worker.model_path = "test-model"

    image_bytes = _make_test_image()
    resp = await client.post(
        "/api/v1/inference/image",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        files={"file": ("test.jpg", image_bytes, "image/jpeg")},
        data={"task": "detect", "categories": "person"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert "boxes" in data
    assert "annotated_image_url" in data


async def test_image_inference_invalid_task(client, test_user):
    image_bytes = _make_test_image()
    resp = await client.post(
        "/api/v1/inference/image",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        files={"file": ("test.jpg", image_bytes, "image/jpeg")},
        data={"task": "invalid_task"},
    )
    assert resp.status_code == 422


async def test_image_inference_invalid_format(client, test_user):
    resp = await client.post(
        "/api/v1/inference/image",
        headers={"Authorization": f"Bearer {test_user['access_token']}"},
        files={"file": ("test.txt", b"not an image", "text/plain")},
        data={"task": "detect"},
    )
    assert resp.status_code == 422


async def test_image_inference_no_auth(client):
    image_bytes = _make_test_image()
    resp = await client.post(
        "/api/v1/inference/image",
        files={"file": ("test.jpg", image_bytes, "image/jpeg")},
        data={"task": "detect"},
    )
    assert resp.status_code in (401, 403)
