from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session, selectinload

from app.core.task_workflow import TASK_COMPLETED_STATUSES
from app.models.project import Project
from app.models.project_task import ProjectTask
from app.models.user import User


def get_project_by_id(db: Session, project_id: int) -> Project | None:
    statement = (
        select(Project)
        .options(selectinload(Project.owner))
        .where(Project.id == project_id)
    )
    return db.scalar(statement)


def list_projects(
    db: Session,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[Project], int]:
    statement = (
        select(Project)
        .options(selectinload(Project.owner))
        .order_by(Project.id.desc())
        .offset(skip)
        .limit(limit)
    )
    items = list(db.scalars(statement).all())
    total = db.scalar(select(func.count()).select_from(Project)) or 0
    return items, total


def list_published_projects(
    db: Session,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[Project], int]:
    statement = (
        select(Project)
        .options(selectinload(Project.owner))
        .where(Project.is_published.is_(True), Project.is_visible.is_(True))
        .order_by(Project.published_at.desc().nullslast(), Project.id.desc())
        .offset(skip)
        .limit(limit)
    )
    items = list(db.scalars(statement).all())
    total = (
        db.scalar(
            select(func.count())
            .select_from(Project)
            .where(Project.is_published.is_(True), Project.is_visible.is_(True))
        )
        or 0
    )
    return items, total


def user_exists(db: Session, user_id: int) -> bool:
    return db.get(User, user_id) is not None


def publish_project(
    db: Session,
    project: Project,
    published_by_user_id: int | None = None,
) -> Project:
    project.is_published = True
    project.is_visible = True
    project.publish_status = "published"
    project.published_at = datetime.now(timezone.utc)
    project.published_by = published_by_user_id
    db.add(project)
    db.commit()
    db.refresh(project)
    return get_project_by_id(db, project.id) or project


def unpublish_project(db: Session, project: Project) -> Project:
    project.is_published = False
    project.is_visible = False
    project.publish_status = "offline"
    db.add(project)
    db.commit()
    db.refresh(project)
    return get_project_by_id(db, project.id) or project


def update_project_instruction(
    db: Session,
    project: Project,
    instruction_markdown: str | None,
) -> Project:
    project.instruction_markdown = instruction_markdown
    db.add(project)
    db.commit()
    db.refresh(project)
    return get_project_by_id(db, project.id) or project


def get_project_task_stats_map(
    db: Session,
    project_ids: list[int],
    *,
    visible_only: bool = False,
) -> dict[int, dict[str, int]]:
    if not project_ids:
        return {}

    completed_case = case((ProjectTask.task_status.in_(TASK_COMPLETED_STATUSES), 1), else_=0)
    filters = [ProjectTask.project_id.in_(project_ids)]
    if visible_only:
        filters.extend(
            [
                ProjectTask.publish_status == "published",
                ProjectTask.is_visible.is_(True),
            ]
        )
    statement = (
        select(
            ProjectTask.project_id,
            func.count(ProjectTask.id).label("task_total"),
            func.coalesce(func.sum(completed_case), 0).label("task_completed"),
        )
        .where(*filters)
        .group_by(ProjectTask.project_id)
    )

    stats_map: dict[int, dict[str, int]] = {}
    for row in db.execute(statement):
        total = int(row.task_total or 0)
        completed = int(row.task_completed or 0)
        stats_map[int(row.project_id)] = {
            "task_total": total,
            "task_completed": completed,
            "task_pending": max(total - completed, 0),
        }
    return stats_map


def build_project_payload(
    project: Project,
    stats: dict[str, int] | None = None,
    *,
    include_instruction: bool = False,
) -> dict[str, Any]:
    project_stats = stats or {
        "task_total": 0,
        "task_completed": 0,
        "task_pending": 0,
    }
    payload = {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "owner_id": project.owner_id,
        "plugin_code": project.plugin_code,
        "entry_path": project.entry_path,
        "publish_status": project.publish_status,
        "is_visible": project.is_visible,
        "source_type": project.source_type,
        "external_url": project.external_url,
        "is_published": project.is_published,
        "published_at": project.published_at,
        "published_by": project.published_by,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "task_total": project_stats["task_total"],
        "task_completed": project_stats["task_completed"],
        "task_pending": project_stats["task_pending"],
        "owner": project.owner,
    }
    if include_instruction:
        payload["instruction_markdown"] = project.instruction_markdown
    return payload
