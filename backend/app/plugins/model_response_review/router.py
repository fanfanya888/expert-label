from __future__ import annotations

from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_annotator_user
from app.core.response import build_response
from app.db.session import get_db
from app.models.user import User
from app.plugins.model_response_review.plugin import ModelResponseReviewPlugin
from app.plugins.model_response_review.schemas import ModelResponseReviewProjectStats
from app.plugins.registrar import get_plugin_registry
from app.services.llm_service import LLMServiceError

router = APIRouter(prefix="/plugins/model_response_review", tags=["plugin-model-response-review"])


def get_model_response_review_plugin() -> ModelResponseReviewPlugin:
    plugin = get_plugin_registry().get("model_response_review")
    if plugin is None:
        raise HTTPException(status_code=422, detail="模型回答评审插件未注册")
    return cast(ModelResponseReviewPlugin, plugin)


@router.get("/meta")
def get_plugin_meta(
    plugin: ModelResponseReviewPlugin = Depends(get_model_response_review_plugin),
) -> dict[str, object]:
    return build_response(data=plugin.get_metadata_payload())


@router.get("/schema")
def get_plugin_schema(
    plugin: ModelResponseReviewPlugin = Depends(get_model_response_review_plugin),
) -> dict[str, object]:
    return build_response(data=plugin.get_schema())


@router.get("/rubric")
def get_plugin_rubric(
    plugin: ModelResponseReviewPlugin = Depends(get_model_response_review_plugin),
) -> dict[str, object]:
    return build_response(data=plugin.get_rubric())


@router.get("/projects/{project_id}/current-task")
def get_project_current_task(
    project_id: int,
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: ModelResponseReviewPlugin = Depends(get_model_response_review_plugin),
) -> dict[str, object]:
    try:
        data = plugin.get_project_current_task(db, project_id, current_user.id)
    except ValueError:
        data = None
    return build_response(data=data)


@router.get("/projects/{project_id}/tasks/{task_id}")
def get_project_task(
    project_id: int,
    task_id: str,
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: ModelResponseReviewPlugin = Depends(get_model_response_review_plugin),
) -> dict[str, object]:
    data = plugin.get_project_task(db, project_id, task_id, current_user.id)
    return build_response(data=data)


@router.get("/projects/{project_id}/tasks/{task_id}/submission-detail")
def get_project_task_submission_detail(
    project_id: int,
    task_id: str,
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: ModelResponseReviewPlugin = Depends(get_model_response_review_plugin),
) -> dict[str, object]:
    data = plugin.get_my_task_submission_detail(
        db,
        project_id,
        task_id,
        annotator_id=current_user.id,
    )
    if data is None:
        raise HTTPException(status_code=404, detail="鎻愪氦璁板綍涓嶅瓨鍦?")
    return build_response(data=data)


@router.get("/projects/{project_id}/records/{submission_id}")
def get_project_submission_detail(
    project_id: int,
    submission_id: int,
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: ModelResponseReviewPlugin = Depends(get_model_response_review_plugin),
) -> dict[str, object]:
    data = plugin.get_my_submission_detail(
        db,
        project_id,
        submission_id,
        annotator_id=current_user.id,
    )
    if data is None:
        raise HTTPException(status_code=404, detail="鎻愪氦璁板綍涓嶅瓨鍦?")
    return build_response(data=data)


@router.get("/projects/{project_id}/stats")
def get_project_stats(
    project_id: int,
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: ModelResponseReviewPlugin = Depends(get_model_response_review_plugin),
) -> dict[str, object]:
    _ = current_user
    try:
        data = plugin.get_project_stats(db, project_id)
    except ValueError:
        data = ModelResponseReviewProjectStats(
            project_id=project_id,
            total_tasks=0,
            completed_tasks=0,
            pending_tasks=0,
        ).model_dump(mode="json")
    return build_response(data=data)


@router.get("/projects/{project_id}/submissions")
def list_project_submissions(
    project_id: int,
    limit: int = Query(default=10, ge=1, le=50),
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: ModelResponseReviewPlugin = Depends(get_model_response_review_plugin),
) -> dict[str, object]:
    _ = current_user
    try:
        data = plugin.list_project_submissions(db, project_id, limit=limit)
    except ValueError:
        data = []
    return build_response(data=data)


@router.post("/projects/{project_id}/tasks/{task_id}/generate-response")
def generate_project_task_response(
    project_id: int,
    task_id: str,
    force: bool = Query(default=False),
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: ModelResponseReviewPlugin = Depends(get_model_response_review_plugin),
) -> dict[str, object]:
    _ = current_user
    try:
        data = plugin.generate_project_task_response(db, project_id, task_id, force=force)
    except LLMServiceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return build_response(message="模型回答已生成", data=data)


@router.post("/projects/{project_id}/validate")
def validate_submission(
    project_id: int,
    payload: dict[str, Any],
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: ModelResponseReviewPlugin = Depends(get_model_response_review_plugin),
) -> dict[str, object]:
    validated_payload = dict(payload)
    validated_payload["annotator_id"] = current_user.id
    validation = plugin.validate_project_submission(db, project_id, validated_payload)
    return build_response(data=validation)


@router.post("/projects/{project_id}/submissions")
def create_submission(
    project_id: int,
    payload: dict[str, Any],
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: ModelResponseReviewPlugin = Depends(get_model_response_review_plugin),
) -> dict[str, object]:
    validated_payload = dict(payload)
    validated_payload["annotator_id"] = current_user.id
    validation = plugin.validate_project_submission(db, project_id, validated_payload)
    if not validation.get("valid"):
        raise HTTPException(status_code=422, detail="评审提交数据校验失败")

    saved = plugin.save_project_submission(db, project_id, validated_payload)
    return build_response(message="评审结果已提交", data=saved)
