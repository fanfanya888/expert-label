from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ModelResponseReviewRecord(Base):
    __tablename__ = "model_response_review_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    task_id: Mapped[str] = mapped_column(String(100), index=True)
    annotator_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    task_category: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    answer_rating: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    rating_reason: Mapped[str] = mapped_column(Text(), nullable=False)
    prompt_snapshot: Mapped[str] = mapped_column(Text(), nullable=False)
    model_reply_snapshot: Mapped[str] = mapped_column(Text(), nullable=False)
    rubric_version: Mapped[str] = mapped_column(String(32), nullable=False)
    rubric_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    record_metadata: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSON, nullable=True)
    plugin_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    plugin_version: Mapped[str] = mapped_column(String(32), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
