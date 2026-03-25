from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import require_admin_user
from app.core.security import hash_password
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
from app.schemas.user import UserCreate, UserList, UserRead, UserRole, UserUpdate

router = APIRouter(
    prefix="/admin/users",
    tags=["admin-users"],
    dependencies=[Depends(require_admin_user)],
)


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
        raise HTTPException(status_code=400, detail="账号已存在")
    if get_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="邮箱已存在")

    user = create_user(db, payload, password_hash=hash_password(payload.password))
    data = UserRead.model_validate(user)
    return build_response(
        code=status.HTTP_201_CREATED,
        message="账号已创建",
        data=serialize_schema(data),
    )


@router.get("/{user_id}")
def get_admin_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="账号不存在")

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
        raise HTTPException(status_code=404, detail="账号不存在")

    if payload.username and get_user_by_username(db, payload.username, exclude_user_id=user_id):
        raise HTTPException(status_code=400, detail="账号已存在")
    if payload.email and get_user_by_email(db, payload.email, exclude_user_id=user_id):
        raise HTTPException(status_code=400, detail="邮箱已存在")

    normalized_payload = payload
    target_role = payload.role or UserRole(user.role)
    target_can_annotate = payload.can_annotate if payload.can_annotate is not None else user.can_annotate
    target_can_review = payload.can_review if payload.can_review is not None else user.can_review

    if target_role == UserRole.ADMIN:
        normalized_payload = payload.model_copy(update={"can_annotate": False, "can_review": False})
    elif not target_can_annotate and not target_can_review:
        raise HTTPException(status_code=400, detail="用户至少需要一种作业权限")

    password_hash = hash_password(payload.password) if payload.password else None
    updated_user = update_user(db, user, normalized_payload, password_hash=password_hash)
    data = UserRead.model_validate(updated_user)
    return build_response(
        message="账号已更新",
        data=serialize_schema(data),
    )
