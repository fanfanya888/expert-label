from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.api.deps import require_admin_user
from app.core.response import build_response, serialize_schema
from app.crud.projects import (
    build_project_payload,
    get_project_by_id,
    get_project_task_stats_map,
    list_projects,
    publish_project,
    unpublish_project,
    update_project_instruction,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.project import (
    ProjectDetailRead,
    ProjectInstructionAssetRead,
    ProjectInstructionUpdate,
    ProjectList,
    ProjectRead,
)
from app.services.project_instruction_assets import save_project_instruction_image

router = APIRouter(
    prefix="/admin/projects",
    tags=["admin-projects"],
    dependencies=[Depends(require_admin_user)],
)


@router.get("")
def list_admin_projects(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    items, total = list_projects(db, skip=skip, limit=limit)
    stats_map = get_project_task_stats_map(db, [item.id for item in items])
    data = ProjectList(
        total=total,
        items=[
            ProjectRead.model_validate(build_project_payload(item, stats_map.get(item.id)))
            for item in items
        ],
    )
    return build_response(data=serialize_schema(data))


@router.get("/{project_id}")
def get_admin_project_detail(
    project_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")

    stats_map = get_project_task_stats_map(db, [project.id])
    data = ProjectDetailRead.model_validate(
        build_project_payload(project, stats_map.get(project.id), include_instruction=True)
    )
    return build_response(data=serialize_schema(data))


@router.patch("/{project_id}")
def update_admin_project(
    project_id: int,
    payload: ProjectInstructionUpdate,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")

    normalized_instruction = payload.instruction_markdown
    if normalized_instruction is not None and not normalized_instruction.strip():
        normalized_instruction = None

    updated_project = update_project_instruction(db, project, normalized_instruction)
    stats_map = get_project_task_stats_map(db, [updated_project.id])
    data = ProjectDetailRead.model_validate(
        build_project_payload(updated_project, stats_map.get(updated_project.id), include_instruction=True)
    )
    return build_response(message="项目说明文档已更新", data=serialize_schema(data))


@router.post("/{project_id}/instruction-assets")
async def upload_admin_project_instruction_asset(
    project_id: int,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")

    data = ProjectInstructionAssetRead.model_validate(
        save_project_instruction_image(
            project_id,
            filename=request.headers.get("x-upload-filename"),
            content_type=request.headers.get("content-type"),
            content=await request.body(),
        )
    )
    return build_response(message="说明文档图片上传成功", data=serialize_schema(data))


@router.patch("/{project_id}/publish")
def publish_admin_project(
    project_id: int,
    current_admin: User = Depends(require_admin_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")

    updated_project = publish_project(db, project, published_by_user_id=current_admin.id)
    stats_map = get_project_task_stats_map(db, [updated_project.id])
    data = ProjectRead.model_validate(build_project_payload(updated_project, stats_map.get(updated_project.id)))
    return build_response(message="项目已发布", data=serialize_schema(data))


@router.patch("/{project_id}/unpublish")
def unpublish_admin_project(
    project_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")

    updated_project = unpublish_project(db, project)
    stats_map = get_project_task_stats_map(db, [updated_project.id])
    data = ProjectRead.model_validate(build_project_payload(updated_project, stats_map.get(updated_project.id)))
    return build_response(message="项目已下线", data=serialize_schema(data))
