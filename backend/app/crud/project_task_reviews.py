from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import case, delete, func, select
from sqlalchemy.orm import Session

from app.core.task_workflow import (
    REVIEW_OWNED_STATUSES,
    REVIEW_STATUS_IN_PROGRESS,
    REVIEW_STATUS_PENDING,
    REVIEW_STATUS_SUBMITTED,
    REVIEW_STATUS_WAITING_RESUBMISSION,
    TASK_STATUS_ANNOTATION_IN_PROGRESS,
    TASK_STATUS_APPROVED,
    TASK_STATUS_PENDING_REVIEW_DISPATCH,
    TASK_STATUS_REVIEW_IN_PROGRESS,
    TASK_STATUS_REVIEW_PENDING,
    TASK_STATUS_REVIEW_SUBMITTED,
)
from app.models.project_task import ProjectTask
from app.models.project_task_review import ProjectTaskReview

MAX_CONCURRENT_REVIEW_TASKS = 3


def _normalize_review_annotations(
    annotations: list[dict[str, str]] | None,
) -> list[dict[str, str]]:
    if not annotations:
        return []

    normalized: list[dict[str, str]] = []
    for item in annotations:
        section_key = str(item.get("section_key", "")).strip()
        section_label = str(item.get("section_label", "")).strip()
        comment = str(item.get("comment", "")).strip()
        if not section_key or not section_label or not comment:
            continue
        normalized.append(
            {
                "section_key": section_key[:100],
                "section_label": section_label[:100],
                "comment": comment[:2000],
            }
        )
    return normalized


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
        "review_annotations": _normalize_review_annotations(review.review_annotations),
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
        raise ValueError("褰撳墠浠诲姟鐘舵€佷笉鍏佽鍙戣捣璐ㄦ")

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


def prepare_review_round_for_submission(db: Session, task: ProjectTask) -> ProjectTaskReview:
    if task.task_status not in {TASK_STATUS_PENDING_REVIEW_DISPATCH, TASK_STATUS_REVIEW_SUBMITTED}:
        raise ValueError("褰撳墠浠诲姟鐘舵€佷笉鍏佽杩涘叆璐ㄦ")

    waiting_review = db.scalar(
        select(ProjectTaskReview)
        .where(
            ProjectTaskReview.project_task_id == task.id,
            ProjectTaskReview.review_status == REVIEW_STATUS_WAITING_RESUBMISSION,
        )
        .order_by(ProjectTaskReview.review_round.desc(), ProjectTaskReview.id.desc())
        .with_for_update(skip_locked=True)
    )
    if waiting_review is None:
        return create_review_round(db, task)

    waiting_review.review_status = REVIEW_STATUS_IN_PROGRESS
    waiting_review.review_result = None
    waiting_review.review_comment = None
    waiting_review.review_annotations = None
    waiting_review.submitted_at = None
    waiting_review.claimed_at = datetime.now(timezone.utc)
    task.task_status = TASK_STATUS_REVIEW_IN_PROGRESS

    db.add(waiting_review)
    db.add(task)
    db.commit()
    db.refresh(waiting_review)
    db.refresh(task)
    return waiting_review


def claim_review_task(
    db: Session,
    *,
    project_id: int,
    user_id: int,
    prefer_existing: bool = True,
) -> ProjectTaskReview | None:
    existing_review = db.scalar(
        select(ProjectTaskReview)
        .join(ProjectTask, ProjectTask.id == ProjectTaskReview.project_task_id)
        .where(
            ProjectTask.project_id == project_id,
            ProjectTaskReview.reviewer_id == user_id,
            ProjectTaskReview.review_status.in_(REVIEW_OWNED_STATUSES),
        )
        .order_by(
            case(
                (ProjectTaskReview.review_status == REVIEW_STATUS_IN_PROGRESS, 0),
                else_=1,
            ),
            ProjectTaskReview.claimed_at.desc().nullslast(),
            ProjectTaskReview.id.desc(),
        )
    )
    if prefer_existing and existing_review is not None:
        return existing_review

    current_owned_count = int(
        db.scalar(
            select(func.count())
            .select_from(ProjectTaskReview)
            .join(ProjectTask, ProjectTask.id == ProjectTaskReview.project_task_id)
            .where(
                ProjectTaskReview.reviewer_id == user_id,
                ProjectTaskReview.review_status.in_(REVIEW_OWNED_STATUSES),
                ProjectTask.publish_status == "published",
                ProjectTask.is_visible.is_(True),
            )
        )
        or 0
    )
    if current_owned_count >= MAX_CONCURRENT_REVIEW_TASKS:
        raise ValueError("褰撳墠宸茶揪鍒拌川妫€鍙鍙栦笂闄愶紝鏈€澶氬悓鏃堕鍙?3 涓川妫€浠诲姟")

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


def list_user_review_tasks(
    db: Session,
    *,
    user_id: int,
) -> list[tuple[ProjectTaskReview, ProjectTask]]:
    statement = (
        select(ProjectTaskReview, ProjectTask)
        .join(ProjectTask, ProjectTask.id == ProjectTaskReview.project_task_id)
        .where(
            ProjectTask.publish_status == "published",
            ProjectTask.is_visible.is_(True),
            ProjectTaskReview.reviewer_id == user_id,
            ProjectTaskReview.review_status.in_(REVIEW_OWNED_STATUSES),
        )
        .order_by(
            case(
                (ProjectTaskReview.review_status == REVIEW_STATUS_IN_PROGRESS, 0),
                else_=1,
            ),
            ProjectTaskReview.claimed_at.desc().nullslast(),
            ProjectTaskReview.updated_at.desc(),
            ProjectTaskReview.id.desc(),
        )
    )
    return list(db.execute(statement).all())


def get_user_review_task(
    db: Session,
    *,
    project_id: int,
    review_id: int,
    user_id: int,
    statuses: set[str] | None = None,
) -> tuple[ProjectTaskReview, ProjectTask] | None:
    filters = [
        ProjectTask.project_id == project_id,
        ProjectTask.publish_status == "published",
        ProjectTask.is_visible.is_(True),
        ProjectTaskReview.id == review_id,
        ProjectTaskReview.reviewer_id == user_id,
    ]
    if statuses:
        filters.append(ProjectTaskReview.review_status.in_(statuses))

    return db.execute(
        select(ProjectTaskReview, ProjectTask)
        .join(ProjectTask, ProjectTask.id == ProjectTaskReview.project_task_id)
        .where(*filters)
    ).first()


def submit_review_round(
    db: Session,
    *,
    review: ProjectTaskReview,
    task: ProjectTask,
    reviewer_id: int,
    review_result: str,
    review_comment: str,
    review_annotations: list[dict[str, str]] | None = None,
) -> ProjectTaskReview:
    if review.reviewer_id != reviewer_id or review.review_status != REVIEW_STATUS_IN_PROGRESS:
        raise ValueError("褰撳墠璐ㄦ浠诲姟涓嶅彲鎻愪氦")

    submitted_at = datetime.now(timezone.utc)
    review.review_result = review_result
    review.review_comment = review_comment
    review.review_annotations = _normalize_review_annotations(review_annotations)
    review.review_status = REVIEW_STATUS_SUBMITTED
    review.submitted_at = submitted_at

    if review_result == "reject":
        if task.annotation_assignee_id is None:
            raise ValueError("褰撳墠浠诲姟缂哄皯鍘熸爣娉ㄤ汉鍛橈紝鏃犳硶鎵撳洖")
        task.task_status = TASK_STATUS_ANNOTATION_IN_PROGRESS
        next_review = db.scalar(
            select(ProjectTaskReview)
            .where(
                ProjectTaskReview.project_task_id == task.id,
                ProjectTaskReview.review_status == REVIEW_STATUS_WAITING_RESUBMISSION,
            )
            .order_by(ProjectTaskReview.review_round.desc(), ProjectTaskReview.id.desc())
            .with_for_update(skip_locked=True)
        )
        if next_review is None:
            next_review = ProjectTaskReview(
                project_task_id=task.id,
                review_round=review.review_round + 1,
            )
        next_review.review_round = max(int(next_review.review_round or 0), review.review_round + 1)
        next_review.reviewer_id = reviewer_id
        next_review.review_status = REVIEW_STATUS_WAITING_RESUBMISSION
        next_review.review_result = None
        next_review.review_comment = None
        next_review.review_annotations = None
        next_review.claimed_at = submitted_at
        next_review.submitted_at = None
        db.add(next_review)
    else:
        task.task_status = TASK_STATUS_REVIEW_SUBMITTED

    db.add(review)
    db.add(task)
    db.commit()
    db.refresh(review)
    db.refresh(task)
    return review


def approve_project_task(db: Session, task: ProjectTask) -> ProjectTask:
    if task.task_status != TASK_STATUS_REVIEW_SUBMITTED:
        raise ValueError("褰撳墠浠诲姟鐘舵€佷笉鍏佽閫氳繃")

    task.task_status = TASK_STATUS_APPROVED
    task.approved_at = datetime.now(timezone.utc)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task
