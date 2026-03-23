from __future__ import annotations

from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ProjectTask(TimestampMixin, Base):
    __tablename__ = "project_tasks"
    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "external_task_id",
            name="uq_project_tasks_project_external_task_id",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False, index=True)
    plugin_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    external_task_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    task_payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    publish_status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="offline",
        server_default=sa.text("'offline'"),
    )
    task_status: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="pending",
        server_default=sa.text("'pending'"),
        index=True,
    )
    is_visible: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=sa.false(),
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
