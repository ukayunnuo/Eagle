"""统一日志配置。

用法：
    # server/ 模块内（推荐从此处导入）
    from server.log import get_logger
    logger = get_logger(__name__)

    # server/ 外的模块（如 scripts/、eagle_worker.py）
    import logging
    logger = logging.getLogger(__name__)

两种方式等价，get_logger 只是 logging.getLogger 的薄封装。
"""

import logging
import sys

_FMT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"
_DATE_FMT = "%Y-%m-%d %H:%M:%S"


def setup_logging(level: str = "INFO") -> None:
    """配置根日志器，统一格式输出到 stderr。

    Args:
        level: 日志级别，支持 DEBUG / INFO / WARNING / ERROR。
    """
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format=_FMT,
        datefmt=_DATE_FMT,
        stream=sys.stderr,
        force=True,
    )

    # 降低第三方库噪音
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """获取指定名称的 logger。"""
    return logging.getLogger(name)
