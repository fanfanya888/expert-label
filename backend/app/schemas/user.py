from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import EmailStr, Field, model_validator

from app.schemas.common import ListResult, ORMModel


class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"


class UserCreate(ORMModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.USER
    is_active: bool = True
    can_annotate: bool = True
    can_review: bool = False

    @model_validator(mode="after")
    def validate_user_permissions(self) -> "UserCreate":
        if self.role == UserRole.ADMIN:
            self.can_annotate = False
            self.can_review = False
            return self

        if not self.can_annotate and not self.can_review:
            raise ValueError("用户至少需要一种作业权限")
        return self


class UserUpdate(ORMModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: UserRole | None = None
    is_active: bool | None = None
    can_annotate: bool | None = None
    can_review: bool | None = None


class UserRead(ORMModel):
    id: int
    username: str
    email: EmailStr
    role: UserRole
    is_active: bool
    can_annotate: bool
    can_review: bool
    last_login_at: datetime | None
    created_at: datetime
    updated_at: datetime


class UserList(ListResult):
    items: list[UserRead]
