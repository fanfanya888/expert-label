from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.annotation_core.base import AnnotationPlugin, PluginMetadata
from app.plugins.model_response_review.rubric import get_review_rubric
from app.plugins.model_response_review.schemas import ModelResponseReviewMetadata
from app.plugins.model_response_review.service import ModelResponseReviewService


class ModelResponseReviewPlugin(AnnotationPlugin):
    metadata = PluginMetadata(
        key="model_response_review",
        name="Model Response Review",
        version="1.0.0",
    )

    def __init__(self) -> None:
        self.service = ModelResponseReviewService(
            plugin_code=self.metadata.key,
            plugin_version=self.metadata.version,
        )

    def describe(self) -> dict[str, str]:
        return {
            "summary": "Expert review plugin for evaluating model responses with a single overall rating.",
        }

    def get_metadata_payload(self) -> dict[str, Any]:
        payload = ModelResponseReviewMetadata(
            key=self.metadata.key,
            name=self.metadata.name,
            version=self.metadata.version,
            summary=self.describe()["summary"],
        )
        return payload.model_dump(mode="json")

    def get_schema(self) -> dict[str, Any]:
        return self.service.build_schema().model_dump(mode="json")

    def get_rubric(self) -> dict[str, Any]:
        return get_review_rubric()

    def validate_task_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.service.validate_task_payload(payload)

    def get_project_current_task(self, db: Session, project_id: int) -> dict[str, Any] | None:
        task = self.service.get_current_task(db, project_id)
        if task is None:
            return None
        return task.model_dump(mode="json")

    def generate_project_task_response(
        self,
        db: Session,
        project_id: int,
        task_id: str,
        *,
        force: bool = False,
    ) -> dict[str, Any]:
        return self.service.generate_task_response(db, project_id, task_id, force=force).model_dump(mode="json")

    def get_project_stats(self, db: Session, project_id: int) -> dict[str, Any]:
        return self.service.build_project_stats(db, project_id).model_dump(mode="json")

    def list_project_submissions(
        self,
        db: Session,
        project_id: int,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        return [
            item.model_dump(mode="json")
            for item in self.service.list_submission_records(db, project_id, limit=limit)
        ]

    def list_project_task_submissions(
        self,
        db: Session,
        project_id: int,
        task_id: str,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        return [
            item.model_dump(mode="json")
            for item in self.service.list_submission_records(
                db,
                project_id,
                limit=limit,
                task_id=task_id,
                require_published=False,
            )
        ]

    def validate_project_submission(
        self,
        db: Session,
        project_id: int,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        return self.service.validate_submission(db, project_id, payload).model_dump(mode="json")

    def save_project_submission(
        self,
        db: Session,
        project_id: int,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        return self.service.save_submission(db, project_id, payload).model_dump(mode="json")
