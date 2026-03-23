from __future__ import annotations

from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.response import build_response
from app.db.session import get_db
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
    db: Session = Depends(get_db),
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    try:
        data = plugin.get_project_current_task(db, project_id)
    except ValueError:
        data = None
    return build_response(data=data)


@router.get("/projects/{project_id}/stats")
def get_project_stats(
    project_id: int,
    db: Session = Depends(get_db),
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
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
    db: Session = Depends(get_db),
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    return build_response(data=plugin.validate_project_submission(db, project_id, payload))


@router.post("/projects/{project_id}/submissions")
def create_submission(
    project_id: int,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    validation = plugin.validate_project_submission(db, project_id, payload)
    if not validation.get("valid"):
        raise HTTPException(status_code=422, detail="提交数据校验失败")
    data = plugin.save_project_submission(db, project_id, payload)
    return build_response(message="Case 已提交", data=data)


@router.get("/admin/projects/{project_id}/records")
def list_admin_records(
    project_id: int,
    limit: int = Query(default=100, ge=1, le=200),
    task_id: str | None = Query(default=None),
    db: Session = Depends(get_db),
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    try:
        data = plugin.list_admin_submissions(db, project_id, limit=limit, task_id=task_id)
    except ValueError:
        data = []
    return build_response(data=data)


@router.get("/admin/projects/{project_id}/records/{submission_id}")
def get_admin_record_detail(
    project_id: int,
    submission_id: int,
    db: Session = Depends(get_db),
    plugin: SingleTurnSearchCasePlugin = Depends(get_single_turn_search_case_plugin),
) -> dict[str, object]:
    try:
        detail = plugin.get_admin_submission_detail(db, project_id, submission_id)
    except ValueError:
        detail = None
    if detail is None:
        raise HTTPException(status_code=404, detail="提交记录不存在")
    return build_response(data=detail)
