from __future__ import annotations

from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import require_annotator_user
from app.core.response import build_response
from app.db.session import get_db
from app.models.user import User
from app.plugins.registrar import get_plugin_registry
from app.plugins.single_turn_search_case.plugin import SingleTurnSearchCasePlugin
from app.plugins.single_turn_search_case.schemas import SingleTurnSearchCaseProjectStats

router = APIRouter(prefix="/plugins/single_turn_search_case", tags=["plugin-single-turn-search-case"])


def get_single_turn_search_case_plugin() -> SingleTurnSearchCasePlugin:
    plugin = get_plugin_registry().get("single_turn_search_case")
    if plugin is None:
        raise HTTPException(status_code=422, detail="单轮搜索 case 插件未注册")
    return cast(SingleTurnSearchCasePlugin, plugin)


@router.get("/meta")
def get_plugin_meta(
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    return build_response(data=plugin.get_metadata_payload())


@router.get("/schema")
def get_plugin_schema(
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    return build_response(data=plugin.get_schema())


@router.get("/projects/{project_id}/current-task")
def get_project_current_task(
    project_id: int,
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
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
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    data = plugin.get_project_task(db, project_id, task_id, current_user.id)
    return build_response(data=data)


@router.get("/projects/{project_id}/tasks/{task_id}/submission-detail")
def get_project_task_submission_detail(
    project_id: int,
    task_id: str,
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
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
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
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
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    _ = current_user
    try:
        data = plugin.get_project_stats(db, project_id)
    except ValueError:
        data = SingleTurnSearchCaseProjectStats(
            project_id=project_id,
            total_tasks=0,
            completed_tasks=0,
            pending_tasks=0,
        ).model_dump(mode="json")
    return build_response(data=data)


@router.post("/projects/{project_id}/validate")
def validate_submission(
    project_id: int,
    payload: dict[str, Any],
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    validated_payload = dict(payload)
    validated_payload["annotator_id"] = current_user.id
    return build_response(data=plugin.validate_project_submission(db, project_id, validated_payload))


@router.post("/projects/{project_id}/rule-ai-review")
def review_rule_with_ai(
    project_id: int,
    payload: dict[str, Any],
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    _ = current_user
    return build_response(data=plugin.review_project_rule_with_ai(db, project_id, payload))


@router.post("/projects/{project_id}/rule-definition-ai-review")
def review_rule_definition_with_ai(
    project_id: int,
    payload: dict[str, Any],
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    _ = current_user
    return build_response(data=plugin.review_project_rule_definition_with_ai(db, project_id, payload))


@router.post("/projects/{project_id}/model-a-ai-review")
def review_model_a_with_ai(
    project_id: int,
    payload: dict[str, Any],
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    _ = current_user
    return build_response(data=plugin.review_project_model_with_ai(db, project_id, payload, "model_a"))


@router.post("/projects/{project_id}/model-b-ai-review")
def review_model_b_with_ai(
    project_id: int,
    payload: dict[str, Any],
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    _ = current_user
    return build_response(data=plugin.review_project_model_with_ai(db, project_id, payload, "model_b"))


@router.post("/projects/{project_id}/submissions")
def create_submission(
    project_id: int,
    payload: dict[str, Any],
    current_user: User = Depends(require_annotator_user),
    db: Session = Depends(get_db),
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    validated_payload = dict(payload)
    validated_payload["annotator_id"] = current_user.id
    validation = plugin.validate_project_submission(db, project_id, validated_payload)
    if not validation.get("valid"):
        raise HTTPException(status_code=422, detail="提交数据校验失败")
    data = plugin.save_project_submission(db, project_id, validated_payload)
    return build_response(message="Case 已提交", data=data)
