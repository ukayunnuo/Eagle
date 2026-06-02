"""任务相关的 Pydantic 模型。"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TaskCreate(BaseModel):
    task_type: str = Field(..., pattern="^(video|batch)$")
    params: dict[str, Any]


class TaskStatus(BaseModel):
    task_id: str
    task_type: str
    status: str
    progress: dict[str, Any] | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class TaskListResponse(BaseModel):
    tasks: list[TaskStatus]
    total: int
    page: int
    size: int


class VideoInferenceParams(BaseModel):
    task: str = "ground_multi"
    phrase: str = "person"
    categories: str = "person"
    question: str = "请详细描述这张图片。"
    generation_mode: str = "hybrid"
    max_new_tokens: int = 128
    max_image_edge: int = 768
    temperature: float = 0.7
    every_n_frames: int = 10
    max_frames: int = 0
    reuse_last: bool = True


class BatchInferenceParams(BaseModel):
    input_dir: str
    task: str = "ground_multi"
    phrase: str = "person"
    categories: str = "person"
    question: str = "请详细描述这张图片。"
    generation_mode: str = "hybrid"
    max_new_tokens: int = 128
    max_image_edge: int = 768
    temperature: float = 0.7
    every_n_frames: int = 10
    max_frames: int = 0
    reuse_last: bool = True
    include_images: bool = True
    include_videos: bool = False
    recursive: bool = True
    max_files: int = 0
