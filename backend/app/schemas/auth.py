from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserRole


class AuthLoginPayload(BaseModel):
    username: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class AuthUserRead(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: UserRole
    can_annotate: bool
    can_review: bool

    model_config = {"from_attributes": True}


class AuthSessionRead(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user: AuthUserRead
