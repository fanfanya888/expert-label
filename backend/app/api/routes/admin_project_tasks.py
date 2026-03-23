from __future__ import annotations

from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.response import build_response, serialize_schema
from app.crud.project_tasks import (
    create_project_task,
    get_project_task_by_external_id,
    get_project_task_by_id,
    list_project_tasks,
    publish_project_task,
    unpublish_project_task,
)
from app.crud.projects import get_project_by_id
from app.db.session import get_db
from app.plugins.registrar import get_plugin_registry
from app.schemas.project_task import ProjectTaskCreate, ProjectTaskRead

router = APIRouter(prefix="/admin/projects/{project_id}/tasks", tags=["admin-project-tasks"])


def _get_project_or_404(db: Session, project_id: int):
    project = get_project_by_id(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project


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
    data = [ProjectTaskRead.model_validate(item) for item in items]
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
    data = ProjectTaskRead.model_validate(task)
    return build_response(message="任务已创建", data=serialize_schema(data))


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
    data = ProjectTaskRead.model_validate(updated_task)
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
    data = ProjectTaskRead.model_validate(updated_task)
    return build_response(message="任务已下线", data=serialize_schema(data))
