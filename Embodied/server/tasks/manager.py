"""异步任务管理器：提交、查询、取消、后台 worker 协程。"""

import asyncio
import json
import shutil
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from server.log import get_logger
from server.tasks.models import Task

logger = get_logger(__name__)


class AsyncTaskManager:
    """内存任务队列 + 后台 worker 协程，单 GPU 串行处理。"""

    def __init__(self, worker, db_session_factory: async_sessionmaker):
        self._worker = worker
        self._db_factory = db_session_factory
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._gpu_lock = asyncio.Lock()
        self._worker_task: asyncio.Task | None = None
        self._running = False

    async def submit(self, user_id: int, task_type: str, params: dict, input_path: str | None = None) -> str:
        """提交任务，返回 task_id。"""
        task_id = str(uuid.uuid4())
        output_dir = str(Path("output") / task_id)

        async with self._db_factory() as db:
            task = Task(
                id=task_id,
                user_id=user_id,
                task_type=task_type,
                status="pending",
                params=json.dumps(params, ensure_ascii=False),
                input_path=input_path,
                output_dir=output_dir,
            )
            db.add(task)
            await db.commit()

        await self._queue.put(task_id)
        logger.info("任务已提交: task_id=%s type=%s user_id=%s", task_id, task_type, user_id)
        return task_id

    async def get_status(self, task_id: str) -> dict | None:
        async with self._db_factory() as db:
            result = await db.execute(select(Task).where(Task.id == task_id))
            task = result.scalar_one_or_none()
            if task is None:
                return None
            return self._task_to_dict(task)

    async def cancel(self, task_id: str, user_id: int) -> bool:
        async with self._db_factory() as db:
            result = await db.execute(select(Task).where(Task.id == task_id, Task.user_id == user_id))
            task = result.scalar_one_or_none()
            if task is None or task.status != "pending":
                return False
            task.status = "cancelled"
            task.completed_at = datetime.now(timezone.utc)
            await db.commit()
            return True

    async def list_user_tasks(self, user_id: int, page: int = 1, size: int = 20, status: str | None = None):
        async with self._db_factory() as db:
            query = select(Task).where(Task.user_id == user_id)
            if status:
                query = query.where(Task.status == status)
            query = query.order_by(Task.created_at.desc())

            # 总数
            count_query = select(func.count()).select_from(query.subquery())
            total = (await db.execute(count_query)).scalar() or 0

            # 分页
            query = query.offset((page - 1) * size).limit(size)
            result = await db.execute(query)
            tasks = result.scalars().all()

            return [self._task_to_dict(t) for t in tasks], total

    def start(self):
        """启动后台 worker 协程。"""
        self._running = True
        self._worker_task = asyncio.create_task(self._worker_loop())
        logger.info("后台任务 worker 已启动")

    async def stop(self):
        """停止后台 worker 协程。"""
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info("后台任务 worker 已停止")

    async def _worker_loop(self):
        """后台循环：从队列取任务并执行推理。"""
        while self._running:
            try:
                task_id = await asyncio.wait_for(self._queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                break

            async with self._gpu_lock:
                await self._execute_task(task_id)

    async def _execute_task(self, task_id: str):
        """执行单个任务。"""
        loop = asyncio.get_event_loop()

        async with self._db_factory() as db:
            result = await db.execute(select(Task).where(Task.id == task_id))
            task = result.scalar_one_or_none()
            if task is None or task.status == "cancelled":
                return

            task.status = "processing"
            task.started_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info("任务开始执行: task_id=%s type=%s", task_id, task.task_type)

        try:
            params = json.loads(task.params)

            if task.task_type == "video":
                await loop.run_in_executor(None, self._run_video_task, task_id, params, task.input_path, task.output_dir)
            elif task.task_type == "batch":
                await loop.run_in_executor(None, self._run_batch_task, task_id, params, task.output_dir)

            # 更新完成状态
            async with self._db_factory() as db:
                result = await db.execute(select(Task).where(Task.id == task_id))
                task = result.scalar_one_or_none()
                if task:
                    task.status = "completed"
                    task.completed_at = datetime.now(timezone.utc)
                    # 读取结果摘要
                    result_path = Path(task.output_dir) / "result.json"
                    if result_path.exists():
                        task.result = result_path.read_text(encoding="utf-8")
                    await db.commit()
                    logger.info("任务执行完成: task_id=%s", task_id)

        except Exception:
            logger.exception("任务执行失败: task_id=%s", task_id)
            async with self._db_factory() as db:
                result = await db.execute(select(Task).where(Task.id == task_id))
                task = result.scalar_one_or_none()
                if task:
                    task.status = "failed"
                    task.error = traceback.format_exc()
                    task.completed_at = datetime.now(timezone.utc)
                    await db.commit()

    def _run_video_task(self, task_id: str, params: dict, input_path: str, output_dir: str):
        """在线程池中执行视频推理（同步）。"""
        from scripts.annotate_video import annotate_video

        logger.debug("视频任务开始: task_id=%s input=%s", task_id, input_path)
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        args = SimpleNamespace(
            video=input_path,
            model=self._worker.model_path,
            task=params.get("task", "ground_multi"),
            categories=[c.strip() for c in params.get("categories", "person").split(",") if c.strip()],
            phrase=params.get("phrase", "person"),
            question=params.get("question", "请详细描述这张图片。"),
            device=self._worker.device,
            dtype=str(self._worker.dtype),
            generation_mode=params.get("generation_mode", "hybrid"),
            max_new_tokens=params.get("max_new_tokens", 128),
            max_image_edge=params.get("max_image_edge", 768),
            temperature=params.get("temperature", 0.7),
            every_n_frames=params.get("every_n_frames", 10),
            max_frames=params.get("max_frames", 0),
            output_video=str(out / "annotated.mp4"),
            output_json=str(out / "result.json"),
            reuse_last=params.get("reuse_last", True),
        )
        annotate_video(args, worker=self._worker)

    def _run_batch_task(self, task_id: str, params: dict, output_dir: str):
        """在线程池中执行批量推理（同步）。"""
        from scripts.web_ui import run_batch_annotation

        logger.debug("批量任务开始: task_id=%s input_dir=%s", task_id, params.get("input_dir"))
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        summary_json, _ = run_batch_annotation(
            input_dir=params["input_dir"],
            task=params.get("task", "ground_multi"),
            categories_text=params.get("categories", "person"),
            phrase=params.get("phrase", "person"),
            generation_mode=params.get("generation_mode", "hybrid"),
            max_new_tokens=params.get("max_new_tokens", 128),
            max_image_edge=params.get("max_image_edge", 768),
            temperature=params.get("temperature", 0.7),
            every_n_frames=params.get("every_n_frames", 10),
            max_frames=params.get("max_frames", 0),
            reuse_last=params.get("reuse_last", True),
            include_images=params.get("include_images", True),
            include_videos=params.get("include_videos", False),
            recursive=params.get("recursive", True),
            max_files=params.get("max_files", 0),
            model=self._worker.model_path,
            device=self._worker.device,
            dtype=str(self._worker.dtype),
            question=params.get("question", "请详细描述这张图片。"),
        )
        # 复制结果到任务输出目录
        src = Path(summary_json)
        if src.exists():
            shutil.copy2(src, out / "result.json")

    @staticmethod
    def _task_to_dict(task: Task) -> dict:
        return {
            "task_id": task.id,
            "task_type": task.task_type,
            "status": task.status,
            "progress": json.loads(task.progress) if task.progress else None,
            "result": json.loads(task.result) if task.result else None,
            "error": task.error,
            "created_at": task.created_at.isoformat() if task.created_at else None,
            "started_at": task.started_at.isoformat() if task.started_at else None,
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
        }
