"""集中管理所有环境变量配置。"""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置，通过环境变量或 .env 文件加载。"""

    # 模型配置
    model_path: str = "nvidia/LocateAnything-3B"
    device: str = "cuda"
    dtype: str = "bfloat16"

    # JWT 认证
    jwt_secret: str  # 必填，无默认值
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # 数据库
    db_url: str = "sqlite+aiosqlite:///./data/app.db"

    # 上传限制（MB）
    max_upload_image_mb: int = 20
    max_upload_video_mb: int = 500

    # 服务器
    host: str = "0.0.0.0"
    port: int = 8000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
