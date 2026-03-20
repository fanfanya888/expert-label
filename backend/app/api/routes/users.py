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
)
from app.db.session import get_db
from app.schemas.user import UserCreate, UserList, UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", status_code=status.HTTP_201_CREATED)
def create_user_endpoint(
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


@router.get("")
def list_users_endpoint(
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


@router.get("/{user_id}")
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    data = UserRead.model_validate(user)
    return build_response(data=serialize_schema(data))

