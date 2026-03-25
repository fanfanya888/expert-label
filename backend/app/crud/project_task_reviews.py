from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.core.task_workflow import (
    REVIEW_STATUS_IN_PROGRESS,
    REVIEW_STATUS_PENDING,
    REVIEW_STATUS_SUBMITTED,
    TASK_STATUS_APPROVED,
    TASK_STATUS_PENDING_REVIEW_DISPATCH,
    TASK_STATUS_REVIEW_IN_PROGRESS,
    TASK_STATUS_REVIEW_PENDING,
    TASK_STATUS_REVIEW_SUBMITTED,
)
from app.models.project_task import ProjectTask
from app.models.project_task_review import ProjectTaskReview


def build_project_task_review_payload(
    review: ProjectTaskReview,
    *,
    reviewer_username: str | None = None,
) -> dict[str, object]:
    return {
        "id": review.id,
        "project_task_id": review.project_task_id,
        "review_round": review.review_round,
        "review_status": review.review_status,
        "reviewer_id": review.reviewer_id,
        "reviewer_username": reviewer_username,
        "review_result": review.review_result,
        "review_comment": review.review_comment,
        "claimed_at": review.claimed_at,
        "submitted_at": review.submitted_at,
        "created_at": review.created_at,
        "updated_at": review.updated_at,
    }


def list_task_reviews(db: Session, project_task_id: int) -> list[ProjectTaskReview]:
    return list(
        db.scalars(
            select(ProjectTaskReview)
            .where(ProjectTaskReview.project_task_id == project_task_id)
            .order_by(ProjectTaskReview.review_round.desc(), ProjectTaskReview.id.desc())
        ).all()
    )


def delete_task_reviews(db: Session, project_task_id: int) -> None:
    db.execute(
        delete(ProjectTaskReview).where(ProjectTaskReview.project_task_id == project_task_id)
    )
    db.flush()


def create_review_round(db: Session, task: ProjectTask) -> ProjectTaskReview:
    if task.task_status not in {TASK_STATUS_PENDING_REVIEW_DISPATCH, TASK_STATUS_REVIEW_SUBMITTED}:
        raise ValueError("当前任务状态不允许发起质检")

    current_round = db.scalar(
        select(func.max(ProjectTaskReview.review_round)).where(ProjectTaskReview.project_task_id == task.id)
    )
    review = ProjectTaskReview(
        project_task_id=task.id,
        review_round=int(current_round or 0) + 1,
        review_status=REVIEW_STATUS_PENDING,
    )
    task.task_status = TASK_STATUS_REVIEW_PENDING

    db.add(review)
    db.add(task)
    db.commit()
    db.refresh(review)
    db.refresh(task)
    return review


def claim_review_task(
    db: Session,
    *,
    project_id: int,
    user_id: int,
) -> ProjectTaskReview | None:
    existing_review = db.scalar(
        select(ProjectTaskReview)
        .join(ProjectTask, ProjectTask.id == ProjectTaskReview.project_task_id)
        .where(
            ProjectTask.project_id == project_id,
            ProjectTaskReview.reviewer_id == user_id,
            ProjectTaskReview.review_status == REVIEW_STATUS_IN_PROGRESS,
        )
        .order_by(ProjectTaskReview.id.asc())
    )
    if existing_review is not None:
        return existing_review

    review = db.scalar(
        select(ProjectTaskReview)
        .join(ProjectTask, ProjectTask.id == ProjectTaskReview.project_task_id)
        .where(
            ProjectTask.project_id == project_id,
            ProjectTask.publish_status == "published",
            ProjectTask.is_visible.is_(True),
            ProjectTask.task_status == TASK_STATUS_REVIEW_PENDING,
            ProjectTaskReview.review_status == REVIEW_STATUS_PENDING,
        )
        .order_by(ProjectTaskReview.created_at.asc(), ProjectTaskReview.id.asc())
        .with_for_update(skip_locked=True)
    )
    if review is None:
        return None

    task = db.get(ProjectTask, review.project_task_id)
    if task is None:
        return None

    review.reviewer_id = user_id
    review.review_status = REVIEW_STATUS_IN_PROGRESS
    review.claimed_at = datetime.now(timezone.utc)
    task.task_status = TASK_STATUS_REVIEW_IN_PROGRESS
    db.add(review)
    db.add(task)
    db.commit()
    db.refresh(review)
    return review


def submit_review_round(
    db: Session,
    *,
    review: ProjectTaskReview,
    task: ProjectTask,
    reviewer_id: int,
    review_result: str,
    review_comment: str,
) -> ProjectTaskReview:
    if review.reviewer_id != reviewer_id or review.review_status != REVIEW_STATUS_IN_PROGRESS:
        raise ValueError("当前质检任务不可提交")

    review.review_result = review_result
    review.review_comment = review_comment
    review.review_status = REVIEW_STATUS_SUBMITTED
    review.submitted_at = datetime.now(timezone.utc)

    task.task_status = TASK_STATUS_REVIEW_SUBMITTED

    db.add(review)
    db.add(task)
    db.commit()
    db.refresh(review)
    db.refresh(task)
    return review


def approve_project_task(db: Session, task: ProjectTask) -> ProjectTask:
    if task.task_status != TASK_STATUS_REVIEW_SUBMITTED:
        raise ValueError("当前任务状态不允许通过")

    task.task_status = TASK_STATUS_APPROVED
    task.approved_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task
