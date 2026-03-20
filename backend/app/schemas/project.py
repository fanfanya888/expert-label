from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ListResult, ORMModel
from app.schemas.user import UserRead


class ProjectPublishPayload(BaseModel):
    published_by_user_id: int | None = None


class ProjectRead(ORMModel):
    id: int
    name: str
    description: str | None
    owner_id: int | None
    external_url: str | None
    is_published: bool
    published_at: datetime | None
    published_by: int | None
    created_at: datetime
    updated_at: datetime
    owner: UserRead | None = None


class ProjectList(ListResult):
    items: list[ProjectRead]
