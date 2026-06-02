"""总路由：组装所有子路由。"""

from fastapi import APIRouter

from server.api.auth_router import router as auth_router
from server.api.inference_router import router as inference_router
from server.api.model_router import router as model_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(inference_router)
api_router.include_router(model_router)
