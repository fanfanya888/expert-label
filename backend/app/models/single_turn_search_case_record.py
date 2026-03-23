from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SingleTurnSearchCaseRecord(Base):
    __tablename__ = "single_turn_search_case_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id"), nullable=True, index=True)
    task_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    annotator_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    domain: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    scenario_description: Mapped[str] = mapped_column(Text(), nullable=False)
    prompt: Mapped[str] = mapped_column(Text(), nullable=False)
    timeliness_tag: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    model_a_name: Mapped[str] = mapped_column(String(64), nullable=False)
    model_a_response_text: Mapped[str] = mapped_column(Text(), nullable=False)
    model_a_share_link: Mapped[str] = mapped_column(Text(), nullable=False)
    model_a_screenshot: Mapped[str] = mapped_column(Text(), nullable=False)

    model_b_name: Mapped[str] = mapped_column(String(64), nullable=False)
    model_b_response_text: Mapped[str] = mapped_column(Text(), nullable=False)
    model_b_share_link: Mapped[str] = mapped_column(Text(), nullable=False)
    model_b_screenshot: Mapped[str] = mapped_column(Text(), nullable=False)

    reference_answer: Mapped[str] = mapped_column(Text(), nullable=False)
    scoring_rules: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    model_a_evaluations: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    model_b_evaluations: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    template_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    score_summary: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    soft_checks: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)

    rule_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    penalty_rule_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    positive_total_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model_a_raw_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model_a_percentage: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    model_b_raw_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    model_b_percentage: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    score_gap: Mapped[float] = mapped_column(Float, nullable=False, default=0)

    status: Mapped[str] = mapped_column(String(32), nullable=False, default="submitted", index=True)
    plugin_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    plugin_version: Mapped[str] = mapped_column(String(32), nullable=False)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
