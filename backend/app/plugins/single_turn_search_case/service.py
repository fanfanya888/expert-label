from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.task_workflow import (
    REVIEW_STATUS_SUBMITTED,
    TASK_COMPLETED_STATUSES,
    TASK_STATUS_ANNOTATION_IN_PROGRESS,
    TASK_STATUS_PENDING_REVIEW_DISPATCH,
)
from app.crud.project_task_reviews import prepare_review_round_for_submission
from app.crud.project_tasks import claim_annotation_task
from app.models.project import Project
from app.models.project_task import ProjectTask
from app.models.project_task_review import ProjectTaskReview
from app.models.single_turn_search_case_record import SingleTurnSearchCaseRecord
from app.plugins.single_turn_search_case.config import get_single_turn_search_case_settings
from app.plugins.single_turn_search_case.schemas import (
    DEFAULT_DOMAIN_OPTIONS,
    DEFAULT_TIMELINESS_OPTIONS,
    EVIDENCE_SOURCE_OPTIONS,
    SearchCaseAiModelReviewResult,
    SearchCaseAiReviewCheckItem,
    SearchCaseAiReviewMissingField,
    SearchCaseAiReviewPrecheck,
    SearchCaseAiReviewSummary,
    SearchCaseAiRuleReviewResult,
    SearchCaseModelAnswer,
    SearchCaseRuleEvaluation,
    SearchCaseRuleInput,
    SearchCaseScoreSummary,
    SearchCaseSoftCheck,
    SingleTurnSearchCaseLatestReview,
    SingleTurnSearchCaseProjectStats,
    SingleTurnSearchCaseAiReviewRequest,
    SingleTurnSearchCaseSavedSubmission,
    SingleTurnSearchCaseAiModelCheckResponse,
    SingleTurnSearchCaseAiRuleCheckResponse,
    SingleTurnSearchCaseSchema,
    SingleTurnSearchCaseAiReviewResponse,
    SingleTurnSearchCaseSubmission,
    SingleTurnSearchCaseSubmissionDetail,
    SingleTurnSearchCaseSubmissionSummary,
    SingleTurnSearchCaseTaskPayload,
    SingleTurnSearchCaseTaskRead,
    SingleTurnSearchCaseValidationIssue,
    SingleTurnSearchCaseValidationResult,
)
from app.services.llm_service import LLMService, LLMServiceError


class SingleTurnSearchCaseService:
    def __init__(self, plugin_code: str, plugin_version: str) -> None:
        self.plugin_code = plugin_code
        self.plugin_version = plugin_version

    def build_schema(self) -> SingleTurnSearchCaseSchema:
        return SingleTurnSearchCaseSchema(
            plugin_code=self.plugin_code,
            plugin_version=self.plugin_version,
            page_title="Single Turn Search Boundary Case",
            sections=[
                "作业说明区",
                "出题信息区",
                "模型一回复录入区",
                "模型二回复录入区",
                "参考答案区",
                "评分规则区",
                "模型评分区",
                "自动统计区",
            ],
            evidence_source_options=EVIDENCE_SOURCE_OPTIONS,
            default_domain_options=DEFAULT_DOMAIN_OPTIONS,
            default_timeliness_options=DEFAULT_TIMELINESS_OPTIONS,
            model_labels=["模型一", "模型二"],
        )

    def validate_task_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        normalized = SingleTurnSearchCaseTaskPayload.model_validate(payload)
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

    def build_project_stats(self, db: Session, project_id: int) -> SingleTurnSearchCaseProjectStats:
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
        return SingleTurnSearchCaseProjectStats(
            project_id=project_id,
            total_tasks=int(total),
            completed_tasks=int(completed),
            pending_tasks=max(int(total) - int(completed), 0),
        )

    def get_current_task(self, db: Session, project_id: int, user_id: int) -> SingleTurnSearchCaseTaskRead | None:
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

    def review_rule_with_ai(
        self,
        db: Session,
        project_id: int,
        payload: dict[str, Any],
    ) -> SingleTurnSearchCaseAiReviewResponse:
        self.get_project_or_raise(db, project_id)
        snapshot = SingleTurnSearchCaseAiReviewRequest.model_validate({**payload, "project_id": project_id})
        precheck = self._build_ai_review_precheck(snapshot)
        if not precheck.passed:
            return SingleTurnSearchCaseAiReviewResponse(ok=True, precheck=precheck)

        review_config = get_single_turn_search_case_settings().get_review_config()
        if not review_config.enabled:
            return SingleTurnSearchCaseAiReviewResponse(
                ok=False,
                precheck=precheck,
                provider=review_config.provider,
                error_message="AI 复核未启用，请检查 single_turn_search_case/plugin.env",
            )

        try:
            if review_config.provider.strip().lower() == "mock":
                return self._build_mock_ai_review(snapshot, precheck, review_config.provider)

            raw_result = LLMService(review_config).generate_response(self._build_ai_review_prompt(snapshot))
            return self._parse_ai_review_response(raw_result.content, precheck, raw_result.provider)
        except (LLMServiceError, ValueError, ValidationError, json.JSONDecodeError) as exc:
            return SingleTurnSearchCaseAiReviewResponse(
                ok=False,
                precheck=precheck,
                provider=review_config.provider,
                error_message=str(exc),
            )

    def review_rule_definition_with_ai(
        self,
        db: Session,
        project_id: int,
        payload: dict[str, Any],
    ) -> SingleTurnSearchCaseAiRuleCheckResponse:
        self.get_project_or_raise(db, project_id)
        snapshot = SingleTurnSearchCaseAiReviewRequest.model_validate({**payload, "project_id": project_id})
        precheck = self._build_rule_definition_precheck(snapshot)
        if not precheck.passed:
            return SingleTurnSearchCaseAiRuleCheckResponse(ok=True, precheck=precheck)

        review_config = get_single_turn_search_case_settings().get_review_config()
        if not review_config.enabled:
            return SingleTurnSearchCaseAiRuleCheckResponse(
                ok=False,
                precheck=precheck,
                provider=review_config.provider,
                error_message="AI 复核未启用，请检查 single_turn_search_case/plugin.env",
            )

        try:
            if review_config.provider.strip().lower() == "mock":
                return self._build_mock_rule_definition_review(snapshot, precheck, review_config.provider)

            raw_result = LLMService(review_config).generate_response(self._build_rule_definition_review_prompt(snapshot))
            return self._parse_rule_definition_review_response(raw_result.content, precheck, raw_result.provider)
        except (LLMServiceError, ValueError, ValidationError, json.JSONDecodeError) as exc:
            return SingleTurnSearchCaseAiRuleCheckResponse(
                ok=False,
                precheck=precheck,
                provider=review_config.provider,
                error_message=str(exc),
            )

    def review_model_with_ai(
        self,
        db: Session,
        project_id: int,
        payload: dict[str, Any],
        target_model: Literal["model_a", "model_b"],
    ) -> SingleTurnSearchCaseAiModelCheckResponse:
        self.get_project_or_raise(db, project_id)
        snapshot = SingleTurnSearchCaseAiReviewRequest.model_validate({**payload, "project_id": project_id})
        precheck = self._build_model_review_precheck(snapshot, target_model)
        if not precheck.passed:
            return SingleTurnSearchCaseAiModelCheckResponse(ok=True, precheck=precheck)

        review_config = get_single_turn_search_case_settings().get_review_config()
        if not review_config.enabled:
            return SingleTurnSearchCaseAiModelCheckResponse(
                ok=False,
                precheck=precheck,
                provider=review_config.provider,
                error_message="AI 复核未启用，请检查 single_turn_search_case/plugin.env",
            )

        try:
            if review_config.provider.strip().lower() == "mock":
                return self._build_mock_model_review(snapshot, precheck, review_config.provider, target_model)

            raw_result = LLMService(review_config).generate_response(
                self._build_model_review_prompt(snapshot, target_model),
            )
            return self._parse_model_review_response(raw_result.content, precheck, raw_result.provider)
        except (LLMServiceError, ValueError, ValidationError, json.JSONDecodeError) as exc:
            return SingleTurnSearchCaseAiModelCheckResponse(
                ok=False,
                precheck=precheck,
                provider=review_config.provider,
                error_message=str(exc),
            )

    def validate_submission(
        self,
        db: Session,
        project_id: int,
        payload: dict[str, Any],
    ) -> SingleTurnSearchCaseValidationResult:
        normalized_payload = {**payload, "project_id": project_id}
        try:
            normalized = SingleTurnSearchCaseSubmission.model_validate(normalized_payload)
        except ValidationError as exc:
            return SingleTurnSearchCaseValidationResult(valid=False, errors=self._convert_validation_errors(exc))

        try:
            self.get_project_or_raise(db, project_id)
        except ValueError:
            return SingleTurnSearchCaseValidationResult(
                valid=False,
                errors=[SingleTurnSearchCaseValidationIssue(field="project_id", message="project is invalid")],
            )

        task = self._get_task(db, project_id, normalized.task_id)
        if task is None:
            return SingleTurnSearchCaseValidationResult(
                valid=False,
                errors=[SingleTurnSearchCaseValidationIssue(field="task_id", message="task is not found")],
            )
        if task.publish_status != "published" or not task.is_visible:
            return SingleTurnSearchCaseValidationResult(
                valid=False,
                errors=[SingleTurnSearchCaseValidationIssue(field="task_id", message="task is not published")],
            )
        if task.task_status != TASK_STATUS_ANNOTATION_IN_PROGRESS:
            return SingleTurnSearchCaseValidationResult(
                valid=False,
                errors=[SingleTurnSearchCaseValidationIssue(field="task_id", message="task is not assigned for annotation")],
            )

        if task.annotation_assignee_id != normalized.annotator_id:
            return SingleTurnSearchCaseValidationResult(
                valid=False,
                errors=[SingleTurnSearchCaseValidationIssue(field="annotator_id", message="task belongs to another annotator")],
            )

        template = SingleTurnSearchCaseTaskPayload.model_validate(task.task_payload)
        errors = self._validate_submission_against_template(normalized, template)
        soft_checks = self._build_soft_checks(normalized, template)
        if errors:
            return SingleTurnSearchCaseValidationResult(valid=False, errors=errors, soft_checks=soft_checks)

        score_preview = self._build_score_summary(
            normalized.scoring_rules,
            normalized.model_a_evaluations,
            normalized.model_b_evaluations,
        )
        return SingleTurnSearchCaseValidationResult(
            valid=True,
            errors=[],
            soft_checks=soft_checks,
            score_preview=score_preview,
            normalized=normalized,
        )

    def save_submission(
        self,
        db: Session,
        project_id: int,
        payload: dict[str, Any],
    ) -> SingleTurnSearchCaseSavedSubmission:
        validation = self.validate_submission(db, project_id, payload)
        if not validation.valid or validation.normalized is None or validation.score_preview is None:
            raise ValueError("submission payload is invalid")

        normalized = validation.normalized
        task = self._get_task(db, project_id, normalized.task_id)
        if task is None:
            raise ValueError("task is not found")

        template = SingleTurnSearchCaseTaskPayload.model_validate(task.task_payload)
        record = SingleTurnSearchCaseRecord(
            project_id=project_id,
            task_id=normalized.task_id,
            annotator_id=normalized.annotator_id,
            domain=normalized.domain,
            scenario_description=normalized.scenario_description,
            prompt=normalized.prompt,
            timeliness_tag=normalized.timeliness_tag,
            model_a_name=normalized.model_a.model_name,
            model_a_response_text=normalized.model_a.response_text,
            model_a_share_link=normalized.model_a.share_link,
            model_a_screenshot=normalized.model_a.screenshot,
            model_b_name=normalized.model_b.model_name,
            model_b_response_text=normalized.model_b.response_text,
            model_b_share_link=normalized.model_b.share_link,
            model_b_screenshot=normalized.model_b.screenshot,
            reference_answer=normalized.reference_answer,
            scoring_rules=[self._serialize_rule(rule) for rule in normalized.scoring_rules],
            model_a_evaluations=[item.model_dump(mode="json") for item in normalized.model_a_evaluations],
            model_b_evaluations=[item.model_dump(mode="json") for item in normalized.model_b_evaluations],
            template_snapshot=template.model_dump(mode="json"),
            score_summary=validation.score_preview.model_dump(mode="json"),
            soft_checks=[item.model_dump(mode="json") for item in validation.soft_checks],
            rule_count=len(normalized.scoring_rules),
            penalty_rule_count=len([rule for rule in normalized.scoring_rules if rule.weight < 0]),
            positive_total_score=validation.score_preview.positive_total_score,
            model_a_raw_score=validation.score_preview.model_a_raw_score,
            model_a_percentage=validation.score_preview.model_a_percentage,
            model_b_raw_score=validation.score_preview.model_b_raw_score,
            model_b_percentage=validation.score_preview.model_b_percentage,
            score_gap=validation.score_preview.score_gap,
            status="submitted",
            plugin_code=self.plugin_code,
            plugin_version=self.plugin_version,
        )
        db.add(record)

        task.task_status = TASK_STATUS_PENDING_REVIEW_DISPATCH
        task.annotation_submitted_at = datetime.now(timezone.utc)
        db.add(task)
        prepare_review_round_for_submission(db, task)
        db.refresh(record)
        db.refresh(task)

        return SingleTurnSearchCaseSavedSubmission(
            submission_id=record.id,
            project_id=project_id,
            task_id=record.task_id,
            plugin_code=record.plugin_code,
            plugin_version=record.plugin_version,
            task_status=task.task_status,
            status=record.status,
            score_summary=validation.score_preview,
            submitted_at=record.submitted_at,
        )

    def list_submission_summaries(
        self,
        db: Session,
        project_id: int,
        *,
        limit: int = 50,
        task_id: str | None = None,
        annotator_id: int | None = None,
        require_published: bool = False,
    ) -> list[SingleTurnSearchCaseSubmissionSummary]:
        self.get_project_or_raise(db, project_id, require_published=require_published)
        statement = (
            select(SingleTurnSearchCaseRecord)
            .where(SingleTurnSearchCaseRecord.project_id == project_id)
            .order_by(SingleTurnSearchCaseRecord.submitted_at.desc(), SingleTurnSearchCaseRecord.id.desc())
        )
        if task_id:
            statement = statement.where(SingleTurnSearchCaseRecord.task_id == task_id)
        if annotator_id is not None:
            statement = statement.where(SingleTurnSearchCaseRecord.annotator_id == annotator_id)
        statement = statement.limit(limit)
        items = list(db.scalars(statement).all())
        return [self._build_summary(item) for item in items]

    def get_submission_detail(
        self,
        db: Session,
        project_id: int,
        submission_id: int,
        *,
        require_published: bool = False,
    ) -> SingleTurnSearchCaseSubmissionDetail | None:
        self.get_project_or_raise(db, project_id, require_published=require_published)
        record = db.scalar(
            select(SingleTurnSearchCaseRecord).where(
                SingleTurnSearchCaseRecord.project_id == project_id,
                SingleTurnSearchCaseRecord.id == submission_id,
            )
        )
        if record is None:
            return None
        return self._build_detail(
            record,
            latest_review=self._get_latest_review_feedback(db, project_id, record.task_id),
        )

    def get_task_submission_detail(
        self,
        db: Session,
        project_id: int,
        task_id: str,
        *,
        annotator_id: int,
    ) -> SingleTurnSearchCaseSubmissionDetail | None:
        items = self.list_submission_summaries(
            db,
            project_id,
            limit=1,
            task_id=task_id,
            annotator_id=annotator_id,
            require_published=False,
        )
        if not items:
            return None
        return self.get_submission_detail(
            db,
            project_id,
            items[0].submission_id,
            require_published=False,
        )

    def get_my_submission_detail(
        self,
        db: Session,
        project_id: int,
        submission_id: int,
        *,
        annotator_id: int,
    ) -> SingleTurnSearchCaseSubmissionDetail | None:
        self.get_project_or_raise(db, project_id, require_published=False)
        record = db.scalar(
            select(SingleTurnSearchCaseRecord).where(
                SingleTurnSearchCaseRecord.project_id == project_id,
                SingleTurnSearchCaseRecord.id == submission_id,
                SingleTurnSearchCaseRecord.annotator_id == annotator_id,
            )
        )
        if record is None:
            return None
        return self._build_detail(
            record,
            latest_review=self._get_latest_review_feedback(db, project_id, record.task_id),
        )

    def delete_task_records(self, db: Session, project_id: int, task_id: str) -> None:
        self.get_project_or_raise(db, project_id, require_published=False)
        rows = db.scalars(
            select(SingleTurnSearchCaseRecord).where(
                SingleTurnSearchCaseRecord.project_id == project_id,
                SingleTurnSearchCaseRecord.task_id == task_id,
            )
        ).all()
        for row in rows:
            db.delete(row)
        db.flush()

    def _validate_submission_against_template(
        self,
        submission: SingleTurnSearchCaseSubmission,
        template: SingleTurnSearchCaseTaskPayload,
    ) -> list[SingleTurnSearchCaseValidationIssue]:
        issues: list[SingleTurnSearchCaseValidationIssue] = []
        if submission.domain not in template.domain_options:
            issues.append(SingleTurnSearchCaseValidationIssue(field="domain", message="domain is invalid"))
        if submission.timeliness_tag not in template.timeliness_options:
            issues.append(SingleTurnSearchCaseValidationIssue(field="timeliness_tag", message="timeliness_tag is invalid"))

        if template.require_share_link:
            if not submission.model_a.share_link.strip():
                issues.append(SingleTurnSearchCaseValidationIssue(field="model_a.share_link", message="share_link is required"))
            if not submission.model_b.share_link.strip():
                issues.append(SingleTurnSearchCaseValidationIssue(field="model_b.share_link", message="share_link is required"))
        if template.require_model_screenshot:
            if not submission.model_a.screenshot.strip():
                issues.append(SingleTurnSearchCaseValidationIssue(field="model_a.screenshot", message="screenshot is required"))
            if not submission.model_b.screenshot.strip():
                issues.append(SingleTurnSearchCaseValidationIssue(field="model_b.screenshot", message="screenshot is required"))

        rule_count = len(submission.scoring_rules)
        if rule_count < template.scoring_rules_min or rule_count > template.scoring_rules_max:
            issues.append(
                SingleTurnSearchCaseValidationIssue(
                    field="scoring_rules",
                    message="rule count is out of configured range",
                )
            )

        penalty_rule_count = len([rule for rule in submission.scoring_rules if rule.weight < 0])
        if penalty_rule_count < template.min_penalty_rules:
            issues.append(
                SingleTurnSearchCaseValidationIssue(
                    field="scoring_rules",
                    message="penalty rule count is below minimum",
                )
            )

        positive_rule_count = len([rule for rule in submission.scoring_rules if rule.weight > 0])
        if positive_rule_count == 0:
            issues.append(
                SingleTurnSearchCaseValidationIssue(
                    field="scoring_rules",
                    message="at least one positive rule is required",
                )
            )

        expected_indexes = set(range(rule_count))
        issues.extend(self._validate_evaluations("model_a_evaluations", submission.model_a_evaluations, expected_indexes))
        issues.extend(self._validate_evaluations("model_b_evaluations", submission.model_b_evaluations, expected_indexes))
        return issues

    def _validate_evaluations(
        self,
        field_name: str,
        evaluations: list[SearchCaseRuleEvaluation],
        expected_indexes: set[int],
    ) -> list[SingleTurnSearchCaseValidationIssue]:
        issues: list[SingleTurnSearchCaseValidationIssue] = []
        indexes = {item.rule_index for item in evaluations}
        if indexes != expected_indexes:
            issues.append(
                SingleTurnSearchCaseValidationIssue(
                    field=field_name,
                    message="every rule must include one evaluation result",
                )
            )
        return issues

    def _build_soft_checks(
        self,
        submission: SingleTurnSearchCaseSubmission,
        template: SingleTurnSearchCaseTaskPayload,
    ) -> list[SearchCaseSoftCheck]:
        checks: list[SearchCaseSoftCheck] = []
        prompt_lower = submission.prompt.lower()
        if len(submission.scenario_description) < 30:
            checks.append(SearchCaseSoftCheck(code="scenario_short", level="warning", message="场景说明偏短，可能不足以证明题目真实。"))
        if len(submission.prompt) < 12:
            checks.append(SearchCaseSoftCheck(code="prompt_short", level="warning", message="Prompt 偏短，建议更口语化并补充真实搜索语境。"))
        if "?" not in submission.prompt and "？" not in submission.prompt:
            checks.append(SearchCaseSoftCheck(code="prompt_not_question_like", level="info", message="Prompt 看起来不够像自然搜索提问。"))
        if any(token in prompt_lower for token in ["prove", "derive", "algorithmic complexity", "tensor"]):
            checks.append(SearchCaseSoftCheck(code="too_professional", level="warning", message="Prompt 可能偏专业，建议更接近日常搜索场景。"))
        if submission.timeliness_tag != "弱时效":
            checks.append(SearchCaseSoftCheck(code="timeliness_high", level="info", message="当前不是弱时效标签，注意确认题目是否稳定且可复查。"))
        if not any(rule.evidence_source_type == "web_link" for rule in submission.scoring_rules):
            checks.append(SearchCaseSoftCheck(code="missing_web_evidence", level="warning", message="评分规则里没有网页文本信源，请确认是否具备可核验依据。"))
        if len(submission.reference_answer) < 120:
            checks.append(SearchCaseSoftCheck(code="reference_answer_brief", level="warning", message="参考答案偏短，建议补充完整性和可读性。"))
        if any(any(token in rule.rule_text.lower() for token in [" and ", " or "]) for rule in submission.scoring_rules):
            checks.append(SearchCaseSoftCheck(code="rule_atomicity", level="info", message="部分评分规则可能包含多个判断点，建议继续拆分。"))
        if len(submission.scoring_rules) < max(template.scoring_rules_min + 1, 7):
            checks.append(SearchCaseSoftCheck(code="rule_coverage", level="info", message="评分规则条数偏少，建议检查覆盖是否完整。"))
        return checks

    def _build_score_summary(
        self,
        rules: list[SearchCaseRuleInput],
        model_a_evaluations: list[SearchCaseRuleEvaluation],
        model_b_evaluations: list[SearchCaseRuleEvaluation],
    ) -> SearchCaseScoreSummary:
        positive_total = sum(rule.weight for rule in rules if rule.weight > 0)
        model_a_map = {item.rule_index: item.hit for item in model_a_evaluations}
        model_b_map = {item.rule_index: item.hit for item in model_b_evaluations}

        model_a_raw = max(sum(rule.weight for index, rule in enumerate(rules) if model_a_map.get(index)), 0)
        model_b_raw = max(sum(rule.weight for index, rule in enumerate(rules) if model_b_map.get(index)), 0)
        model_a_percentage = round((model_a_raw / positive_total) * 100, 2) if positive_total > 0 else 0.0
        model_b_percentage = round((model_b_raw / positive_total) * 100, 2) if positive_total > 0 else 0.0
        score_gap = round(abs(model_a_percentage - model_b_percentage), 2)
        return SearchCaseScoreSummary(
            positive_total_score=positive_total,
            model_a_raw_score=model_a_raw,
            model_a_percentage=model_a_percentage,
            model_b_raw_score=model_b_raw,
            model_b_percentage=model_b_percentage,
            score_gap=score_gap,
            model_a_below_target=model_a_percentage < 50,
            score_gap_exceeds_target=score_gap > 15,
        )

    def _convert_validation_errors(self, exc: ValidationError) -> list[SingleTurnSearchCaseValidationIssue]:
        issues: list[SingleTurnSearchCaseValidationIssue] = []
        for item in exc.errors():
            field = ".".join(str(part) for part in item.get("loc", []))
            issues.append(
                SingleTurnSearchCaseValidationIssue(
                    field=field or "payload",
                    message=item.get("msg", "Invalid value"),
                )
            )
        return issues

    def _serialize_rule(self, rule: SearchCaseRuleInput) -> dict[str, Any]:
        payload = rule.model_dump(mode="json")
        payload["sign"] = rule.sign
        return payload

    def _get_task(self, db: Session, project_id: int, task_id: str) -> ProjectTask | None:
        return db.scalar(
            select(ProjectTask).where(
                ProjectTask.project_id == project_id,
                ProjectTask.plugin_code == self.plugin_code,
                ProjectTask.external_task_id == task_id,
            )
        )

    def _build_task_read(self, task: ProjectTask) -> SingleTurnSearchCaseTaskRead:
        normalized_payload = SingleTurnSearchCaseTaskPayload.model_validate(task.task_payload)
        return SingleTurnSearchCaseTaskRead(
            project_id=task.project_id,
            task_id=task.external_task_id,
            status=task.task_status,
            **normalized_payload.model_dump(mode="json"),
        )

    def _build_ai_review_precheck(self, snapshot: SingleTurnSearchCaseAiReviewRequest) -> SearchCaseAiReviewPrecheck:
        missing_fields: list[SearchCaseAiReviewMissingField] = []

        def add_missing(field: str, label: str, message: str) -> None:
            missing_fields.append(
                SearchCaseAiReviewMissingField(
                    field=field,
                    label=label,
                    message=message,
                )
            )

        if not snapshot.domain:
            add_missing("domain", "题目领域", "请先补全当前规则所需内容后再进行模型校验")
        if not snapshot.timeliness_tag:
            add_missing("timeliness_tag", "时效性标签", "请先补全当前规则所需内容后再进行模型校验")
        if not snapshot.scenario_description:
            add_missing("scenario_description", "场景说明", "请先补全当前规则所需内容后再进行模型校验")
        if not snapshot.prompt:
            add_missing("prompt", "Prompt", "请先补全当前规则所需内容后再进行模型校验")
        if not snapshot.model_a.response_text:
            add_missing("model_a.response_text", "模型1回答全文", "请先补全当前规则所需内容后再进行模型校验")
        if not snapshot.model_b.response_text:
            add_missing("model_b.response_text", "模型2回答全文", "请先补全当前规则所需内容后再进行模型校验")

        rule = snapshot.rule
        if not rule.rule_category:
            add_missing(f"rules.{rule.rule_index}.rule_category", "规则分类", "请先补全当前规则所需内容后再进行模型校验")
        if rule.weight is None:
            add_missing(f"rules.{rule.rule_index}.weight", "权重", "请先补全当前规则所需内容后再进行模型校验")
        if not rule.evidence_source_type:
            add_missing(
                f"rules.{rule.rule_index}.evidence_source_type",
                "证据来源",
                "请先补全当前规则所需内容后再进行模型校验",
            )
        if not rule.rule_text:
            add_missing(f"rules.{rule.rule_index}.rule_text", "规则内容", "请先补全当前规则所需内容后再进行模型校验")

        if rule.evidence_source_type == "web_link":
            if not rule.reference_url:
                add_missing(f"rules.{rule.rule_index}.reference_url", "参考链接", "网页链接规则必须填写参考链接")
            if not rule.quote_text:
                add_missing(f"rules.{rule.rule_index}.quote_text", "引用说明", "网页链接规则必须填写引用说明")
            if not rule.evidence_screenshot:
                add_missing(
                    f"rules.{rule.rule_index}.evidence_screenshot",
                    "证据截图",
                    "网页链接规则必须上传证据截图",
                )
        elif rule.evidence_source_type in {"prompt_requirement", "project_document"}:
            if not rule.quote_text and not rule.optional_note:
                add_missing(
                    f"rules.{rule.rule_index}.quote_text",
                    "引用说明/补充说明",
                    "请至少填写引用说明或补充说明，以说明当前规则依据",
                )
        elif rule.evidence_source_type == "none":
            if not rule.quote_text and not rule.optional_note:
                add_missing(
                    f"rules.{rule.rule_index}.quote_text",
                    "引用说明/补充说明",
                    "证据来源为无时，请补充说明为什么该规则成立",
                )

        if rule.model_a_human_hit is None:
            add_missing(
                f"rules.{rule.rule_index}.model_a_hit",
                "模型1人工判定",
                "请先补全当前规则所需内容后再进行模型校验",
            )
        if not rule.model_a_human_note:
            add_missing(
                f"rules.{rule.rule_index}.model_a_note",
                "模型1人工备注",
                "请先补全当前规则所需内容后再进行模型校验",
            )
        if rule.model_b_human_hit is None:
            add_missing(
                f"rules.{rule.rule_index}.model_b_hit",
                "模型2人工判定",
                "请先补全当前规则所需内容后再进行模型校验",
            )
        if not rule.model_b_human_note:
            add_missing(
                f"rules.{rule.rule_index}.model_b_note",
                "模型2人工备注",
                "请先补全当前规则所需内容后再进行模型校验",
            )

        return SearchCaseAiReviewPrecheck(
            passed=len(missing_fields) == 0,
            missing_fields=missing_fields,
        )

    def _build_rule_definition_precheck(
        self,
        snapshot: SingleTurnSearchCaseAiReviewRequest,
    ) -> SearchCaseAiReviewPrecheck:
        missing_fields: list[SearchCaseAiReviewMissingField] = []
        self._append_ai_review_context_missing_fields(snapshot, missing_fields)
        self._append_ai_review_rule_missing_fields(snapshot.rule, missing_fields)
        return SearchCaseAiReviewPrecheck(
            passed=len(missing_fields) == 0,
            missing_fields=missing_fields,
        )

    def _build_model_review_precheck(
        self,
        snapshot: SingleTurnSearchCaseAiReviewRequest,
        target_model: Literal["model_a", "model_b"],
    ) -> SearchCaseAiReviewPrecheck:
        missing_fields: list[SearchCaseAiReviewMissingField] = []
        self._append_ai_review_context_missing_fields(snapshot, missing_fields)
        self._append_ai_review_rule_missing_fields(snapshot.rule, missing_fields)
        self._append_ai_review_model_missing_fields(snapshot, missing_fields, target_model)
        return SearchCaseAiReviewPrecheck(
            passed=len(missing_fields) == 0,
            missing_fields=missing_fields,
        )

    def _append_ai_review_context_missing_fields(
        self,
        snapshot: SingleTurnSearchCaseAiReviewRequest,
        missing_fields: list[SearchCaseAiReviewMissingField],
    ) -> None:
        if not snapshot.domain:
            self._append_ai_review_missing_field(missing_fields, "domain", "题目领域")
        if not snapshot.timeliness_tag:
            self._append_ai_review_missing_field(missing_fields, "timeliness_tag", "时效性标签")
        if not snapshot.scenario_description:
            self._append_ai_review_missing_field(missing_fields, "scenario_description", "场景说明")
        if not snapshot.prompt:
            self._append_ai_review_missing_field(missing_fields, "prompt", "Prompt")

    def _append_ai_review_rule_missing_fields(
        self,
        rule: Any,
        missing_fields: list[SearchCaseAiReviewMissingField],
    ) -> None:
        if not rule.rule_category:
            self._append_ai_review_missing_field(missing_fields, f"rules.{rule.rule_index}.rule_category", "规则分类")
        if rule.weight is None:
            self._append_ai_review_missing_field(missing_fields, f"rules.{rule.rule_index}.weight", "权重")
        if not rule.evidence_source_type:
            self._append_ai_review_missing_field(
                missing_fields,
                f"rules.{rule.rule_index}.evidence_source_type",
                "证据来源",
            )
        if not rule.rule_text:
            self._append_ai_review_missing_field(missing_fields, f"rules.{rule.rule_index}.rule_text", "规则内容")

        if rule.evidence_source_type == "web_link":
            if not rule.reference_url:
                self._append_ai_review_missing_field(
                    missing_fields,
                    f"rules.{rule.rule_index}.reference_url",
                    "参考链接",
                    "网页链接规则必须填写参考链接",
                )
            if not rule.quote_text:
                self._append_ai_review_missing_field(
                    missing_fields,
                    f"rules.{rule.rule_index}.quote_text",
                    "引用说明",
                    "网页链接规则必须填写引用说明",
                )
            if not rule.evidence_screenshot:
                self._append_ai_review_missing_field(
                    missing_fields,
                    f"rules.{rule.rule_index}.evidence_screenshot",
                    "证据截图",
                    "网页链接规则必须上传证据截图",
                )
        elif rule.evidence_source_type in {"prompt_requirement", "project_document"}:
            if not rule.quote_text and not rule.optional_note:
                self._append_ai_review_missing_field(
                    missing_fields,
                    f"rules.{rule.rule_index}.quote_text",
                    "引用说明/补充说明",
                    "请至少填写引用说明或补充说明，以说明当前规则依据",
                )
        elif rule.evidence_source_type == "none":
            if not rule.quote_text and not rule.optional_note:
                self._append_ai_review_missing_field(
                    missing_fields,
                    f"rules.{rule.rule_index}.quote_text",
                    "引用说明/补充说明",
                    "证据来源为无时，请补充说明为什么该规则成立",
                )

    def _append_ai_review_model_missing_fields(
        self,
        snapshot: SingleTurnSearchCaseAiReviewRequest,
        missing_fields: list[SearchCaseAiReviewMissingField],
        target_model: Literal["model_a", "model_b"],
    ) -> None:
        rule = snapshot.rule
        model_label = "模型1" if target_model == "model_a" else "模型2"
        response_field = "model_a.response_text" if target_model == "model_a" else "model_b.response_text"
        hit_field = f"rules.{rule.rule_index}.model_a_hit" if target_model == "model_a" else f"rules.{rule.rule_index}.model_b_hit"
        note_field = f"rules.{rule.rule_index}.model_a_note" if target_model == "model_a" else f"rules.{rule.rule_index}.model_b_note"
        response_text = snapshot.model_a.response_text if target_model == "model_a" else snapshot.model_b.response_text
        human_hit = rule.model_a_human_hit if target_model == "model_a" else rule.model_b_human_hit
        human_note = rule.model_a_human_note if target_model == "model_a" else rule.model_b_human_note

        if not response_text:
            self._append_ai_review_missing_field(missing_fields, response_field, f"{model_label}回答全文")
        if human_hit is None:
            self._append_ai_review_missing_field(missing_fields, hit_field, f"{model_label}人工判定")
        if not human_note:
            self._append_ai_review_missing_field(missing_fields, note_field, f"{model_label}人工备注")

    def _append_ai_review_missing_field(
        self,
        missing_fields: list[SearchCaseAiReviewMissingField],
        field: str,
        label: str,
        message: str = "请先补全当前规则所需内容后再进行模型校验",
    ) -> None:
        missing_fields.append(
            SearchCaseAiReviewMissingField(
                field=field,
                label=label,
                message=message,
            )
        )

    def _build_ai_review_prompt(self, snapshot: SingleTurnSearchCaseAiReviewRequest) -> str:
        review_payload = {
            "task_context": {
                "domain": snapshot.domain,
                "timeliness_tag": snapshot.timeliness_tag,
                "scenario_description": snapshot.scenario_description,
                "prompt": snapshot.prompt,
            },
            "rule": {
                "rule_index": snapshot.rule.rule_index,
                "rule_category": snapshot.rule.rule_category,
                "rule_text": snapshot.rule.rule_text,
                "weight": snapshot.rule.weight,
                "evidence_source_type": snapshot.rule.evidence_source_type,
                "reference_url": snapshot.rule.reference_url,
                "quote_text": snapshot.rule.quote_text,
                "evidence_screenshot": snapshot.rule.evidence_screenshot,
                "optional_note": snapshot.rule.optional_note,
            },
            "model_1": {
                "model_name": snapshot.model_a.model_name,
                "response_text": snapshot.model_a.response_text,
                "human_judgement": "yes" if snapshot.rule.model_a_human_hit else "no",
                "human_note": snapshot.rule.model_a_human_note,
            },
            "model_2": {
                "model_name": snapshot.model_b.model_name,
                "response_text": snapshot.model_b.response_text,
                "human_judgement": "yes" if snapshot.rule.model_b_human_hit else "no",
                "human_note": snapshot.rule.model_b_human_note,
            },
        }
        json_schema = {
            "ok": True,
            "precheck": {"passed": True, "missing_fields": []},
            "review_result": {"overall_status": "pass|risk|fail", "summary": "string"},
            "rule_review": {
                "status": "pass|risk|fail",
                "issues": ["string"],
                "checks": {
                    "prompt_alignment": {"passed": True, "detail": "string"},
                    "clarity": {"passed": True, "detail": "string"},
                    "objectivity": {"passed": True, "detail": "string"},
                    "atomicity": {"passed": True, "detail": "string"},
                    "evidence_consistency": {"passed": True, "detail": "string"},
                },
                "reference_advice": "string",
                "extra_suggestions": ["string"],
            },
            "model_1_review": {
                "ai_judgement": "yes|no|uncertain",
                "human_judgement": "yes|no",
                "consistency": "consistent|inconsistent|debatable",
                "remark_quality": "good|weak|insufficient",
                "reason": "string",
                "reference_advice": "string",
                "extra_suggestions": ["string"],
            },
            "model_2_review": {
                "ai_judgement": "yes|no|uncertain",
                "human_judgement": "yes|no",
                "consistency": "consistent|inconsistent|debatable",
                "remark_quality": "good|weak|insufficient",
                "reason": "string",
                "reference_advice": "string",
                "extra_suggestions": ["string"],
            },
        }
        return (
            "You are an AI reviewer for a single-turn daily search boundary evaluation task.\n"
            "You are NOT allowed to rewrite, overwrite, replace, or auto-fill the user's original content.\n"
            "You are only reviewing the already filled content and producing reference advice.\n"
            "First review the rule itself: prompt alignment, clarity, objectivity, atomicity, evidence consistency, and weight reasonableness.\n"
            "Then review model 1 and model 2 separately: your own judgement, whether it is consistent with the human judgement, whether the human note is specific enough, and what extra reference advice can be provided.\n"
            "If information is insufficient, say so explicitly. Do not fabricate evidence.\n"
            "Return JSON only. Do not wrap it in markdown.\n"
            f"Required JSON structure:\n{json.dumps(json_schema, ensure_ascii=False, indent=2)}\n"
            f"Current filled snapshot:\n{json.dumps(review_payload, ensure_ascii=False, indent=2)}"
        )

    def _build_rule_definition_review_prompt(self, snapshot: SingleTurnSearchCaseAiReviewRequest) -> str:
        review_payload = {
            "task_context": {
                "domain": snapshot.domain,
                "timeliness_tag": snapshot.timeliness_tag,
                "scenario_description": snapshot.scenario_description,
                "prompt": snapshot.prompt,
            },
            "rule": {
                "rule_index": snapshot.rule.rule_index,
                "rule_category": snapshot.rule.rule_category,
                "rule_text": snapshot.rule.rule_text,
                "weight": snapshot.rule.weight,
                "evidence_source_type": snapshot.rule.evidence_source_type,
                "reference_url": snapshot.rule.reference_url,
                "quote_text": snapshot.rule.quote_text,
                "evidence_screenshot": snapshot.rule.evidence_screenshot,
                "optional_note": snapshot.rule.optional_note,
            },
        }
        json_schema = {
            "ok": True,
            "precheck": {"passed": True, "missing_fields": []},
            "result": {
                "status": "pass|risk|fail",
                "issues": ["string"],
                "checks": {
                    "prompt_alignment": {"passed": True, "detail": "string"},
                    "clarity": {"passed": True, "detail": "string"},
                    "objectivity": {"passed": True, "detail": "string"},
                    "atomicity": {"passed": True, "detail": "string"},
                    "evidence_consistency": {"passed": True, "detail": "string"},
                },
                "reference_advice": "string",
                "extra_suggestions": ["string"],
            },
        }
        return (
            "You are an AI reviewer for a single-turn daily search boundary evaluation task.\n"
            "You are NOT allowed to rewrite, overwrite, replace, or auto-fill the user's original content.\n"
            "You are only reviewing the already filled rule definition and producing reference advice.\n"
            "Review this one rule for prompt alignment, clarity, objectivity, atomicity, evidence consistency, and weight reasonableness.\n"
            "Do not review model judgements in this step. Do not fabricate evidence.\n"
            "Return JSON only. Do not wrap it in markdown.\n"
            f"Required JSON structure:\n{json.dumps(json_schema, ensure_ascii=False, indent=2)}\n"
            f"Current filled snapshot:\n{json.dumps(review_payload, ensure_ascii=False, indent=2)}"
        )

    def _build_model_review_prompt(
        self,
        snapshot: SingleTurnSearchCaseAiReviewRequest,
        target_model: Literal["model_a", "model_b"],
    ) -> str:
        model_name = snapshot.model_a.model_name if target_model == "model_a" else snapshot.model_b.model_name
        response_text = snapshot.model_a.response_text if target_model == "model_a" else snapshot.model_b.response_text
        human_hit = snapshot.rule.model_a_human_hit if target_model == "model_a" else snapshot.rule.model_b_human_hit
        human_note = snapshot.rule.model_a_human_note if target_model == "model_a" else snapshot.rule.model_b_human_note
        review_payload = {
            "task_context": {
                "domain": snapshot.domain,
                "timeliness_tag": snapshot.timeliness_tag,
                "scenario_description": snapshot.scenario_description,
                "prompt": snapshot.prompt,
            },
            "rule": {
                "rule_index": snapshot.rule.rule_index,
                "rule_category": snapshot.rule.rule_category,
                "rule_text": snapshot.rule.rule_text,
                "weight": snapshot.rule.weight,
                "evidence_source_type": snapshot.rule.evidence_source_type,
                "reference_url": snapshot.rule.reference_url,
                "quote_text": snapshot.rule.quote_text,
                "evidence_screenshot": snapshot.rule.evidence_screenshot,
                "optional_note": snapshot.rule.optional_note,
            },
            "model_review": {
                "target_model": target_model,
                "model_name": model_name,
                "response_text": response_text,
                "human_judgement": "yes" if human_hit else "no",
                "human_note": human_note,
            },
        }
        json_schema = {
            "ok": True,
            "precheck": {"passed": True, "missing_fields": []},
            "result": {
                "ai_judgement": "yes|no|uncertain",
                "human_judgement": "yes|no",
                "consistency": "consistent|inconsistent|debatable",
                "remark_quality": "good|weak|insufficient",
                "reason": "string",
                "reference_advice": "string",
                "extra_suggestions": ["string"],
            },
        }
        return (
            "You are an AI reviewer for a single-turn daily search boundary evaluation task.\n"
            "You are NOT allowed to rewrite, overwrite, replace, or auto-fill the user's original content.\n"
            "You are only reviewing whether the already filled human judgement and note for one model are reasonable.\n"
            "Review the target model against the current rule, compare your judgement with the human judgement, evaluate whether the human note is specific enough, and provide reference advice.\n"
            "Do not fabricate evidence. If information is insufficient, say so explicitly.\n"
            "Return JSON only. Do not wrap it in markdown.\n"
            f"Required JSON structure:\n{json.dumps(json_schema, ensure_ascii=False, indent=2)}\n"
            f"Current filled snapshot:\n{json.dumps(review_payload, ensure_ascii=False, indent=2)}"
        )

    def _build_mock_ai_review(
        self,
        snapshot: SingleTurnSearchCaseAiReviewRequest,
        precheck: SearchCaseAiReviewPrecheck,
        provider: str,
    ) -> SingleTurnSearchCaseAiReviewResponse:
        rule_issues: list[str] = []
        if snapshot.rule.rule_text and any(token in snapshot.rule.rule_text.lower() for token in [" and ", " or "]):
            rule_issues.append("non_atomic")
        if snapshot.rule.weight is not None and abs(snapshot.rule.weight) >= 15:
            rule_issues.append("weight_suspicious")

        model_1_ai = "yes" if snapshot.rule.model_a_human_hit else "no"
        model_2_ai = "yes" if snapshot.rule.model_b_human_hit else "no"
        return SingleTurnSearchCaseAiReviewResponse(
            ok=True,
            precheck=precheck,
            provider=provider,
            review_result=SearchCaseAiReviewSummary(
                overall_status="risk" if rule_issues else "pass",
                summary="AI 已根据当前已填写内容完成复核，当前结果仅作为参考，不会覆盖人工内容。",
            ),
            rule_review=SearchCaseAiRuleReviewResult(
                status="risk" if rule_issues else "pass",
                issues=rule_issues,
                checks={
                    "prompt_alignment": SearchCaseAiReviewCheckItem(
                        passed=True,
                        detail="当前规则与 Prompt 核心目标存在明显关联。",
                    ),
                    "clarity": SearchCaseAiReviewCheckItem(
                        passed=bool(snapshot.rule.rule_text and len(snapshot.rule.rule_text) >= 8),
                        detail="规则表述已具备基本可读性，可继续补充更明确的命中标准。",
                    ),
                    "objectivity": SearchCaseAiReviewCheckItem(
                        passed=True,
                        detail="当前规则可以转化为具体判断标准，但建议结合备注补充命中依据。",
                    ),
                    "atomicity": SearchCaseAiReviewCheckItem(
                        passed="non_atomic" not in rule_issues,
                        detail="如一条规则中包含多个判断点，建议继续拆分。",
                    ),
                    "evidence_consistency": SearchCaseAiReviewCheckItem(
                        passed=True,
                        detail="当前证据来源与规则说明基本一致。",
                    ),
                },
                reference_advice="该规则可以继续保留，但建议在备注中引用更具体的回答片段或依据描述。",
                extra_suggestions=[
                    "可在备注中直接引用模型回答中的关键句。",
                    "若当前规则为扣分项，建议在规则内容里写清触发条件。",
                ],
            ),
            model_1_review=SearchCaseAiModelReviewResult(
                ai_judgement=model_1_ai,
                human_judgement="yes" if snapshot.rule.model_a_human_hit else "no",
                consistency="consistent",
                remark_quality="good" if snapshot.rule.model_a_human_note and len(snapshot.rule.model_a_human_note) >= 20 else "weak",
                reason="AI 基于当前规则和模型1回答做出的判断与人工结果一致。",
                reference_advice="建议在备注中补充更明确的命中证据，便于后续复核。",
                extra_suggestions=["可以补充一句更具体的命中或未命中原因。"],
            ),
            model_2_review=SearchCaseAiModelReviewResult(
                ai_judgement=model_2_ai,
                human_judgement="yes" if snapshot.rule.model_b_human_hit else "no",
                consistency="consistent",
                remark_quality="good" if snapshot.rule.model_b_human_note and len(snapshot.rule.model_b_human_note) >= 20 else "weak",
                reason="AI 基于当前规则和模型2回答做出的判断与人工结果一致。",
                reference_advice="建议把人工备注里的判断依据写得更具体。",
                extra_suggestions=["可补充回答原文中的关键片段，提升可追溯性。"],
            ),
        )

    def _build_mock_rule_definition_review(
        self,
        snapshot: SingleTurnSearchCaseAiReviewRequest,
        precheck: SearchCaseAiReviewPrecheck,
        provider: str,
    ) -> SingleTurnSearchCaseAiRuleCheckResponse:
        rule_issues: list[str] = []
        if snapshot.rule.rule_text and any(token in snapshot.rule.rule_text.lower() for token in [" and ", " or "]):
            rule_issues.append("non_atomic")
        if snapshot.rule.weight is not None and abs(snapshot.rule.weight) >= 15:
            rule_issues.append("weight_suspicious")
        return SingleTurnSearchCaseAiRuleCheckResponse(
            ok=True,
            precheck=precheck,
            provider=provider,
            result=SearchCaseAiRuleReviewResult(
                status="risk" if rule_issues else "pass",
                issues=rule_issues,
                checks={
                    "prompt_alignment": SearchCaseAiReviewCheckItem(
                        passed=True,
                        detail="当前规则与 Prompt 核心目标存在明显关联。",
                    ),
                    "clarity": SearchCaseAiReviewCheckItem(
                        passed=bool(snapshot.rule.rule_text and len(snapshot.rule.rule_text) >= 8),
                        detail="规则表述具备基本可读性，可进一步明确命中标准。",
                    ),
                    "objectivity": SearchCaseAiReviewCheckItem(
                        passed=True,
                        detail="当前规则可转化为客观判断标准。",
                    ),
                    "atomicity": SearchCaseAiReviewCheckItem(
                        passed="non_atomic" not in rule_issues,
                        detail="如一条规则中包含多个判断点，建议继续拆分。",
                    ),
                    "evidence_consistency": SearchCaseAiReviewCheckItem(
                        passed=True,
                        detail="当前证据来源与规则说明基本一致。",
                    ),
                },
                reference_advice="该规则整体可用，建议进一步补充更明确的命中边界和证据说明。",
                extra_suggestions=[
                    "可以在规则内容里直接写清具体检查点。",
                    "如果是扣分项，建议补充更明确的触发条件。",
                ],
            ),
        )

    def _build_mock_model_review(
        self,
        snapshot: SingleTurnSearchCaseAiReviewRequest,
        precheck: SearchCaseAiReviewPrecheck,
        provider: str,
        target_model: Literal["model_a", "model_b"],
    ) -> SingleTurnSearchCaseAiModelCheckResponse:
        human_hit = snapshot.rule.model_a_human_hit if target_model == "model_a" else snapshot.rule.model_b_human_hit
        human_note = snapshot.rule.model_a_human_note if target_model == "model_a" else snapshot.rule.model_b_human_note
        return SingleTurnSearchCaseAiModelCheckResponse(
            ok=True,
            precheck=precheck,
            provider=provider,
            result=SearchCaseAiModelReviewResult(
                ai_judgement="yes" if human_hit else "no",
                human_judgement="yes" if human_hit else "no",
                consistency="consistent",
                remark_quality="good" if human_note and len(human_note) >= 20 else "weak",
                reason="AI 基于当前规则和模型回答做出的判断与人工结果一致。",
                reference_advice="建议在备注中直接引用模型回答中的关键原文，便于后续复核。",
                extra_suggestions=[
                    "可以补充一句更具体的命中或未命中原因。",
                ],
            ),
        )

    def _parse_ai_review_response(
        self,
        raw_content: str,
        precheck: SearchCaseAiReviewPrecheck,
        provider: str,
    ) -> SingleTurnSearchCaseAiReviewResponse:
        parsed = json.loads(self._extract_json_content(raw_content))
        result = SingleTurnSearchCaseAiReviewResponse.model_validate(parsed)
        result.precheck = precheck
        result.provider = provider
        return result

    def _parse_rule_definition_review_response(
        self,
        raw_content: str,
        precheck: SearchCaseAiReviewPrecheck,
        provider: str,
    ) -> SingleTurnSearchCaseAiRuleCheckResponse:
        parsed = json.loads(self._extract_json_content(raw_content))
        result = SingleTurnSearchCaseAiRuleCheckResponse.model_validate(parsed)
        result.precheck = precheck
        result.provider = provider
        return result

    def _parse_model_review_response(
        self,
        raw_content: str,
        precheck: SearchCaseAiReviewPrecheck,
        provider: str,
    ) -> SingleTurnSearchCaseAiModelCheckResponse:
        parsed = json.loads(self._extract_json_content(raw_content))
        result = SingleTurnSearchCaseAiModelCheckResponse.model_validate(parsed)
        result.precheck = precheck
        result.provider = provider
        return result

    def _extract_json_content(self, raw_content: str) -> str:
        content = raw_content.strip()
        if content.startswith("```"):
            content = content.strip("`")
            if content.startswith("json"):
                content = content[4:].strip()
        if not content.startswith("{"):
            start = content.find("{")
            end = content.rfind("}")
            if start >= 0 and end > start:
                content = content[start : end + 1]
        return content

    def _build_summary(self, record: SingleTurnSearchCaseRecord) -> SingleTurnSearchCaseSubmissionSummary:
        return SingleTurnSearchCaseSubmissionSummary(
            submission_id=record.id,
            project_id=record.project_id,
            task_id=record.task_id,
            annotator_id=record.annotator_id,
            domain=record.domain,
            prompt=record.prompt,
            timeliness_tag=record.timeliness_tag,
            rule_count=record.rule_count,
            penalty_rule_count=record.penalty_rule_count,
            model_a_raw_score=record.model_a_raw_score,
            model_a_percentage=record.model_a_percentage,
            model_b_raw_score=record.model_b_raw_score,
            model_b_percentage=record.model_b_percentage,
            score_gap=record.score_gap,
            status=record.status,
            submitted_at=record.submitted_at,
        )

    def _get_latest_review_feedback(
        self,
        db: Session,
        project_id: int,
        task_id: str,
    ) -> SingleTurnSearchCaseLatestReview | None:
        task = self._get_task(db, project_id, task_id)
        if task is None:
            return None

        review = db.scalar(
            select(ProjectTaskReview)
            .where(
                ProjectTaskReview.project_task_id == task.id,
                ProjectTaskReview.review_status == REVIEW_STATUS_SUBMITTED,
            )
            .order_by(ProjectTaskReview.review_round.desc(), ProjectTaskReview.id.desc())
        )
        if review is None:
            return None

        return SingleTurnSearchCaseLatestReview(
            review_id=review.id,
            review_round=review.review_round,
            review_result=review.review_result,
            review_comment=review.review_comment,
            review_annotations=list(review.review_annotations or []),
            submitted_at=review.submitted_at,
        )

    def _build_detail(
        self,
        record: SingleTurnSearchCaseRecord,
        *,
        latest_review: SingleTurnSearchCaseLatestReview | None = None,
    ) -> SingleTurnSearchCaseSubmissionDetail:
        return SingleTurnSearchCaseSubmissionDetail(
            **self._build_summary(record).model_dump(mode="json"),
            scenario_description=record.scenario_description,
            model_a=SearchCaseModelAnswer(
                model_name=record.model_a_name,
                response_text=record.model_a_response_text,
                share_link=record.model_a_share_link,
                screenshot=record.model_a_screenshot,
            ),
            model_b=SearchCaseModelAnswer(
                model_name=record.model_b_name,
                response_text=record.model_b_response_text,
                share_link=record.model_b_share_link,
                screenshot=record.model_b_screenshot,
            ),
            reference_answer=record.reference_answer,
            scoring_rules=[SearchCaseRuleInput.model_validate(item) for item in record.scoring_rules],
            model_a_evaluations=[SearchCaseRuleEvaluation.model_validate(item) for item in record.model_a_evaluations],
            model_b_evaluations=[SearchCaseRuleEvaluation.model_validate(item) for item in record.model_b_evaluations],
            score_summary=SearchCaseScoreSummary.model_validate(record.score_summary),
            soft_checks=[SearchCaseSoftCheck.model_validate(item) for item in (record.soft_checks or [])],
            template_snapshot=record.template_snapshot,
            plugin_code=record.plugin_code,
            plugin_version=record.plugin_version,
            latest_review=latest_review,
        )
