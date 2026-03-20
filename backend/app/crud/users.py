from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


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


def list_users(db: Session, skip: int = 0, limit: int = 20) -> tuple[list[User], int]:
    statement = select(User).order_by(User.id.desc()).offset(skip).limit(limit)
    items = list(db.scalars(statement).all())
    total = db.scalar(select(func.count()).select_from(User)) or 0
    return items, total


def create_user(db: Session, payload: UserCreate) -> User:
    user = User(
        username=payload.username,
        email=payload.email,
        role=payload.role.value,
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user: User, payload: UserUpdate) -> User:
    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        if hasattr(value, "value"):
            setattr(user, field, value.value)
        else:
            setattr(user, field, value)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user
