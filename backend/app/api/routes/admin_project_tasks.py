from __future__ import annotations

from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_admin_user
from app.core.response import build_response, serialize_schema
from app.crud.project_task_reviews import (
    approve_project_task,
    build_project_task_review_payload,
    create_review_round,
    delete_task_reviews,
    list_task_reviews,
)
from app.crud.project_tasks import (
    build_project_task_payload,
    create_project_task,
    delete_project_task,
    get_project_task_by_external_id,
    get_project_task_by_id,
    get_project_task_review_stats_map,
    list_project_tasks,
    publish_project_task,
    unpublish_project_task,
)
from app.crud.projects import get_project_by_id
from app.crud.users import get_usernames_map
from app.db.session import get_db
from app.plugins.registrar import get_plugin_registry
from app.schemas.project_task import ProjectTaskCreate, ProjectTaskRead, ProjectTaskReviewRead

router = APIRouter(
    prefix="/admin/projects/{project_id}/tasks",
    tags=["admin-project-tasks"],
    dependencies=[Depends(require_admin_user)],
)


def _get_project_or_404(db: Session, project_id: int):
    project = get_project_by_id(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


def _build_task_read(
    db: Session,
    task,
    *,
    review_stats: dict[str, int | str | None] | None = None,
) -> ProjectTaskRead:
    payload = review_stats or {}
    latest_reviewer_id = payload.get("latest_reviewer_id")
    latest_reviewer_id_value = int(latest_reviewer_id) if latest_reviewer_id is not None else None

    username_map = get_usernames_map(
        db,
        [
            user_id
            for user_id in [
                task.annotation_assignee_id,
                latest_reviewer_id_value,
            ]
            if user_id is not None
        ],
    )

    return ProjectTaskRead.model_validate(
        build_project_task_payload(
            task,
            review_round_count=int(payload.get("review_round_count", 0)),
            latest_reviewer_id=latest_reviewer_id_value,
            latest_reviewer_username=(
                username_map.get(latest_reviewer_id_value)
                if latest_reviewer_id_value is not None
                else None
            ),
            latest_review_status=(
                str(payload["latest_review_status"])
                if payload.get("latest_review_status") is not None
                else None
            ),
            annotation_assignee_username=(
                username_map.get(task.annotation_assignee_id)
                if task.annotation_assignee_id is not None
                else None
            ),
        )
    )


def _build_review_read(db: Session, review) -> ProjectTaskReviewRead:
    reviewer_username = None
    if review.reviewer_id is not None:
        reviewer_username = get_usernames_map(db, [review.reviewer_id]).get(review.reviewer_id)
    return ProjectTaskReviewRead.model_validate(
        build_project_task_review_payload(
            review,
            reviewer_username=reviewer_username,
        )
    )


@router.get("")
def list_admin_project_tasks(
    project_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None:
        return build_response(data=[])

    items, _ = list_project_tasks(db, project_id, skip=skip, limit=limit)
    review_stats_map = get_project_task_review_stats_map(db, [item.id for item in items])
    data = [
        _build_task_read(
            db,
            item,
            review_stats=review_stats_map.get(item.id),
        )
        for item in items
    ]
    return build_response(data=serialize_schema(data))


@router.post("")
def create_admin_project_task(
    project_id: int,
    payload: ProjectTaskCreate,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = _get_project_or_404(db, project_id)
    if not project.plugin_code:
        raise HTTPException(status_code=422, detail="项目未绑定插件，无法创建任务")

    plugin = get_plugin_registry().get(project.plugin_code)
    if plugin is None:
        raise HTTPException(status_code=422, detail="项目绑定的插件不可用")

    normalized_external_task_id = (payload.external_task_id or "").strip() or None
    if normalized_external_task_id and get_project_task_by_external_id(db, project_id, normalized_external_task_id):
        raise HTTPException(status_code=409, detail="任务标识已存在")

    try:
        normalized_payload = plugin.validate_task_payload(payload.task_payload)
    except Exception as exc:  # pragma: no cover - defensive conversion
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    task = create_project_task(
        db,
        project=project,
        external_task_id=normalized_external_task_id,
        task_payload=normalized_payload,
    )
    data = _build_task_read(db, task)
    return build_response(message="任务已创建", data=serialize_schema(data))


@router.delete("/{task_id}")
def delete_admin_project_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = _get_project_or_404(db, project_id)
    task = get_project_task_by_id(db, project_id, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")

    plugin = get_plugin_registry().get(project.plugin_code or "")
    if plugin is not None and hasattr(plugin, "delete_project_task_data"):
        delete_plugin = cast(Any, plugin)
        delete_plugin.delete_project_task_data(db, project.id, task.external_task_id)

    delete_task_reviews(db, task.id)
    delete_project_task(db, task)
    return build_response(message="任务已删除", data=None)


@router.get("/{task_id}/submissions")
def list_admin_project_task_submissions(
    project_id: int,
    task_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None:
        return build_response(data=[])

    task = get_project_task_by_id(db, project_id, task_id)
    if task is None:
        return build_response(data=[])

    plugin = get_plugin_registry().get(project.plugin_code or "")
    if plugin is None or not hasattr(plugin, "list_project_task_submissions"):
        return build_response(data=[])

    submission_plugin = cast(Any, plugin)
    data = submission_plugin.list_project_task_submissions(
        db,
        project_id=project.id,
        task_id=task.external_task_id,
        limit=limit,
    )
    return build_response(data=data)


@router.patch("/{task_id}/publish")
def publish_admin_project_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _get_project_or_404(db, project_id)
    task = get_project_task_by_id(db, project_id, task_id)
    if task is None:
        raise HTTPException(status_code=422, detail="任务不存在")

    updated_task = publish_project_task(db, task)
    review_stats = get_project_task_review_stats_map(db, [updated_task.id]).get(updated_task.id)
    data = _build_task_read(db, updated_task, review_stats=review_stats)
    return build_response(message="任务已发布", data=serialize_schema(data))


@router.patch("/{task_id}/unpublish")
def unpublish_admin_project_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _get_project_or_404(db, project_id)
    task = get_project_task_by_id(db, project_id, task_id)
    if task is None:
        raise HTTPException(status_code=422, detail="任务不存在")

    updated_task = unpublish_project_task(db, task)
    review_stats = get_project_task_review_stats_map(db, [updated_task.id]).get(updated_task.id)
    data = _build_task_read(db, updated_task, review_stats=review_stats)
    return build_response(message="任务已下线", data=serialize_schema(data))


@router.post("/{task_id}/dispatch-review")
def dispatch_admin_project_task_review(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _get_project_or_404(db, project_id)
    task = get_project_task_by_id(db, project_id, task_id)
    if task is None:
        raise HTTPException(status_code=422, detail="任务不存在")

    try:
        review = create_review_round(db, task)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    data = _build_review_read(db, review)
    return build_response(message="质检轮次已追加", data=serialize_schema(data))


@router.post("/{task_id}/approve")
def approve_admin_project_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _get_project_or_404(db, project_id)
    task = get_project_task_by_id(db, project_id, task_id)
    if task is None:
        raise HTTPException(status_code=422, detail="任务不存在")

    try:
        approved_task = approve_project_task(db, task)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    review_stats = get_project_task_review_stats_map(db, [approved_task.id]).get(approved_task.id)
    data = _build_task_read(db, approved_task, review_stats=review_stats)
    return build_response(message="任务已通过", data=serialize_schema(data))


@router.get("/{task_id}/reviews")
def list_admin_project_task_reviews(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _get_project_or_404(db, project_id)
    task = get_project_task_by_id(db, project_id, task_id)
    if task is None:
        return build_response(data=[])

    items = list_task_reviews(db, task.id)
    reviewer_ids = [item.reviewer_id for item in items if item.reviewer_id is not None]
    username_map = get_usernames_map(db, reviewer_ids)
    data = [
        ProjectTaskReviewRead.model_validate(
            build_project_task_review_payload(
                item,
                reviewer_username=(
                    username_map.get(item.reviewer_id)
                    if item.reviewer_id is not None
                    else None
                ),
            )
        )
        for item in items
    ]
    return build_response(data=serialize_schema(data))
