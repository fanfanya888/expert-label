from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import ListResult, ORMModel


class ProjectTaskCreate(BaseModel):
    external_task_id: str | None = Field(default=None, max_length=100)
    task_payload: dict[str, Any]


class ProjectTaskRead(ORMModel):
    id: int
    project_id: int
    plugin_code: str
    external_task_id: str
    task_payload: dict[str, Any]
    publish_status: str
    task_status: str
    is_visible: bool
    published_at: datetime | None
    annotation_assignee_id: int | None = None
    annotation_assignee_username: str | None = None
    annotation_claimed_at: datetime | None = None
    annotation_submitted_at: datetime | None = None
    approved_at: datetime | None = None
    review_round_count: int = 0
    latest_reviewer_id: int | None = None
    latest_reviewer_username: str | None = None
    latest_review_status: str | None = None
    created_at: datetime
    updated_at: datetime


class ProjectTaskList(ListResult):
    items: list[ProjectTaskRead]


class ProjectTaskReviewRead(ORMModel):
    id: int
    project_task_id: int
    review_round: int
    review_status: str
    reviewer_id: int | None
    reviewer_username: str | None = None
    review_result: str | None
    review_comment: str | None
    claimed_at: datetime | None
    submitted_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ProjectTaskReviewSubmit(BaseModel):
    review_result: str = Field(pattern="^(pass|reject)$")
    review_comment: str = Field(min_length=1, max_length=2000)


class ProjectTaskReviewTaskDetail(BaseModel):
    review: ProjectTaskReviewRead
    task: ProjectTaskRead
    submission: dict[str, Any] | None
    review_history: list[ProjectTaskReviewRead] = Field(default_factory=list)
