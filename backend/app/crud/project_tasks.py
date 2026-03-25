from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Select, case, func, select
from sqlalchemy.orm import Session

from app.core.task_workflow import (
    ANNOTATION_ACTIVE_STATUSES,
    ANNOTATION_OWNED_STATUSES,
    TASK_COMPLETED_STATUSES,
    TASK_STATUS_ANNOTATION_IN_PROGRESS,
    TASK_STATUS_ANNOTATION_PENDING,
)
from app.models.project import Project
from app.models.project_task import ProjectTask
from app.models.project_task_review import ProjectTaskReview


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


def build_project_task_payload(
    task: ProjectTask,
    *,
    review_round_count: int = 0,
    latest_reviewer_id: int | None = None,
    latest_reviewer_username: str | None = None,
    latest_review_status: str | None = None,
    annotation_assignee_username: str | None = None,
) -> dict[str, object]:
    return {
        "id": task.id,
        "project_id": task.project_id,
        "plugin_code": task.plugin_code,
        "external_task_id": task.external_task_id,
        "task_payload": task.task_payload,
        "publish_status": task.publish_status,
        "task_status": task.task_status,
        "is_visible": task.is_visible,
        "published_at": task.published_at,
        "annotation_assignee_id": task.annotation_assignee_id,
        "annotation_assignee_username": annotation_assignee_username,
        "annotation_claimed_at": task.annotation_claimed_at,
        "annotation_submitted_at": task.annotation_submitted_at,
        "approved_at": task.approved_at,
        "review_round_count": review_round_count,
        "latest_reviewer_id": latest_reviewer_id,
        "latest_reviewer_username": latest_reviewer_username,
        "latest_review_status": latest_review_status,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }


def get_user_annotation_claim_state(
    db: Session,
    *,
    project_id: int,
    plugin_code: str,
    user_id: int,
) -> dict[str, int | bool | ProjectTask | None]:
    active_task = db.scalar(
        select(ProjectTask)
        .where(
            ProjectTask.project_id == project_id,
            ProjectTask.plugin_code == plugin_code,
            ProjectTask.annotation_assignee_id == user_id,
            ProjectTask.task_status.in_(ANNOTATION_ACTIVE_STATUSES),
        )
        .order_by(ProjectTask.id.asc())
    )
    owned_count = int(
        db.scalar(
            select(func.count())
            .select_from(ProjectTask)
            .where(
                ProjectTask.project_id == project_id,
                ProjectTask.plugin_code == plugin_code,
                ProjectTask.annotation_assignee_id == user_id,
                ProjectTask.task_status.in_(ANNOTATION_OWNED_STATUSES),
            )
        )
        or 0
    )
    approved_count = int(
        db.scalar(
            select(func.count())
            .select_from(ProjectTask)
            .where(
                ProjectTask.project_id == project_id,
                ProjectTask.plugin_code == plugin_code,
                ProjectTask.annotation_assignee_id == user_id,
                ProjectTask.task_status.in_(TASK_COMPLETED_STATUSES),
            )
        )
        or 0
    )
    trial_passed = approved_count > 0
    max_owned_tasks = 2 if trial_passed else 1
    return {
        "active_task": active_task,
        "owned_count": owned_count,
        "approved_count": approved_count,
        "trial_passed": trial_passed,
        "max_owned_tasks": max_owned_tasks,
    }


def get_project_task_hall_stats_map(
    db: Session,
    project_ids: list[int],
    *,
    user_id: int,
) -> dict[int, dict[str, int | bool | str | None]]:
    if not project_ids:
        return {}

    task_rows = db.execute(
        select(
            ProjectTask.project_id,
            func.count(ProjectTask.id).label("task_total"),
            func.coalesce(
                func.sum(case((ProjectTask.task_status == TASK_STATUS_ANNOTATION_PENDING, 1), else_=0)),
                0,
            ).label("annotation_available_count"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (ProjectTask.annotation_assignee_id == user_id)
                            & ProjectTask.task_status.in_(ANNOTATION_OWNED_STATUSES),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("current_user_annotation_owned_count"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (ProjectTask.annotation_assignee_id == user_id)
                            & ProjectTask.task_status.in_(TASK_COMPLETED_STATUSES),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("current_user_approved_count"),
        )
        .where(
            ProjectTask.project_id.in_(project_ids),
            ProjectTask.publish_status == "published",
            ProjectTask.is_visible.is_(True),
        )
        .group_by(ProjectTask.project_id)
    )

    stats_map: dict[int, dict[str, int | bool | str | None]] = {}
    for row in task_rows:
        task_total = int(row.task_total or 0)
        annotation_available_count = int(row.annotation_available_count or 0)
        current_user_annotation_owned_count = int(row.current_user_annotation_owned_count or 0)
        current_user_approved_count = int(row.current_user_approved_count or 0)
        trial_passed = current_user_approved_count > 0
        current_user_annotation_limit = 2 if trial_passed else 1
        claim_progress_percent = (
            int(round(((task_total - annotation_available_count) / task_total) * 100))
            if task_total > 0
            else 0
        )
        stats_map[int(row.project_id)] = {
            "annotation_available_count": annotation_available_count,
            "current_user_annotation_owned_count": current_user_annotation_owned_count,
            "current_user_annotation_limit": current_user_annotation_limit,
            "current_user_task_id": None,
            "current_user_task_status": None,
            "trial_passed": trial_passed,
            "can_claim_annotation": (
                annotation_available_count > 0
                and current_user_annotation_owned_count < current_user_annotation_limit
            ),
            "claim_progress_percent": min(max(claim_progress_percent, 0), 100),
        }

    for project_id in project_ids:
        stats_map.setdefault(
            project_id,
            {
                "annotation_available_count": 0,
                "current_user_annotation_owned_count": 0,
                "current_user_annotation_limit": 1,
                "current_user_task_id": None,
                "current_user_task_status": None,
                "trial_passed": False,
                "can_claim_annotation": False,
                "claim_progress_percent": 0,
            },
        )

    owned_task_rows = db.execute(
        select(ProjectTask)
        .where(
            ProjectTask.project_id.in_(project_ids),
            ProjectTask.publish_status == "published",
            ProjectTask.is_visible.is_(True),
            ProjectTask.annotation_assignee_id == user_id,
            ProjectTask.task_status.in_(ANNOTATION_OWNED_STATUSES),
        )
        .order_by(
            ProjectTask.project_id.asc(),
            case(
                (ProjectTask.task_status == TASK_STATUS_ANNOTATION_IN_PROGRESS, 0),
                else_=1,
            ),
            ProjectTask.updated_at.desc(),
            ProjectTask.id.desc(),
        )
    ).scalars()
    seen_owned_projects: set[int] = set()
    for task in owned_task_rows:
        if task.project_id in seen_owned_projects:
            continue
        seen_owned_projects.add(task.project_id)
        stats_map.setdefault(task.project_id, {})
        stats_map[task.project_id]["current_user_task_id"] = task.external_task_id
        stats_map[task.project_id]["current_user_task_status"] = task.task_status

    review_rows = db.execute(
        select(
            ProjectTask.project_id,
            func.count(ProjectTaskReview.id).label("review_available_count"),
        )
        .join(ProjectTaskReview, ProjectTaskReview.project_task_id == ProjectTask.id)
        .where(
            ProjectTask.project_id.in_(project_ids),
            ProjectTask.publish_status == "published",
            ProjectTask.is_visible.is_(True),
            ProjectTaskReview.review_status == "pending",
        )
        .group_by(ProjectTask.project_id)
    )
    for row in review_rows:
        stats_map.setdefault(int(row.project_id), {})
        stats_map[int(row.project_id)]["review_available_count"] = int(row.review_available_count or 0)

    for project_id in project_ids:
        stats_map.setdefault(project_id, {})
        stats_map[project_id].setdefault("review_available_count", 0)

    return stats_map


def get_project_task_review_stats_map(
    db: Session,
    task_ids: list[int],
) -> dict[int, dict[str, int | str | None]]:
    if not task_ids:
        return {}

    count_rows = db.execute(
        select(
            ProjectTaskReview.project_task_id,
            func.count(ProjectTaskReview.id).label("review_round_count"),
        )
        .where(ProjectTaskReview.project_task_id.in_(task_ids))
        .group_by(ProjectTaskReview.project_task_id)
    )

    stats_map: dict[int, dict[str, int | str | None]] = {
        int(row.project_task_id): {
            "review_round_count": int(row.review_round_count or 0),
            "latest_reviewer_id": None,
            "latest_review_status": None,
        }
        for row in count_rows
    }

    latest_rows = db.execute(
        select(ProjectTaskReview)
        .where(ProjectTaskReview.project_task_id.in_(task_ids))
        .order_by(
            ProjectTaskReview.project_task_id.asc(),
            ProjectTaskReview.review_round.desc(),
            ProjectTaskReview.id.desc(),
        )
    ).scalars()

    seen_task_ids: set[int] = set()
    for row in latest_rows:
        if row.project_task_id in seen_task_ids:
            continue
        seen_task_ids.add(row.project_task_id)
        stats_map.setdefault(
            row.project_task_id,
            {
                "review_round_count": 0,
                "latest_reviewer_id": None,
                "latest_review_status": None,
            },
        )
        stats_map[row.project_task_id]["latest_reviewer_id"] = row.reviewer_id
        stats_map[row.project_task_id]["latest_review_status"] = row.review_status

    return stats_map


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
        task_status=TASK_STATUS_ANNOTATION_PENDING,
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


def delete_project_task(db: Session, task: ProjectTask) -> None:
    db.delete(task)
    db.commit()


def claim_annotation_task(
    db: Session,
    *,
    project_id: int,
    plugin_code: str,
    user_id: int,
    prefer_existing: bool = True,
) -> ProjectTask | None:
    claim_state = get_user_annotation_claim_state(
        db,
        project_id=project_id,
        plugin_code=plugin_code,
        user_id=user_id,
    )
    existing_task = claim_state["active_task"]
    if prefer_existing and isinstance(existing_task, ProjectTask):
        return existing_task

    if int(claim_state["owned_count"]) >= int(claim_state["max_owned_tasks"]):
        return existing_task if isinstance(existing_task, ProjectTask) else None

    statement: Select[tuple[ProjectTask]] = (
        select(ProjectTask)
        .where(
            ProjectTask.project_id == project_id,
            ProjectTask.plugin_code == plugin_code,
            ProjectTask.publish_status == "published",
            ProjectTask.is_visible.is_(True),
            ProjectTask.task_status == TASK_STATUS_ANNOTATION_PENDING,
        )
        .order_by(ProjectTask.published_at.asc().nullslast(), ProjectTask.id.asc())
        .with_for_update(skip_locked=True)
    )
    task = db.scalar(statement)
    if task is None:
        return None

    task.annotation_assignee_id = user_id
    task.annotation_claimed_at = datetime.now(timezone.utc)
    task.task_status = TASK_STATUS_ANNOTATION_IN_PROGRESS
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def release_annotation_task(
    db: Session,
    *,
    project_id: int,
    plugin_code: str,
    user_id: int,
) -> ProjectTask | None:
    task = db.scalar(
        select(ProjectTask)
        .where(
            ProjectTask.project_id == project_id,
            ProjectTask.plugin_code == plugin_code,
            ProjectTask.annotation_assignee_id == user_id,
            ProjectTask.task_status == TASK_STATUS_ANNOTATION_IN_PROGRESS,
        )
        .order_by(ProjectTask.id.asc())
        .with_for_update(skip_locked=True)
    )
    if task is None:
        return None

    task.annotation_assignee_id = None
    task.annotation_claimed_at = None
    task.annotation_submitted_at = None
    task.task_status = TASK_STATUS_ANNOTATION_PENDING
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def count_project_tasks_by_status(
    db: Session,
    project_id: int,
    *,
    statuses: set[str],
    visible_only: bool = True,
) -> int:
    filters = [
        ProjectTask.project_id == project_id,
        ProjectTask.task_status.in_(statuses),
    ]
    if visible_only:
        filters.extend(
            [
                ProjectTask.publish_status == "published",
                ProjectTask.is_visible.is_(True),
            ]
        )
    return int(db.scalar(select(func.count()).select_from(ProjectTask).where(*filters)) or 0)


def count_completed_project_tasks(
    db: Session,
    project_id: int,
    *,
    visible_only: bool = True,
) -> int:
    return count_project_tasks_by_status(
        db,
        project_id,
        statuses=TASK_COMPLETED_STATUSES,
        visible_only=visible_only,
    )
