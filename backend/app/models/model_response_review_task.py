from __future__ import annotations

from typing import Any

from sqlalchemy import ForeignKey, Index, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ModelResponseReviewTask(TimestampMixin, Base):
    __tablename__ = "model_response_review_tasks"
    __table_args__ = (
        UniqueConstraint("task_id", name="model_response_review_tasks_task_id_key"),
        Index("ix_model_response_review_tasks_task_id", "task_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(String(100), nullable=False)
    prompt: Mapped[str] = mapped_column(Text(), nullable=False)
    model_reply: Mapped[str] = mapped_column(Text(), nullable=False)
    task_category: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    task_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)
    rubric_version: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending",
        index=True,
    )
