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
    created_at: datetime
    updated_at: datetime


class ProjectTaskList(ListResult):
    items: list[ProjectTaskRead]
