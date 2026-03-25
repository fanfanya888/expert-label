from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.crud.users import get_user_by_session_token_hash
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserRole

bearer_scheme = HTTPBearer(auto_error=False)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _clear_user_session(db: Session, user: User) -> None:
    user.session_token_hash = None
    user.session_expires_at = None
    db.add(user)
    db.commit()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录")

    token = credentials.credentials.strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录")

    user = get_user_by_session_token_hash(db, token)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已失效，请重新登录")

    expires_at = _as_utc(user.session_expires_at)
    if expires_at is None or expires_at <= _utc_now():
        _clear_user_session(db, user)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已失效，请重新登录")

    if not user.is_active:
        _clear_user_session(db, user)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号已禁用")

    return user


def require_admin_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可访问")
    return current_user


def require_end_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.USER.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅用户可访问")
    return current_user


def require_annotator_user(current_user: User = Depends(require_end_user)) -> User:
    if not current_user.can_annotate:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号没有标注权限")
    return current_user


def require_reviewer_user(current_user: User = Depends(require_end_user)) -> User:
    if not current_user.can_review:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="当前账号没有质检权限")
    return current_user
