from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.response import build_response, serialize_schema
from app.crud.projects import (
    build_project_payload,
    get_project_by_id,
    get_project_task_stats_map,
    list_published_projects,
)
from app.db.session import get_db
from app.schemas.project import ProjectList, ProjectRead

router = APIRouter(prefix="/me/projects", tags=["me-projects"])


@router.get("")
def list_my_projects(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    items, total = list_published_projects(db, skip=skip, limit=limit)
    stats_map = get_project_task_stats_map(db, [item.id for item in items], visible_only=True)
    data = ProjectList(
        total=total,
        items=[
            ProjectRead.model_validate(build_project_payload(item, stats_map.get(item.id)))
            for item in items
        ],
    )
    return build_response(data=serialize_schema(data))


@router.get("/{project_id}")
def get_my_project_detail(
    project_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None or not project.is_published or not project.is_visible:
        raise HTTPException(status_code=404, detail="项目不存在")

    stats_map = get_project_task_stats_map(db, [project.id], visible_only=True)
    data = ProjectRead.model_validate(build_project_payload(project, stats_map.get(project.id)))
    return build_response(data=serialize_schema(data))
