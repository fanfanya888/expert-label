from __future__ import annotations

from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_annotator_user, require_end_user, require_reviewer_user
from app.core.task_workflow import REVIEW_OWNED_STATUSES, REVIEW_STATUS_IN_PROGRESS
from app.core.response import build_response, serialize_schema
from app.crud.project_task_reviews import (
    build_project_task_review_payload,
    claim_review_task,
    get_user_review_task,
    list_user_review_tasks,
    list_task_reviews,
    submit_review_round,
)
from app.crud.project_tasks import (
    build_project_task_payload,
    claim_annotation_task,
    get_project_task_hall_stats_map,
    get_project_task_review_stats_map,
    list_user_annotation_tasks,
    release_annotation_task_by_external_id,
    release_annotation_task,
)
from app.crud.projects import (
    build_project_payload,
    get_project_by_id,
    get_project_task_stats_map,
    list_published_projects,
)
from app.crud.users import get_usernames_map
from app.db.session import get_db
from app.models.model_response_review import ModelResponseReviewRecord
from app.models.project import Project
from app.models.project_task import ProjectTask
from app.models.project_task_review import ProjectTaskReview
from app.models.single_turn_search_case_record import SingleTurnSearchCaseRecord
from app.models.user import User
from app.plugins.registrar import get_plugin_registry
from app.schemas.project import ProjectDetailRead, ProjectHallList, ProjectHallRead, ProjectList, ProjectRead
from app.schemas.project_task import (
    MyAnnotationTaskQueueItem,
    MyAnnotationTaskQueueList,
    MyReviewTaskQueueItem,
    MyReviewTaskQueueList,
    ProjectTaskRead,
    ProjectTaskReviewRead,
    ProjectTaskReviewSubmit,
    ProjectTaskReviewTaskDetail,
)
from app.schemas.submission_record import UserSubmissionRecordList, UserSubmissionRecordRead

router = APIRouter(
    prefix="/me/projects",
    tags=["me-projects"],
    dependencies=[Depends(require_end_user)],
)


def _resolve_plugin_name(plugin_code: str | None) -> str:
    if plugin_code == "model_response_review":
        return "模型回答评审"
    if plugin_code == "single_turn_search_case":
        return "单轮日常搜索边界评测 Case"
    return plugin_code or "未知插件"


def _get_review_projects_for_user(db: Session, user_id: int) -> list[Project]:
    statement = (
        select(Project)
        .join(ProjectTask, ProjectTask.project_id == Project.id)
        .join(ProjectTaskReview, ProjectTaskReview.project_task_id == ProjectTask.id)
        .where(
            Project.is_published.is_(True),
            Project.is_visible.is_(True),
            ProjectTaskReview.review_status.in_(REVIEW_OWNED_STATUSES),
            ProjectTaskReview.reviewer_id == user_id,
        )
        .distinct()
        .order_by(Project.published_at.desc().nullslast(), Project.id.desc())
    )
    return list(db.scalars(statement).all())


def _build_task_read(
    db: Session,
    task: ProjectTask,
    *,
    review_stats: dict[str, int | str | None] | None = None,
) -> ProjectTaskRead:
    payload = review_stats or {}
    latest_reviewer_id = payload.get("latest_reviewer_id")
    latest_reviewer_id_value = int(latest_reviewer_id) if latest_reviewer_id is not None else None
    username_map = get_usernames_map(
        db,
        [
            user_id
            for user_id in [
                task.annotation_assignee_id,
                latest_reviewer_id_value,
            ]
            if user_id is not None
        ],
    )

    return ProjectTaskRead.model_validate(
        build_project_task_payload(
            task,
            review_round_count=int(payload.get("review_round_count", 0)),
            latest_reviewer_id=latest_reviewer_id_value,
            latest_reviewer_username=(
                username_map.get(latest_reviewer_id_value)
                if latest_reviewer_id_value is not None
                else None
            ),
            latest_review_status=(
                str(payload["latest_review_status"])
                if payload.get("latest_review_status") is not None
                else None
            ),
            annotation_assignee_username=(
                username_map.get(task.annotation_assignee_id)
                if task.annotation_assignee_id is not None
                else None
            ),
        )
    )


def _build_project_hall_read(
    project: Project,
    *,
    project_stats: dict[str, int] | None,
    hall_stats: dict[str, int | bool | str | None] | None,
    current_user: User,
) -> ProjectHallRead:
    payload = build_project_payload(project, project_stats)
    stats = hall_stats or {}
    return ProjectHallRead.model_validate(
        {
            **payload,
            "annotation_available_count": int(stats.get("annotation_available_count", 0)),
            "review_available_count": int(stats.get("review_available_count", 0)),
            "claim_progress_percent": int(stats.get("claim_progress_percent", 0)),
            "current_user_annotation_limit": int(stats.get("current_user_annotation_limit", 1)),
            "current_user_annotation_owned_count": int(stats.get("current_user_annotation_owned_count", 0)),
            "current_user_task_id": (
                str(stats["current_user_task_id"])
                if stats.get("current_user_task_id") is not None
                else None
            ),
            "current_user_task_status": (
                str(stats["current_user_task_status"])
                if stats.get("current_user_task_status") is not None
                else None
            ),
            "current_user_review_limit": int(stats.get("current_user_review_limit", 3)),
            "current_user_total_review_owned_count": int(stats.get("current_user_total_review_owned_count", 0)),
            "current_user_review_owned_count": int(stats.get("current_user_review_owned_count", 0)),
            "current_user_review_id": (
                int(stats["current_user_review_id"])
                if stats.get("current_user_review_id") is not None
                else None
            ),
            "current_user_review_task_id": (
                str(stats["current_user_review_task_id"])
                if stats.get("current_user_review_task_id") is not None
                else None
            ),
            "current_user_review_task_status": (
                str(stats["current_user_review_task_status"])
                if stats.get("current_user_review_task_status") is not None
                else None
            ),
            "trial_passed": bool(stats.get("trial_passed", False)),
            "can_claim_annotation": bool(stats.get("can_claim_annotation", False)) and current_user.can_annotate,
            "can_claim_review": bool(stats.get("can_claim_review", False)) and current_user.can_review,
        }
    )


def _build_project_read(
    project: Project,
    *,
    project_stats: dict[str, int] | None,
) -> ProjectRead:
    return ProjectRead.model_validate(build_project_payload(project, project_stats))


def _build_review_task_detail(
    db: Session,
    project_id: int,
    review: ProjectTaskReview,
    task: ProjectTask,
) -> ProjectTaskReviewTaskDetail:
    review_stats = get_project_task_review_stats_map(db, [task.id]).get(task.id, {})
    task_payload = _build_task_read(db, task, review_stats=review_stats)

    submission: dict[str, Any] | None = None
    plugin = get_plugin_registry().get(task.plugin_code or "")
    if plugin is not None and hasattr(plugin, "get_latest_task_submission_detail"):
        submission_plugin = cast(Any, plugin)
        submission = submission_plugin.get_latest_task_submission_detail(
            db,
            project_id,
            task.external_task_id,
        )

    review_rows = list_task_reviews(db, task.id)
    username_map = get_usernames_map(
        db,
        [item.reviewer_id for item in review_rows if item.reviewer_id is not None],
    )
    review_history = [
        ProjectTaskReviewRead.model_validate(
            build_project_task_review_payload(
                item,
                reviewer_username=(
                    username_map.get(item.reviewer_id)
                    if item.reviewer_id is not None
                    else None
                ),
            )
        )
        for item in review_rows
    ]

    return ProjectTaskReviewTaskDetail(
        review=ProjectTaskReviewRead.model_validate(
            build_project_task_review_payload(
                review,
                reviewer_username=(
                    username_map.get(review.reviewer_id)
                    if review.reviewer_id is not None
                    else None
                ),
            )
        ),
        task=task_payload,
        submission=submission,
        review_history=review_history,
    )


def _get_current_review_for_user(
    db: Session,
    *,
    project_id: int,
    user_id: int,
) -> tuple[ProjectTaskReview, ProjectTask] | None:
    row = db.execute(
        select(ProjectTaskReview, ProjectTask)
        .join(ProjectTask, ProjectTask.id == ProjectTaskReview.project_task_id)
        .where(
            ProjectTask.project_id == project_id,
            ProjectTask.publish_status == "published",
            ProjectTask.is_visible.is_(True),
            ProjectTaskReview.reviewer_id == user_id,
            ProjectTaskReview.review_status == "in_progress",
        )
        .order_by(ProjectTaskReview.claimed_at.desc().nullslast(), ProjectTaskReview.id.desc())
    ).first()
    if row is None:
        return None
    return row


def _build_my_submission_records(
    db: Session,
    *,
    user_id: int,
    skip: int,
    limit: int,
) -> UserSubmissionRecordList:
    raw_mrr_items = list(
        db.scalars(
            select(ModelResponseReviewRecord)
            .where(ModelResponseReviewRecord.annotator_id == user_id)
            .order_by(ModelResponseReviewRecord.submitted_at.desc(), ModelResponseReviewRecord.id.desc())
        ).all()
    )
    raw_search_case_items = list(
        db.scalars(
            select(SingleTurnSearchCaseRecord)
            .where(SingleTurnSearchCaseRecord.annotator_id == user_id)
            .order_by(SingleTurnSearchCaseRecord.submitted_at.desc(), SingleTurnSearchCaseRecord.id.desc())
        ).all()
    )
    raw_review_rows = list(
        db.execute(
            select(ProjectTaskReview, ProjectTask)
            .join(ProjectTask, ProjectTask.id == ProjectTaskReview.project_task_id)
            .where(
                ProjectTaskReview.reviewer_id == user_id,
                ProjectTaskReview.review_status == "submitted",
                ProjectTaskReview.submitted_at.is_not(None),
            )
            .order_by(ProjectTaskReview.submitted_at.desc(), ProjectTaskReview.id.desc())
        ).all()
    )

    mrr_items: list[ModelResponseReviewRecord] = []
    seen_mrr_keys: set[tuple[int | None, str]] = set()
    for item in raw_mrr_items:
        key = (item.project_id, item.task_id)
        if key in seen_mrr_keys:
            continue
        seen_mrr_keys.add(key)
        mrr_items.append(item)

    search_case_items: list[SingleTurnSearchCaseRecord] = []
    seen_search_case_keys: set[tuple[int | None, str]] = set()
    for item in raw_search_case_items:
        key = (item.project_id, item.task_id)
        if key in seen_search_case_keys:
            continue
        seen_search_case_keys.add(key)
        search_case_items.append(item)

    review_rows: list[tuple[ProjectTaskReview, ProjectTask]] = []
    seen_review_keys: set[tuple[int, str]] = set()
    for review, task in raw_review_rows:
        key = (task.project_id, task.external_task_id)
        if key in seen_review_keys:
            continue
        seen_review_keys.add(key)
        review_rows.append((review, task))

    project_ids = {
        item.project_id
        for item in [*mrr_items, *search_case_items]
        if item.project_id is not None
    }
    project_ids.update(task.project_id for _, task in review_rows)
    project_name_map = {
        item.id: item.name
        for item in db.scalars(select(Project).where(Project.id.in_(project_ids))).all()
    } if project_ids else {}

    task_keys = {
        (int(item.project_id), item.task_id)
        for item in [*mrr_items, *search_case_items]
        if item.project_id is not None
    }
    task_status_map: dict[tuple[int, str], str] = {}
    if task_keys:
        task_rows = list(
            db.scalars(
                select(ProjectTask).where(
                    ProjectTask.project_id.in_([project_id for project_id, _ in task_keys]),
                    ProjectTask.external_task_id.in_([task_id for _, task_id in task_keys]),
                )
            ).all()
        )
        task_status_map = {
            (task.project_id, task.external_task_id): task.task_status
            for task in task_rows
        }

    records: list[UserSubmissionRecordRead] = []
    for item in mrr_items:
        title = item.prompt_snapshot.strip()[:80] or item.task_id
        records.append(
            UserSubmissionRecordRead(
                submission_type="annotation",
                plugin_code=item.plugin_code,
                plugin_name=_resolve_plugin_name(item.plugin_code),
                submission_id=item.id,
                project_id=item.project_id,
                project_name=project_name_map.get(item.project_id) if item.project_id is not None else None,
                task_id=item.task_id,
                current_status=(
                    task_status_map.get((item.project_id, item.task_id))
                    if item.project_id is not None
                    else None
                ),
                submitted_at=item.submitted_at,
                title=title,
                summary=item.task_category,
                result_label=item.answer_rating,
            )
        )

    for item in search_case_items:
        title = item.prompt.strip()[:80] or item.task_id
        records.append(
            UserSubmissionRecordRead(
                submission_type="annotation",
                plugin_code=item.plugin_code,
                plugin_name=_resolve_plugin_name(item.plugin_code),
                submission_id=item.id,
                project_id=item.project_id,
                project_name=project_name_map.get(item.project_id) if item.project_id is not None else None,
                task_id=item.task_id,
                current_status=(
                    task_status_map.get((item.project_id, item.task_id))
                    if item.project_id is not None
                    else None
                ),
                submitted_at=item.submitted_at,
                title=title,
                summary=f"{item.domain} / {item.timeliness_tag}",
                result_label=f"A {item.model_a_percentage:.2f}% · B {item.model_b_percentage:.2f}%",
            )
        )

    for review, task in review_rows:
        records.append(
            UserSubmissionRecordRead(
                submission_type="review",
                plugin_code=task.plugin_code,
                plugin_name=_resolve_plugin_name(task.plugin_code),
                submission_id=review.id,
                project_id=task.project_id,
                project_name=project_name_map.get(task.project_id),
                task_id=task.external_task_id,
                current_status=task.task_status,
                submitted_at=review.submitted_at or review.updated_at,
                title=f"质检任务 {task.external_task_id}",
                summary=f"第 {review.review_round} 轮质检",
                result_label=(
                    "通过"
                    if review.review_result == "pass"
                    else "不通过"
                    if review.review_result == "reject"
                    else None
                ),
                review_round=review.review_round,
                review_result=review.review_result,
                review_comment=review.review_comment,
            )
        )

    records.sort(key=lambda item: (item.submitted_at, item.submission_id), reverse=True)
    return UserSubmissionRecordList(
        total=len(records),
        items=records[skip : skip + limit],
    )


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


@router.get("/hall")
def list_my_project_hall(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(require_end_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    items, total = list_published_projects(db, skip=skip, limit=limit)
    project_ids = [item.id for item in items]
    stats_map = get_project_task_stats_map(db, project_ids, visible_only=True)
    hall_stats_map = get_project_task_hall_stats_map(db, project_ids, user_id=current_user.id)
    data = ProjectHallList(
        total=total,
        items=[
            _build_project_hall_read(
                item,
                project_stats=stats_map.get(item.id),
                hall_stats=hall_stats_map.get(item.id),
                current_user=current_user,
            )
            for item in items
        ],
    )
    return build_response(data=serialize_schema(data))


@router.get("/annotation-tasks")
def list_my_annotation_tasks(
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    tasks = list_user_annotation_tasks(db, user_id=current_user.id)
    project_ids = list(dict.fromkeys(task.project_id for task in tasks))
    projects = (
        list(db.scalars(select(Project).where(Project.id.in_(project_ids))).all())
        if project_ids
        else []
    )
    project_map = {item.id: item for item in projects}
    stats_map = get_project_task_stats_map(db, project_ids, visible_only=True)
    hall_stats_map = get_project_task_hall_stats_map(db, project_ids, user_id=current_user.id)
    review_stats_map = get_project_task_review_stats_map(db, [item.id for item in tasks])

    items: list[MyAnnotationTaskQueueItem] = []
    for task in tasks:
        project = project_map.get(task.project_id)
        if project is None:
            continue
        hall_stats = hall_stats_map.get(project.id, {})
        items.append(
            MyAnnotationTaskQueueItem(
                project=_build_project_read(project, project_stats=stats_map.get(project.id)),
                task=_build_task_read(db, task, review_stats=review_stats_map.get(task.id)),
                current_user_annotation_limit=int(hall_stats.get("current_user_annotation_limit", 1)),
                current_user_annotation_owned_count=int(
                    hall_stats.get("current_user_annotation_owned_count", 0)
                ),
                trial_passed=bool(hall_stats.get("trial_passed", False)),
            )
        )

    data = MyAnnotationTaskQueueList(total=len(items), items=items)
    return build_response(data=serialize_schema(data))


@router.get("/review/queue")
def list_my_review_projects(
    current_user: User = Depends(require_reviewer_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    items = _get_review_projects_for_user(db, current_user.id)
    project_ids = [item.id for item in items]
    stats_map = get_project_task_stats_map(db, project_ids, visible_only=True)
    hall_stats_map = get_project_task_hall_stats_map(db, project_ids, user_id=current_user.id)
    data = ProjectHallList(
        total=len(items),
        items=[
            _build_project_hall_read(
                item,
                project_stats=stats_map.get(item.id),
                hall_stats=hall_stats_map.get(item.id),
                current_user=current_user,
            )
            for item in items
        ],
    )
    return build_response(data=serialize_schema(data))


@router.get("/review-tasks")
def list_my_review_tasks(
    current_user: User = Depends(require_reviewer_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    review_rows = list_user_review_tasks(db, user_id=current_user.id)
    project_ids = list(dict.fromkeys(task.project_id for _, task in review_rows))
    projects = (
        list(db.scalars(select(Project).where(Project.id.in_(project_ids))).all())
        if project_ids
        else []
    )
    project_map = {item.id: item for item in projects}
    stats_map = get_project_task_stats_map(db, project_ids, visible_only=True)
    hall_stats_map = get_project_task_hall_stats_map(db, project_ids, user_id=current_user.id)
    review_stats_map = get_project_task_review_stats_map(db, [task.id for _, task in review_rows])
    username_map = get_usernames_map(
        db,
        [review.reviewer_id for review, _ in review_rows if review.reviewer_id is not None],
    )

    items: list[MyReviewTaskQueueItem] = []
    for review, task in review_rows:
        project = project_map.get(task.project_id)
        if project is None:
            continue
        hall_stats = hall_stats_map.get(project.id, {})
        items.append(
            MyReviewTaskQueueItem(
                project=_build_project_read(project, project_stats=stats_map.get(project.id)),
                task=_build_task_read(db, task, review_stats=review_stats_map.get(task.id)),
                review=ProjectTaskReviewRead.model_validate(
                    build_project_task_review_payload(
                        review,
                        reviewer_username=(
                            username_map.get(review.reviewer_id)
                            if review.reviewer_id is not None
                            else None
                        ),
                    )
                ),
                current_user_review_limit=int(hall_stats.get("current_user_review_limit", 3)),
                current_user_total_review_owned_count=int(
                    hall_stats.get("current_user_total_review_owned_count", 0)
                ),
                current_user_review_owned_count=int(
                    hall_stats.get("current_user_review_owned_count", 0)
                ),
            )
        )

    data = MyReviewTaskQueueList(total=len(items), items=items)
    return build_response(data=serialize_schema(data))


@router.get("/submission-records")
def list_my_submission_records(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(require_end_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    data = _build_my_submission_records(
        db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
    )
    return build_response(data=serialize_schema(data))


@router.post("/{project_id:int}/annotation-task/claim")
def claim_my_annotation_task(
    project_id: int,
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None or not project.is_published or not project.is_visible:
        raise HTTPException(status_code=404, detail="项目不存在")
    if not project.plugin_code:
        raise HTTPException(status_code=422, detail="项目未绑定插件")

    task = claim_annotation_task(
        db,
        project_id=project_id,
        plugin_code=project.plugin_code,
        user_id=current_user.id,
        prefer_existing=False,
    )
    if task is None:
        raise HTTPException(status_code=422, detail="当前任务还在试标审核中，或已达到可领取上限")

    review_stats = get_project_task_review_stats_map(db, [task.id]).get(task.id, {})
    data = _build_task_read(db, task, review_stats=review_stats)
    return build_response(message="已领取标注任务", data=serialize_schema(data))


@router.post("/{project_id:int}/annotation-task/release")
def release_my_annotation_task(
    project_id: int,
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None or not project.is_published or not project.is_visible:
        raise HTTPException(status_code=404, detail="椤圭洰涓嶅瓨鍦?")
    if not project.plugin_code:
        raise HTTPException(status_code=422, detail="椤圭洰鏈粦瀹氭彃浠?")

    task = release_annotation_task(
        db,
        project_id=project_id,
        plugin_code=project.plugin_code,
        user_id=current_user.id,
    )
    if task is None:
        raise HTTPException(status_code=422, detail="褰撳墠娌℃湁鍙斁寮冪殑璇曟爣浠诲姟")

    return build_response(message="宸叉斁寮冨綋鍓嶈瘯鏍囦换鍔?", data=None)


@router.post("/{project_id:int}/annotation-task/{task_id}/release")
def release_my_annotation_task_by_task_id(
    project_id: int,
    task_id: str,
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None or not project.is_published or not project.is_visible:
        raise HTTPException(status_code=404, detail="妞ゅ湱娲版稉宥呯摠閸?")
    if not project.plugin_code:
        raise HTTPException(status_code=422, detail="妞ゅ湱娲伴張顏嗙拨鐎规碍褰冩禒?")

    task = release_annotation_task_by_external_id(
        db,
        project_id=project_id,
        plugin_code=project.plugin_code,
        user_id=current_user.id,
        external_task_id=task_id,
    )
    if task is None:
        raise HTTPException(status_code=422, detail="瑜版挸澧犲▽鈩冩箒閸欘垱鏂佸鍐畱鐠囨洘鐖ｆ禒璇插")

    return build_response(message="瀹稿弶鏂佸鍐ㄧ秼閸撳秷鐦弽鍥︽崲閸?", data=None)


@router.post("/{project_id:int}/review-task/claim")
def claim_my_review_task(
    project_id: int,
    current_user: User = Depends(require_reviewer_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None or not project.is_published or not project.is_visible:
        raise HTTPException(status_code=404, detail="项目不存在")

    try:
        review = claim_review_task(
            db,
            project_id=project_id,
            user_id=current_user.id,
            prefer_existing=False,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if review is None:
        return build_response(data=None)

    task = db.get(ProjectTask, review.project_task_id)
    if task is None:
        return build_response(data=None)

    data = _build_review_task_detail(db, project_id, review, task)
    return build_response(data=serialize_schema(data))


@router.get("/{project_id:int}/review-task/current")
def get_my_current_review_task(
    project_id: int,
    current_user: User = Depends(require_reviewer_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None or not project.is_published or not project.is_visible:
        raise HTTPException(status_code=404, detail="项目不存在")

    current_review = _get_current_review_for_user(
        db,
        project_id=project_id,
        user_id=current_user.id,
    )
    if current_review is None:
        return build_response(data=None)

    review, task = current_review
    data = _build_review_task_detail(db, project_id, review, task)
    return build_response(data=serialize_schema(data))


@router.get("/{project_id:int}/review-task/{review_id:int}")
def get_my_review_task(
    project_id: int,
    review_id: int,
    current_user: User = Depends(require_reviewer_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None or not project.is_published or not project.is_visible:
        raise HTTPException(status_code=404, detail="椤圭洰涓嶅瓨鍦?")

    review_row = get_user_review_task(
        db,
        project_id=project_id,
        review_id=review_id,
        user_id=current_user.id,
        statuses={REVIEW_STATUS_IN_PROGRESS},
    )
    if review_row is None:
        raise HTTPException(status_code=404, detail="璐ㄦ浠诲姟涓嶅瓨鍦?")

    review, task = review_row
    data = _build_review_task_detail(db, project_id, review, task)
    return build_response(data=serialize_schema(data))


@router.post("/{project_id:int}/review-task/{review_id:int}/submit")
def submit_my_review_task(
    project_id: int,
    review_id: int,
    payload: ProjectTaskReviewSubmit,
    current_user: User = Depends(require_reviewer_user),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None or not project.is_published or not project.is_visible:
        raise HTTPException(status_code=404, detail="项目不存在")

    review = db.get(ProjectTaskReview, review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="质检任务不存在")

    task = db.get(ProjectTask, review.project_task_id)
    if task is None or task.project_id != project_id:
        raise HTTPException(status_code=404, detail="质检任务不存在")

    try:
        updated_review = submit_review_round(
            db,
            review=review,
            task=task,
            reviewer_id=current_user.id,
            review_result=payload.review_result,
            review_comment=payload.review_comment,
            review_annotations=[item.model_dump(mode="json") for item in payload.review_annotations],
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    data = ProjectTaskReviewRead.model_validate(
        build_project_task_review_payload(
            updated_review,
            reviewer_username=current_user.username,
        )
    )
    return build_response(message="质检结果已提交", data=serialize_schema(data))


@router.get("/{project_id:int}")
def get_my_project_detail(
    project_id: int,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    project = get_project_by_id(db, project_id)
    if project is None or not project.is_published or not project.is_visible:
        raise HTTPException(status_code=404, detail="项目不存在")

    stats_map = get_project_task_stats_map(db, [project.id], visible_only=True)
    data = ProjectDetailRead.model_validate(
        build_project_payload(project, stats_map.get(project.id), include_instruction=True)
    )
    return build_response(data=serialize_schema(data))
