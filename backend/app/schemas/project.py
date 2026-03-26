from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ListResult, ORMModel
from app.schemas.user import UserRead


class ProjectRead(ORMModel):
    id: int
    name: str
    description: str | None
    owner_id: int | None
    plugin_code: str | None
    entry_path: str | None
    publish_status: str
    is_visible: bool
    source_type: str
    external_url: str | None
    is_published: bool
    published_at: datetime | None
    published_by: int | None
    created_at: datetime
    updated_at: datetime
    task_total: int = 0
    task_completed: int = 0
    task_pending: int = 0
    owner: UserRead | None = None


class ProjectDetailRead(ProjectRead):
    instruction_markdown: str | None = None


class ProjectList(ListResult):
    items: list[ProjectRead]


class ProjectHallRead(ProjectRead):
    annotation_available_count: int = 0
    review_available_count: int = 0
    claim_progress_percent: int = 0
    current_user_annotation_limit: int = 1
    current_user_annotation_owned_count: int = 0
    current_user_task_id: str | None = None
    current_user_task_status: str | None = None
    current_user_review_limit: int = 3
    current_user_total_review_owned_count: int = 0
    current_user_review_owned_count: int = 0
    current_user_review_id: int | None = None
    current_user_review_task_id: str | None = None
    current_user_review_task_status: str | None = None
    trial_passed: bool = False
    can_claim_annotation: bool = False
    can_claim_review: bool = False


class ProjectHallList(ListResult):
    items: list[ProjectHallRead]


class ProjectInstructionUpdate(BaseModel):
    instruction_markdown: str | None = None


class ProjectInstructionAssetRead(BaseModel):
    url: str
    filename: str
    content_type: str
    size: int
    original_filename: str = ""
