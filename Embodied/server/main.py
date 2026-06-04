"""FastAPI 应用入口。"""

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
from server.log import get_logger, setup_logging

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时初始化数据库和加载模型，shutdown 时清理。"""
    logger.info("应用启动中...")

    # 初始化数据库（模型注册在 init_db 内部完成）
    Path("data").mkdir(exist_ok=True)
    Path("output").mkdir(exist_ok=True)
    await init_db()
    logger.info("数据库初始化完成")

    # 加载模型
    settings = get_settings()
    os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

    from eagle_worker import EagleWorker
    from scripts.infer_example import _torch_dtype

    device = settings.device
    if device == "cuda" and not torch.cuda.is_available():
        device = "cpu"
        logger.warning("CUDA 不可用，回退到 CPU 推理")

    logger.info("正在加载模型: %s (device=%s, dtype=%s)", settings.model_path, device, settings.dtype)
    worker = EagleWorker(
        settings.model_path,
        device=device,
        dtype=_torch_dtype(settings.dtype),
    )
    set_worker(worker)
    logger.info("模型加载完成: %s (family=%s)", settings.model_path, worker.family)

    # 初始化异步任务管理器
    from server.tasks.manager import AsyncTaskManager
    from server.api.task_router import set_task_manager
    from server.db import get_session_factory

    task_manager = AsyncTaskManager(worker, get_session_factory())
    set_task_manager(task_manager)
    task_manager.start()
    logger.info("异步任务管理器已启动")

    logger.info("应用启动完成，监听 %s:%s", settings.host, settings.port)
    yield

    # 清理
    logger.info("应用关闭中...")
    await task_manager.stop()
    set_task_manager(None)
    set_worker(None)
    logger.info("应用已关闭")


def create_app(skip_lifespan: bool = False) -> FastAPI:
    setup_logging()
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
        allow_origins=[
            "http://localhost:3000",  # Next.js dev server
            "http://127.0.0.1:3000",
            "http://localhost:5173",  # Vite dev server (legacy)
            "http://127.0.0.1:5173",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # API 路由
    app.include_router(api_router)

    # 输出文件静态服务（无需认证，供 <img> <video> 直接引用）
    output_dir = Path("output")
    output_dir.mkdir(exist_ok=True)
    app.mount("/output", StaticFiles(directory=str(output_dir)), name="output-files")

    # 全局异常处理
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception("未处理的异常: %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "服务器内部错误，请稍后重试", "error_code": "INTERNAL_ERROR"},
        )

    # 静态文件挂载（React 构建产物）
    static_dir = Path(__file__).parent / "static"
    if static_dir.is_dir() and (static_dir / "index.html").is_file():
        assets_dir = static_dir / "assets"
        if assets_dir.is_dir():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="static-assets")

        next_static_dir = static_dir / "_next"
        if next_static_dir.is_dir():
            app.mount("/_next", StaticFiles(directory=str(next_static_dir)), name="next-static")

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            # 非 API 路由返回 index.html（SPA fallback）
            file_path = static_dir / full_path
            if file_path.is_file():
                return FileResponse(file_path)
            html_path = static_dir / f"{full_path}.html"
            if html_path.is_file():
                return FileResponse(html_path)
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
