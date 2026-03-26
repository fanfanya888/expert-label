from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.annotation_core.base import AnnotationPlugin, PluginMetadata
from app.plugins.single_turn_search_case.schemas import SingleTurnSearchCaseMetadata
from app.plugins.single_turn_search_case.service import SingleTurnSearchCaseService


class SingleTurnSearchCasePlugin(AnnotationPlugin):
    metadata = PluginMetadata(
        key="single_turn_search_case",
        name="Single Turn Search Case",
        version="1.0.0",
    )

    def __init__(self) -> None:
        self.service = SingleTurnSearchCaseService(
            plugin_code=self.metadata.key,
            plugin_version=self.metadata.version,
        )

    def describe(self) -> dict[str, str]:
        return {
            "summary": "Case production plugin for single-turn daily search boundary evaluation.",
        }

    def get_metadata_payload(self) -> dict[str, Any]:
        payload = SingleTurnSearchCaseMetadata(
            key=self.metadata.key,
            name=self.metadata.name,
            version=self.metadata.version,
            summary=self.describe()["summary"],
        )
        return payload.model_dump(mode="json")

    def get_schema(self) -> dict[str, Any]:
        return self.service.build_schema().model_dump(mode="json")

    def validate_task_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.service.validate_task_payload(payload)

    def get_project_current_task(self, db: Session, project_id: int, user_id: int) -> dict[str, Any] | None:
        task = self.service.get_current_task(db, project_id, user_id)
        if task is None:
            return None
        return task.model_dump(mode="json")

    def get_project_task(
        self,
        db: Session,
        project_id: int,
        task_id: str,
        user_id: int,
    ) -> dict[str, Any] | None:
        task = self.service.get_task(db, project_id, task_id, user_id)
        if task is None:
            return None
        return task.model_dump(mode="json")

    def get_project_stats(self, db: Session, project_id: int) -> dict[str, Any]:
        return self.service.build_project_stats(db, project_id).model_dump(mode="json")

    def validate_project_submission(self, db: Session, project_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        return self.service.validate_submission(db, project_id, payload).model_dump(mode="json")

    def review_project_rule_with_ai(self, db: Session, project_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        return self.service.review_rule_with_ai(db, project_id, payload).model_dump(mode="json")

    def review_project_rule_definition_with_ai(
        self,
        db: Session,
        project_id: int,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        return self.service.review_rule_definition_with_ai(db, project_id, payload).model_dump(mode="json")

    def review_project_model_with_ai(
        self,
        db: Session,
        project_id: int,
        payload: dict[str, Any],
        target_model: str,
    ) -> dict[str, Any]:
        return self.service.review_model_with_ai(db, project_id, payload, target_model).model_dump(mode="json")

    def save_project_submission(self, db: Session, project_id: int, payload: dict[str, Any]) -> dict[str, Any]:
        return self.service.save_submission(db, project_id, payload).model_dump(mode="json")

    def list_project_task_submissions(
        self,
        db: Session,
        project_id: int,
        task_id: str,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        return [
            item.model_dump(mode="json")
            for item in self.service.list_submission_summaries(
                db,
                project_id,
                task_id=task_id,
                limit=limit,
                require_published=False,
            )
        ]

    def get_latest_task_submission_detail(
        self,
        db: Session,
        project_id: int,
        task_id: str,
    ) -> dict[str, Any] | None:
        items = self.service.list_submission_summaries(
            db,
            project_id,
            limit=1,
            task_id=task_id,
            require_published=False,
        )
        if not items:
            return None
        detail = self.service.get_submission_detail(
            db,
            project_id,
            items[0].submission_id,
            require_published=False,
        )
        if detail is None:
            return None
        return detail.model_dump(mode="json")

    def get_admin_submission_detail(
        self,
        db: Session,
        project_id: int,
        submission_id: int,
    ) -> dict[str, Any] | None:
        detail = self.service.get_submission_detail(
            db,
            project_id,
            submission_id,
            require_published=False,
        )
        if detail is None:
            return None
        return detail.model_dump(mode="json")

    def get_my_task_submission_detail(
        self,
        db: Session,
        project_id: int,
        task_id: str,
        *,
        annotator_id: int,
    ) -> dict[str, Any] | None:
        detail = self.service.get_task_submission_detail(
            db,
            project_id,
            task_id,
            annotator_id=annotator_id,
        )
        if detail is None:
            return None
        return detail.model_dump(mode="json")

    def get_my_submission_detail(
        self,
        db: Session,
        project_id: int,
        submission_id: int,
        *,
        annotator_id: int,
    ) -> dict[str, Any] | None:
        detail = self.service.get_my_submission_detail(
            db,
            project_id,
            submission_id,
            annotator_id=annotator_id,
        )
        if detail is None:
            return None
        return detail.model_dump(mode="json")

    def delete_project_task_data(
        self,
        db: Session,
        project_id: int,
        task_id: str,
    ) -> None:
        self.service.delete_task_records(db, project_id, task_id)
