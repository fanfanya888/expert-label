from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.project import Project
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
        .where(Project.is_published.is_(True))
        .order_by(Project.published_at.desc().nullslast(), Project.id.desc())
        .offset(skip)
        .limit(limit)
    )
    items = list(db.scalars(statement).all())
    total = (
        db.scalar(select(func.count()).select_from(Project).where(Project.is_published.is_(True)))
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
    project.published_at = datetime.now(timezone.utc)
    project.published_by = published_by_user_id
    db.add(project)
    db.commit()
    db.refresh(project)
    return get_project_by_id(db, project.id) or project


def unpublish_project(db: Session, project: Project) -> Project:
    project.is_published = False
    db.add(project)
    db.commit()
    db.refresh(project)
    return get_project_by_id(db, project.id) or project
