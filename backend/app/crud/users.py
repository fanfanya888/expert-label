from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import hash_session_token
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


def get_usernames_map(db: Session, user_ids: list[int]) -> dict[int, str]:
    normalized_ids = sorted({user_id for user_id in user_ids if user_id > 0})
    if not normalized_ids:
        return {}

    rows = db.execute(
        select(User.id, User.username).where(User.id.in_(normalized_ids))
    ).all()
    return {
        int(row.id): str(row.username)
        for row in rows
    }


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.get(User, user_id)


def get_user_by_username(
    db: Session,
    username: str,
    exclude_user_id: int | None = None,
) -> User | None:
    statement = select(User).where(User.username == username)
    if exclude_user_id is not None:
        statement = statement.where(User.id != exclude_user_id)
    return db.scalar(statement)


def get_user_by_email(
    db: Session,
    email: str,
    exclude_user_id: int | None = None,
) -> User | None:
    statement = select(User).where(User.email == email)
    if exclude_user_id is not None:
        statement = statement.where(User.id != exclude_user_id)
    return db.scalar(statement)


def get_user_by_login(db: Session, username_or_email: str) -> User | None:
    normalized_value = username_or_email.strip()
    statement = select(User).where(
        (User.username == normalized_value) | (User.email == normalized_value)
    )
    return db.scalar(statement)


def get_user_by_session_token_hash(db: Session, session_token: str) -> User | None:
    statement = select(User).where(User.session_token_hash == hash_session_token(session_token))
    return db.scalar(statement)


def list_users(db: Session, skip: int = 0, limit: int = 20) -> tuple[list[User], int]:
    statement = select(User).order_by(User.id.desc()).offset(skip).limit(limit)
    items = list(db.scalars(statement).all())
    total = db.scalar(select(func.count()).select_from(User)) or 0
    return items, total


def create_user(db: Session, payload: UserCreate, password_hash: str) -> User:
    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=password_hash,
        role=payload.role.value,
        is_active=payload.is_active,
        can_annotate=payload.can_annotate,
        can_review=payload.can_review,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(
    db: Session,
    user: User,
    payload: UserUpdate,
    password_hash: str | None = None,
) -> User:
    update_data = payload.model_dump(exclude_unset=True, exclude={"password"})

    for field, value in update_data.items():
        if hasattr(value, "value"):
            setattr(user, field, value.value)
        else:
            setattr(user, field, value)

    if password_hash is not None:
        user.password_hash = password_hash
        user.session_token_hash = None
        user.session_expires_at = None

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user_login_session(
    db: Session,
    user: User,
    *,
    session_token_hash: str | None,
    session_expires_at: datetime | None,
    last_login_at: datetime | None = None,
) -> User:
    user.session_token_hash = session_token_hash
    user.session_expires_at = session_expires_at
    if last_login_at is not None:
        user.last_login_at = last_login_at

    db.add(user)
    db.commit()
    db.refresh(user)
    return user
