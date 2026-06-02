"""任务管理路由。"""

from fastapi import APIRouter, HTTPException, Query, status

from server.auth.deps import CurrentUser
from server.tasks.schemas import TaskListResponse

router = APIRouter(prefix="/tasks", tags=["任务管理"])


def _get_manager():
    from server.tasks.manager import AsyncTaskManager
    from server.api.inference_router import _get_worker
    # manager 在 main.py 中设置到全局
    return _task_manager_ref


_task_manager_ref = None


def set_task_manager(manager):
    global _task_manager_ref
    _task_manager_ref = manager


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
):
    manager = _get_manager()
    if manager is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="任务管理器未初始化")

    tasks, total = await manager.list_user_tasks(current_user.id, page, size, status_filter)
    return TaskListResponse(tasks=tasks, total=total, page=page, size=size)


@router.get("/{task_id}")
async def get_task(current_user: CurrentUser, task_id: str):
    manager = _get_manager()
    if manager is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="任务管理器未初始化")

    task_data = await manager.get_status(task_id)
    if task_data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")

    # 权限校验
    async with manager._db_factory() as db:
        from sqlalchemy import select
        from server.tasks.models import Task
        result = await db.execute(select(Task.user_id).where(Task.id == task_id))
        row = result.scalar_one_or_none()
        if row != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问此任务")

    return task_data


@router.delete("/{task_id}")
async def cancel_task(current_user: CurrentUser, task_id: str):
    manager = _get_manager()
    if manager is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="任务管理器未初始化")

    cancelled = await manager.cancel(task_id, current_user.id)
    if not cancelled:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在或无法取消")
    return {"message": "任务已取消", "task_id": task_id}
