"""FastAPI 应用入口。"""

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

import torch
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from server.api.inference_router import set_worker
from server.api.router import api_router
from server.config import get_settings
from server.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时初始化数据库和加载模型，shutdown 时清理。"""
    # 初始化数据库
    Path("data").mkdir(exist_ok=True)
    Path("output").mkdir(exist_ok=True)
    await init_db()

    # 加载模型
    settings = get_settings()
    os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

    from eagle_worker import EagleWorker
    from scripts.infer_example import _torch_dtype

    device = settings.device
    if device == "cuda" and not torch.cuda.is_available():
        device = "cpu"

    worker = EagleWorker(
        settings.model_path,
        device=device,
        dtype=_torch_dtype(settings.dtype),
    )
    set_worker(worker)

    # 初始化异步任务管理器
    from server.tasks.manager import AsyncTaskManager
    from server.api.task_router import set_task_manager
    from server.db import get_session_factory

    task_manager = AsyncTaskManager(worker, get_session_factory())
    set_task_manager(task_manager)
    task_manager.start()

    yield

    # 清理
    import asyncio
    await task_manager.stop()
    set_task_manager(None)
    set_worker(None)


def create_app(skip_lifespan: bool = False) -> FastAPI:
    lifespan_fn = None if skip_lifespan else lifespan

    app = FastAPI(
        title="LocateAnything Web Service",
        description="视觉定位与目标检测 Web 服务 API",
        version="1.0.0",
        lifespan=lifespan_fn,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # API 路由
    app.include_router(api_router)

    # 全局异常处理
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=500,
            content={"detail": f"服务器内部错误: {type(exc).__name__}: {exc}", "error_code": "INTERNAL_ERROR"},
        )

    # 静态文件挂载（React 构建产物）
    static_dir = Path(__file__).parent / "static"
    if static_dir.is_dir() and (static_dir / "index.html").is_file():
        app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="static-assets")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            # 非 API 路由返回 index.html（SPA fallback）
            file_path = static_dir / full_path
            if file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(static_dir / "index.html")

    return app


app = create_app()


def main():
    settings = get_settings()
    uvicorn.run(
        "server.main:app",
        host=settings.host,
        port=settings.port,
        reload=False,
    )


if __name__ == "__main__":
    main()
