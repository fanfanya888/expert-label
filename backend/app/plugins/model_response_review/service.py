from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.task_workflow import (
    TASK_COMPLETED_STATUSES,
    TASK_STATUS_ANNOTATION_IN_PROGRESS,
    TASK_STATUS_APPROVED,
    TASK_STATUS_PENDING_REVIEW_DISPATCH,
)
from app.crud.project_tasks import claim_annotation_task
from app.models.model_response_review import ModelResponseReviewRecord
from app.models.project import Project
from app.models.project_task import ProjectTask
from app.plugins.model_response_review.config import get_model_response_review_settings
from app.plugins.model_response_review.rubric import (
    ANSWER_RATINGS,
    TASK_CATEGORIES,
    get_review_rubric,
)
from app.plugins.model_response_review.schemas import (
    ModelResponseReviewProjectStats,
    ModelResponseReviewSavedSubmission,
    ModelResponseReviewSchema,
    ModelResponseReviewSubmission,
    ModelResponseReviewSubmissionRecord,
    ModelResponseReviewTaskPayload,
    ModelResponseReviewTaskRead,
    ModelResponseReviewValidationIssue,
    ModelResponseReviewValidationResult,
)
from app.services.llm_service import LLMClientConfig, LLMService, LLMServiceError


class ModelResponseReviewService:
    def __init__(self, plugin_code: str, plugin_version: str) -> None:
        self.plugin_code = plugin_code
        self.plugin_version = plugin_version

    def build_schema(self) -> ModelResponseReviewSchema:
        return ModelResponseReviewSchema(
            plugin_code=self.plugin_code,
            plugin_version=self.plugin_version,
            page_title="Model Response Review",
            sections=[
                "Task Overview",
                "Task Category",
                "Prompt",
                "Model Response",
                "Review Rubric",
                "Answer Rating",
                "Rating Rationale",
            ],
            task_category_options=TASK_CATEGORIES,
            answer_rating_options=ANSWER_RATINGS,
            rating_reason_placeholder="Explain the main reason for your rating.",
        )

    def validate_task_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        normalized = ModelResponseReviewTaskPayload.model_validate(payload)
        return normalized.model_dump(mode="json")

    def get_project_or_raise(
        self,
        db: Session,
        project_id: int,
        *,
        require_published: bool = True,
    ) -> Project:
        project = db.get(Project, project_id)
        if project is None or project.plugin_code != self.plugin_code:
            raise ValueError("project_not_found")
        if require_published and (not project.is_published or not project.is_visible):
            raise ValueError("project_not_found")
        return project

    def build_project_stats(self, db: Session, project_id: int) -> ModelResponseReviewProjectStats:
        self.get_project_or_raise(db, project_id)
        total = (
            db.scalar(
                select(func.count()).select_from(ProjectTask).where(
                    ProjectTask.project_id == project_id,
                    ProjectTask.plugin_code == self.plugin_code,
                    ProjectTask.publish_status == "published",
                    ProjectTask.is_visible.is_(True),
                )
            )
            or 0
        )
        completed = (
            db.scalar(
                select(func.count()).select_from(ProjectTask).where(
                    ProjectTask.project_id == project_id,
                    ProjectTask.plugin_code == self.plugin_code,
                    ProjectTask.publish_status == "published",
                    ProjectTask.is_visible.is_(True),
                    ProjectTask.task_status.in_(TASK_COMPLETED_STATUSES),
                )
            )
            or 0
        )
        return ModelResponseReviewProjectStats(
            project_id=project_id,
            total_tasks=int(total),
            completed_tasks=int(completed),
            pending_tasks=max(int(total) - int(completed), 0),
        )

    def get_current_task(self, db: Session, project_id: int, user_id: int) -> ModelResponseReviewTaskRead | None:
        self.get_project_or_raise(db, project_id)
        task = claim_annotation_task(
            db,
            project_id=project_id,
            plugin_code=self.plugin_code,
            user_id=user_id,
        )
        if task is None:
            return None
        return self._build_task_read(task)

    def generate_task_response(
        self,
        db: Session,
        project_id: int,
        task_id: str,
        *,
        force: bool = False,
    ) -> ModelResponseReviewTaskRead:
        self.get_project_or_raise(db, project_id)
        task = self._get_task_or_raise(db, project_id, task_id)
        if task.publish_status != "published" or not task.is_visible:
            raise ValueError("task is not published")
        if task.task_status == TASK_STATUS_APPROVED:
            raise ValueError("task has already been completed")

        payload = ModelResponseReviewTaskPayload.model_validate(task.task_payload)
        if payload.model_reply and not force:
            return self._build_task_read(task)

        fallback_reason: str | None = None
        try:
            result = self._get_generation_llm_service().generate_response(payload.prompt)
        except LLMServiceError as exc:
            if not self._should_allow_generation_mock_fallback():
                raise
            fallback_reason = str(exc)
            result = self._get_generation_fallback_llm_service().generate_response(payload.prompt)

        metadata = {
            **{
                key: value
                for key, value in (payload.metadata or {}).items()
                if key not in {"generated_by_provider", "generated_model", "generation_fallback", "generation_fallback_reason"}
            },
            "generated_by_provider": result.provider,
            "generated_model": result.model,
        }
        if fallback_reason:
            metadata["generation_fallback"] = True
            metadata["generation_fallback_reason"] = fallback_reason[:300]
        task.task_payload = {
            **payload.model_dump(mode="json"),
            "model_reply": result.content,
            "metadata": metadata,
        }
        db.add(task)
        db.commit()
        db.refresh(task)
        return self._build_task_read(task)

    def validate_submission(
        self,
        db: Session,
        project_id: int,
        payload: dict[str, Any],
    ) -> ModelResponseReviewValidationResult:
        normalized_payload = {
            **payload,
            "project_id": project_id,
        }
        try:
            normalized = ModelResponseReviewSubmission.model_validate(normalized_payload)
        except ValidationError as exc:
            issues = []
            for item in exc.errors():
                field = ".".join(str(part) for part in item.get("loc", []))
                issues.append(
                    ModelResponseReviewValidationIssue(
                        field=field or "payload",
                        message=item.get("msg", "Invalid value"),
                    )
                )
            return ModelResponseReviewValidationResult(valid=False, errors=issues)

        try:
            self.get_project_or_raise(db, project_id)
        except ValueError:
            return ModelResponseReviewValidationResult(
                valid=False,
                errors=[
                    ModelResponseReviewValidationIssue(
                        field="project_id",
                        message="project is invalid",
                    )
                ],
            )

        task = self._get_task(db, project_id, normalized.task_id)
        if task is None:
            return ModelResponseReviewValidationResult(
                valid=False,
                errors=[
                    ModelResponseReviewValidationIssue(
                        field="task_id",
                        message="task is not found",
                    )
                ],
            )

        if task.publish_status != "published" or not task.is_visible:
            return ModelResponseReviewValidationResult(
                valid=False,
                errors=[
                    ModelResponseReviewValidationIssue(
                        field="task_id",
                        message="task is not published",
                    )
                ],
            )

        if task.task_status != TASK_STATUS_ANNOTATION_IN_PROGRESS:
            return ModelResponseReviewValidationResult(
                valid=False,
                errors=[
                    ModelResponseReviewValidationIssue(
                        field="task_id",
                        message="task is not assigned for annotation",
                    )
                ],
            )

        if task.annotation_assignee_id != normalized.annotator_id:
            return ModelResponseReviewValidationResult(
                valid=False,
                errors=[
                    ModelResponseReviewValidationIssue(
                        field="annotator_id",
                        message="task belongs to another annotator",
                    )
                ],
            )

        task_payload = ModelResponseReviewTaskPayload.model_validate(task.task_payload)
        if not task_payload.model_reply:
            return ModelResponseReviewValidationResult(
                valid=False,
                errors=[
                    ModelResponseReviewValidationIssue(
                        field="model_reply_snapshot",
                        message="model response is required before submission",
                    )
                ],
            )

        if normalized.rubric_version != task_payload.rubric_version:
            return ModelResponseReviewValidationResult(
                valid=False,
                errors=[
                    ModelResponseReviewValidationIssue(
                        field="rubric_version",
                        message="rubric_version does not match task",
                    )
                ],
            )

        return ModelResponseReviewValidationResult(valid=True, normalized=normalized)

    def save_submission(
        self,
        db: Session,
        project_id: int,
        payload: dict[str, Any],
    ) -> ModelResponseReviewSavedSubmission:
        validation = self.validate_submission(db, project_id, payload)
        if not validation.valid or validation.normalized is None:
            raise ValueError("submission payload is invalid")

        normalized = validation.normalized
        task = self._get_task(db, project_id, normalized.task_id)
        if task is None:
            raise ValueError("task is not found")

        record = ModelResponseReviewRecord(
            project_id=project_id,
            task_id=normalized.task_id,
            annotator_id=normalized.annotator_id,
            task_category=normalized.task_category,
            answer_rating=normalized.answer_rating,
            rating_reason=normalized.rating_reason,
            prompt_snapshot=normalized.prompt_snapshot,
            model_reply_snapshot=normalized.model_reply_snapshot,
            rubric_version=normalized.rubric_version,
            rubric_snapshot=normalized.rubric_snapshot,
            record_metadata=normalized.metadata,
            plugin_code=self.plugin_code,
            plugin_version=self.plugin_version,
        )
        db.add(record)

        task.task_status = TASK_STATUS_PENDING_REVIEW_DISPATCH
        task.annotation_submitted_at = datetime.now(timezone.utc)
        db.add(task)

        db.commit()
        db.refresh(record)
        db.refresh(task)

        return ModelResponseReviewSavedSubmission(
            submission_id=record.id,
            project_id=project_id,
            task_id=record.task_id,
            plugin_code=record.plugin_code,
            plugin_version=record.plugin_version,
            task_status=task.task_status,
            submitted_at=record.submitted_at,
        )

    def list_submission_records(
        self,
        db: Session,
        project_id: int,
        *,
        limit: int = 20,
        task_id: str | None = None,
        annotator_id: int | None = None,
        require_published: bool = True,
    ) -> list[ModelResponseReviewSubmissionRecord]:
        self.get_project_or_raise(db, project_id, require_published=require_published)
        statement = (
            select(ModelResponseReviewRecord)
            .where(ModelResponseReviewRecord.project_id == project_id)
            .order_by(ModelResponseReviewRecord.submitted_at.desc(), ModelResponseReviewRecord.id.desc())
        )
        if task_id:
            statement = statement.where(ModelResponseReviewRecord.task_id == task_id)
        if annotator_id is not None:
            statement = statement.where(ModelResponseReviewRecord.annotator_id == annotator_id)
        statement = statement.limit(limit)

        items = list(db.scalars(statement).all())
        return [
            ModelResponseReviewSubmissionRecord(
                submission_id=item.id,
                project_id=item.project_id,
                task_id=item.task_id,
                annotator_id=item.annotator_id,
                task_category=item.task_category,
                answer_rating=item.answer_rating,
                rating_reason=item.rating_reason,
                prompt_snapshot=item.prompt_snapshot,
                model_reply_snapshot=item.model_reply_snapshot,
                rubric_version=item.rubric_version,
                metadata=item.record_metadata,
                plugin_code=item.plugin_code,
                plugin_version=item.plugin_version,
                submitted_at=item.submitted_at,
            )
            for item in items
        ]

    def get_task_submission_detail(
        self,
        db: Session,
        project_id: int,
        task_id: str,
        *,
        annotator_id: int,
    ) -> ModelResponseReviewSubmissionRecord | None:
        items = self.list_submission_records(
            db,
            project_id,
            limit=1,
            task_id=task_id,
            annotator_id=annotator_id,
            require_published=False,
        )
        if not items:
            return None
        return items[0]

    def get_submission_detail(
        self,
        db: Session,
        project_id: int,
        submission_id: int,
        *,
        annotator_id: int,
    ) -> ModelResponseReviewSubmissionRecord | None:
        self.get_project_or_raise(db, project_id, require_published=False)
        item = db.scalar(
            select(ModelResponseReviewRecord).where(
                ModelResponseReviewRecord.project_id == project_id,
                ModelResponseReviewRecord.id == submission_id,
                ModelResponseReviewRecord.annotator_id == annotator_id,
            )
        )
        if item is None:
            return None
        return ModelResponseReviewSubmissionRecord(
            submission_id=item.id,
            project_id=item.project_id,
            task_id=item.task_id,
            annotator_id=item.annotator_id,
            task_category=item.task_category,
            answer_rating=item.answer_rating,
            rating_reason=item.rating_reason,
            prompt_snapshot=item.prompt_snapshot,
            model_reply_snapshot=item.model_reply_snapshot,
            rubric_version=item.rubric_version,
            metadata=item.record_metadata,
            plugin_code=item.plugin_code,
            plugin_version=item.plugin_version,
            submitted_at=item.submitted_at,
        )

    def delete_task_records(self, db: Session, project_id: int, task_id: str) -> None:
        self.get_project_or_raise(db, project_id, require_published=False)
        rows = db.scalars(
            select(ModelResponseReviewRecord).where(
                ModelResponseReviewRecord.project_id == project_id,
                ModelResponseReviewRecord.task_id == task_id,
            )
        ).all()
        for row in rows:
            db.delete(row)
        db.flush()

    def get_rubric_snapshot(self) -> dict[str, Any]:
        return get_review_rubric()

    def _get_task(self, db: Session, project_id: int, task_id: str) -> ProjectTask | None:
        return db.scalar(
            select(ProjectTask).where(
                ProjectTask.project_id == project_id,
                ProjectTask.plugin_code == self.plugin_code,
                ProjectTask.external_task_id == task_id,
            )
        )

    def _get_task_or_raise(self, db: Session, project_id: int, task_id: str) -> ProjectTask:
        task = self._get_task(db, project_id, task_id)
        if task is None:
            raise ValueError("task is not found")
        return task

    def _build_task_read(self, task: ProjectTask) -> ModelResponseReviewTaskRead:
        normalized_payload = ModelResponseReviewTaskPayload.model_validate(task.task_payload)
        return ModelResponseReviewTaskRead(
            project_id=task.project_id,
            task_id=task.external_task_id,
            prompt=normalized_payload.prompt,
            model_reply=normalized_payload.model_reply,
            task_category=normalized_payload.task_category,
            metadata=normalized_payload.metadata,
            rubric_version=normalized_payload.rubric_version,
            status=task.task_status,
        )

    def _get_generation_llm_service(self) -> LLMService:
        try:
            plugin_settings = get_model_response_review_settings()
            slot_config = plugin_settings.get_slot("generation")
        except (ValidationError, ValueError) as exc:
            raise LLMServiceError("插件模型配置无效，请检查 model_response_review/plugin.env") from exc
        return LLMService(slot_config)

    def _should_allow_generation_mock_fallback(self) -> bool:
        try:
            plugin_settings = get_model_response_review_settings()
        except (ValidationError, ValueError) as exc:
            raise LLMServiceError("鎻掍欢妯″瀷閰嶇疆鏃犳晥锛岃妫€鏌?model_response_review/plugin.env") from exc
        return plugin_settings.generation_allow_mock_fallback

    def _get_generation_llm_service(self) -> LLMService:
        try:
            plugin_settings = get_model_response_review_settings()
            slot_config = plugin_settings.get_slot("generation")
        except (ValidationError, ValueError) as exc:
            raise LLMServiceError("插件模型配置无效，请检查 model_response_review/plugin.env") from exc
        return LLMService(slot_config)

    def _should_allow_generation_mock_fallback(self) -> bool:
        try:
            plugin_settings = get_model_response_review_settings()
        except (ValidationError, ValueError) as exc:
            raise LLMServiceError("插件模型配置无效，请检查 model_response_review/plugin.env") from exc
        return plugin_settings.generation_allow_mock_fallback

    def _get_generation_fallback_llm_service(self) -> LLMService:
        return LLMService(
            LLMClientConfig(
                enabled=True,
                provider="mock",
                model="mock-model-response-review-fallback",
                slot_name="generation-fallback",
            )
        )

    def _get_generation_llm_service(self) -> LLMService:
        try:
            plugin_settings = get_model_response_review_settings()
            slot_config = plugin_settings.get_slot("generation")
        except (ValidationError, ValueError) as exc:
            raise LLMServiceError("插件模型配置无效，请检查 model_response_review/plugin.env") from exc
        return LLMService(slot_config)

    def _should_allow_generation_mock_fallback(self) -> bool:
        try:
            plugin_settings = get_model_response_review_settings()
        except (ValidationError, ValueError) as exc:
            raise LLMServiceError("插件模型配置无效，请检查 model_response_review/plugin.env") from exc
        return plugin_settings.generation_allow_mock_fallback
