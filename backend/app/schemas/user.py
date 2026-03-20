from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import EmailStr, Field

from app.schemas.common import ListResult, ORMModel


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    ANNOTATOR = "annotator"


class UserCreate(ORMModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    role: UserRole = UserRole.ANNOTATOR
    is_active: bool = True


class UserUpdate(ORMModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: EmailStr | None = None
    role: UserRole | None = None
    is_active: bool | None = None


class UserRead(ORMModel):
    id: int
    username: str
    email: EmailStr
    role: UserRole
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime


class UserList(ListResult):
    items: list[UserRead]
