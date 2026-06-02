"""模型信息路由 + 文件下载路由。"""

import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from server.auth.deps import CurrentUser

router = APIRouter(tags=["模型与文件"])

_OUTPUT_ROOT = Path("output").resolve()
_LOCATEANY_TASKS = ["detect", "ground_multi", "detect_text", "point", "ground_gui"]
_EAGLE2_TASKS = _LOCATEANY_TASKS + ["chat"]


def _get_worker():
    from server.api.inference_router import _get_worker as gw
    return gw()


@router.get("/models")
async def get_model_info(current_user: CurrentUser):
    worker = _get_worker()
    if worker is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="模型未加载")

    supported_tasks = _LOCATEANY_TASKS if worker.family == "locateanything" else _EAGLE2_TASKS
    return {
        "current_model": worker.model_path,
        "family": worker.family,
        "device": worker.device,
        "dtype": str(worker.dtype),
        "supported_tasks": supported_tasks,
        "supports_generation_mode": worker.family == "locateanything",
    }


@router.get("/files/{file_id}/{filename}")
async def download_file(current_user: CurrentUser, file_id: str, filename: str):
    # 路径安全校验：只允许 output/{file_id}/{filename}
    if not re.match(r"^[a-f0-9]{12}$", file_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的文件 ID")
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的文件名")

    file_path = (_OUTPUT_ROOT / file_id / filename).resolve()
    if not str(file_path).startswith(str(_OUTPUT_ROOT)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="访问被拒绝")
    if not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")

    return FileResponse(file_path)
