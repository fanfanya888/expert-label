from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.response import build_response, serialize_schema
from app.core.security import hash_session_token, issue_session_token, verify_password
from app.crud.users import get_user_by_login, update_user_login_session
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import AuthLoginPayload, AuthSessionRead, AuthUserRead

router = APIRouter(prefix="/auth", tags=["auth"])

SESSION_TTL = timedelta(days=7)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _build_session_response(user: User, access_token: str, expires_at: datetime) -> AuthSessionRead:
    return AuthSessionRead(
        access_token=access_token,
        token_type="bearer",
        expires_at=expires_at,
        user=AuthUserRead.model_validate(user),
    )


@router.post("/login")
def login(
    payload: AuthLoginPayload,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    user = get_user_by_login(db, payload.username)
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码错误")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号已禁用")

    access_token = issue_session_token()
    now = _utc_now()
    expires_at = now + SESSION_TTL
    update_user_login_session(
        db,
        user,
        session_token_hash=hash_session_token(access_token),
        session_expires_at=expires_at,
        last_login_at=now,
    )
    data = _build_session_response(user, access_token, expires_at)
    return build_response(message="登录成功", data=serialize_schema(data))


@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    update_user_login_session(
        db,
        current_user,
        session_token_hash=None,
        session_expires_at=None,
    )
    return build_response(message="已退出登录", data=None)


@router.get("/me")
def get_current_session_user(
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    data = AuthUserRead.model_validate(current_user)
    return build_response(data=serialize_schema(data))
