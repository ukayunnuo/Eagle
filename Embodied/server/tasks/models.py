"""任务相关的 SQLAlchemy 模型。"""

import uuid
from datetime import datetime

from sqlalchemy import Integer, String, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from server.db import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    task_type: Mapped[str] = mapped_column(String(20), nullable=False)  # image / video / batch
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    params: Mapped[str] = mapped_column(Text, nullable=False)  # JSON
    input_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    output_dir: Mapped[str | None] = mapped_column(String(500), nullable=True)
    progress: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    result: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
