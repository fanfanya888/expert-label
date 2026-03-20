from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.response import build_response, serialize_schema
from app.crud.projects import get_project_by_id, list_published_projects
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
    data = ProjectList(
        total=total,
        items=[ProjectRead.model_validate(item) for item in items],
    )
    return build_response(data=serialize_schema(data))


@router.get("/{project_id}")
def get_my_project_detail(
    project_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None or not project.is_published:
        raise HTTPException(status_code=404, detail="Project not found")

    data = ProjectRead.model_validate(project)
    return build_response(data=serialize_schema(data))

