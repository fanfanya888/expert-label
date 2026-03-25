from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.common import ListResult


class UserSubmissionRecordRead(BaseModel):
    submission_type: Literal["annotation", "review"] = "annotation"
    plugin_code: str
    plugin_name: str
    submission_id: int
    project_id: int | None
    project_name: str | None = None
    task_id: str
    current_status: str | None = None
    submitted_at: datetime
    title: str
    summary: str | None = None
    result_label: str | None = None
    review_round: int | None = None
    review_result: str | None = None
    review_comment: str | None = None


class UserSubmissionRecordList(ListResult):
    items: list[UserSubmissionRecordRead]
