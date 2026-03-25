from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ListResult


class UserSubmissionRecordRead(BaseModel):
    plugin_code: str
    plugin_name: str
    submission_id: int
    project_id: int | None
    project_name: str | None = None
    task_id: str
    submitted_at: datetime
    title: str
    summary: str | None = None
    result_label: str | None = None


class UserSubmissionRecordList(ListResult):
    items: list[UserSubmissionRecordRead]
