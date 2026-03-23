from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_task import ProjectTask


def list_project_tasks(
    db: Session,
    project_id: int,
    skip: int = 0,
    limit: int = 100,
) -> tuple[list[ProjectTask], int]:
    statement = (
        select(ProjectTask)
        .where(ProjectTask.project_id == project_id)
        .order_by(ProjectTask.id.desc())
        .offset(skip)
        .limit(limit)
    )
    items = list(db.scalars(statement).all())
    total = (
        db.scalar(
            select(func.count()).select_from(ProjectTask).where(ProjectTask.project_id == project_id)
        )
        or 0
    )
    return items, int(total)


def get_project_task_by_id(db: Session, project_id: int, task_id: int) -> ProjectTask | None:
    return db.scalar(
        select(ProjectTask).where(
            ProjectTask.project_id == project_id,
            ProjectTask.id == task_id,
        )
    )


def get_project_task_by_external_id(
    db: Session,
    project_id: int,
    external_task_id: str,
) -> ProjectTask | None:
    return db.scalar(
        select(ProjectTask).where(
            ProjectTask.project_id == project_id,
            ProjectTask.external_task_id == external_task_id,
        )
    )


def generate_external_task_id(project_id: int) -> str:
    return f"task-{project_id}-{uuid4().hex[:10]}"


def create_project_task(
    db: Session,
    project: Project,
    task_payload: dict,
    external_task_id: str | None = None,
) -> ProjectTask:
    normalized_external_task_id = (external_task_id or "").strip() or generate_external_task_id(project.id)

    task = ProjectTask(
        project_id=project.id,
        plugin_code=project.plugin_code or "",
        external_task_id=normalized_external_task_id,
        task_payload=task_payload,
        publish_status="offline",
        task_status="pending",
        is_visible=False,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def publish_project_task(db: Session, task: ProjectTask) -> ProjectTask:
    task.publish_status = "published"
    task.is_visible = True
    task.published_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def unpublish_project_task(db: Session, task: ProjectTask) -> ProjectTask:
    task.publish_status = "offline"
    task.is_visible = False
    db.add(task)
    db.commit()
    db.refresh(task)
    return task
