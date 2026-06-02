"""推理路由：图片同步推理 + 视频/批量异步推理。"""

import json
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from PIL import Image

from server.auth.deps import CurrentUser
from server.tasks.schemas import BatchInferenceParams, VideoInferenceParams

router = APIRouter(prefix="/inference", tags=["推理"])

_VALID_TASKS = {"detect", "ground_multi", "detect_text", "point", "ground_gui", "chat"}
_VALID_MODES = {"fast", "slow", "hybrid"}
_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
_VIDEO_SUFFIXES = {".mp4", ".mov", ".avi", ".mkv", ".webm"}


@router.post("/image")
async def inference_image(
    current_user: CurrentUser,
    file: UploadFile = File(...),
    task: str = Form("ground_multi"),
    phrase: str = Form("person"),
    categories: str = Form("person"),
    question: str = Form("请详细描述这张图片。"),
    generation_mode: str = Form("hybrid"),
    max_new_tokens: int = Form(128),
    max_image_edge: int = Form(768),
    temperature: float = Form(0.7),
):
    # 校验任务类型
    if task not in _VALID_TASKS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"不支持的任务类型: {task}")
    if generation_mode not in _VALID_MODES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"不支持的生成模式: {generation_mode}")

    # 校验文件类型
    suffix = Path(file.filename).suffix.lower() if file.filename else ""
    if suffix not in _IMAGE_SUFFIXES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"不支持的图片格式: {suffix}")

    # 读取图片
    try:
        image_bytes = await file.read()
        from io import BytesIO
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="无法解析上传的图片文件")

    # 获取 worker
    from fastapi import Request
    # 通过函数级导入避免循环依赖，实际 worker 从 app.state 获取
    # 此处使用一个全局引用
    worker = _get_worker()
    if worker is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="模型未加载")

    # 预处理图片
    from scripts.infer_example import prepare_image, draw_annotations, run_task
    from types import SimpleNamespace

    model_image = prepare_image(image, max_image_edge)

    categories_list = [c.strip() for c in categories.split(",") if c.strip()]
    if not categories_list:
        categories_list = ["person"]

    task_args = SimpleNamespace(
        task=task,
        categories=categories_list,
        phrase=phrase or "person",
        question=question or "请详细描述这张图片。",
        generation_mode=generation_mode,
        max_new_tokens=int(max_new_tokens),
        temperature=float(temperature),
    )

    # 执行推理
    try:
        answer = run_task(worker, model_image, task_args)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"推理失败: {e}")

    # 生成标注图
    annotated = draw_annotations(image, answer)

    # 保存结果
    file_id = uuid.uuid4().hex[:12]
    output_dir = Path("output") / file_id
    output_dir.mkdir(parents=True, exist_ok=True)

    annotated_path = output_dir / "annotated.jpg"
    annotated.save(annotated_path)

    result_path = output_dir / "result.json"
    parsed_boxes = worker.parse_boxes(answer, image.width, image.height)
    result_data = {
        "answer": answer,
        "boxes": parsed_boxes,
        "task": task,
        "phrase": phrase,
        "model": worker.model_path,
    }
    result_path.write_text(json.dumps(result_data, ensure_ascii=False, indent=2), encoding="utf-8")

    return {
        "answer": answer,
        "boxes": parsed_boxes,
        "annotated_image_url": f"/output/{file_id}/annotated.jpg",
        "file_id": file_id,
    }


@router.post("/video", status_code=status.HTTP_202_ACCEPTED)
async def inference_video(
    current_user: CurrentUser,
    file: UploadFile = File(...),
    task: str = Form("ground_multi"),
    phrase: str = Form("person"),
    categories: str = Form("person"),
    question: str = Form("请详细描述这张图片。"),
    generation_mode: str = Form("hybrid"),
    max_new_tokens: int = Form(128),
    max_image_edge: int = Form(768),
    temperature: float = Form(0.7),
    every_n_frames: int = Form(10),
    max_frames: int = Form(0),
    reuse_last: bool = Form(True),
):
    # 校验文件类型
    suffix = Path(file.filename).suffix.lower() if file.filename else ""
    if suffix not in _VIDEO_SUFFIXES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"不支持的视频格式: {suffix}")

    # 保存上传文件
    task_id = str(uuid.uuid4())
    task_output_dir = Path("output") / task_id
    task_output_dir.mkdir(parents=True, exist_ok=True)
    input_path = task_output_dir / f"input{suffix}"

    content = await file.read()
    input_path.write_bytes(content)

    # 提交异步任务
    from server.api.task_router import _task_manager_ref
    manager = _task_manager_ref
    if manager is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="任务管理器未初始化")

    params = {
        "task": task,
        "phrase": phrase,
        "categories": categories,
        "question": question,
        "generation_mode": generation_mode,
        "max_new_tokens": max_new_tokens,
        "max_image_edge": max_image_edge,
        "temperature": temperature,
        "every_n_frames": every_n_frames,
        "max_frames": max_frames,
        "reuse_last": reuse_last,
    }

    actual_task_id = await manager.submit(current_user.id, "video", params, str(input_path))
    return {"task_id": actual_task_id, "status": "pending", "message": "视频标注任务已提交"}


@router.post("/batch", status_code=status.HTTP_202_ACCEPTED)
async def inference_batch(current_user: CurrentUser, params: BatchInferenceParams):
    from pathlib import Path as P
    if not P(params.input_dir).expanduser().exists():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"目录不存在: {params.input_dir}")

    from server.api.task_router import _task_manager_ref
    manager = _task_manager_ref
    if manager is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="任务管理器未初始化")

    task_id = await manager.submit(current_user.id, "batch", params.model_dump())
    return {"task_id": task_id, "status": "pending", "message": "批量标注任务已提交"}


# 全局 worker 引用，在 main.py lifespan 中设置
_worker_ref = None


def set_worker(worker):
    global _worker_ref
    _worker_ref = worker


def _get_worker():
    return _worker_ref
