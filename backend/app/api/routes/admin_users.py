from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.response import build_response, serialize_schema
from app.crud.users import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    get_user_by_username,
    list_users,
    update_user,
)
from app.db.session import get_db
from app.schemas.user import UserCreate, UserList, UserRead, UserUpdate

router = APIRouter(prefix="/admin/users", tags=["admin-users"])


@router.get("")
def list_admin_users(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    items, total = list_users(db, skip=skip, limit=limit)
    data = UserList(
        total=total,
        items=[UserRead.model_validate(item) for item in items],
    )
    return build_response(data=serialize_schema(data))


@router.post("", status_code=status.HTTP_201_CREATED)
def create_admin_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    if get_user_by_username(db, payload.username):
        raise HTTPException(status_code=400, detail="Username already exists")
    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Email already exists")

    user = create_user(db, payload)
    data = UserRead.model_validate(user)
    return build_response(
        code=status.HTTP_201_CREATED,
        message="User created",
        data=serialize_schema(data),
    )


@router.get("/{user_id}")
def get_admin_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    data = UserRead.model_validate(user)
    return build_response(data=serialize_schema(data))


@router.patch("/{user_id}")
def update_admin_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.username and get_user_by_username(db, payload.username, exclude_user_id=user_id):
        raise HTTPException(status_code=400, detail="Username already exists")
    if payload.email and get_user_by_email(db, payload.email, exclude_user_id=user_id):
        raise HTTPException(status_code=400, detail="Email already exists")

    updated_user = update_user(db, user, payload)
    data = UserRead.model_validate(updated_user)
    return build_response(
        message="User updated",
        data=serialize_schema(data),
    )
