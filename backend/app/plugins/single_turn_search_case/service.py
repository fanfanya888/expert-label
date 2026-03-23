from __future__ import annotations

from typing import Any

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.project_task import ProjectTask
from app.models.single_turn_search_case_record import SingleTurnSearchCaseRecord
from app.plugins.single_turn_search_case.schemas import (
    DEFAULT_DOMAIN_OPTIONS,
    DEFAULT_TIMELINESS_OPTIONS,
    EVIDENCE_SOURCE_OPTIONS,
    SearchCaseModelAnswer,
    SearchCaseRuleEvaluation,
    SearchCaseRuleInput,
    SearchCaseScoreSummary,
    SearchCaseSoftCheck,
    SingleTurnSearchCaseProjectStats,
    SingleTurnSearchCaseSavedSubmission,
    SingleTurnSearchCaseSchema,
    SingleTurnSearchCaseSubmission,
    SingleTurnSearchCaseSubmissionDetail,
    SingleTurnSearchCaseSubmissionSummary,
    SingleTurnSearchCaseTaskPayload,
    SingleTurnSearchCaseTaskRead,
    SingleTurnSearchCaseValidationIssue,
    SingleTurnSearchCaseValidationResult,
)


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
                    ProjectTask.task_status == "completed",
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

    def get_current_task(self, db: Session, project_id: int) -> SingleTurnSearchCaseTaskRead | None:
        self.get_project_or_raise(db, project_id)
        task = db.scalar(
            select(ProjectTask)
            .where(
                ProjectTask.project_id == project_id,
                ProjectTask.plugin_code == self.plugin_code,
                ProjectTask.publish_status == "published",
                ProjectTask.is_visible.is_(True),
                ProjectTask.task_status == "pending",
            )
            .order_by(ProjectTask.published_at.asc().nullslast(), ProjectTask.id.asc())
        )
        if task is None:
            return None
        return self._build_task_read(task)

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
        if task.task_status == "completed":
            return SingleTurnSearchCaseValidationResult(
                valid=False,
                errors=[SingleTurnSearchCaseValidationIssue(field="task_id", message="task has already been completed")],
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

        task.task_status = "completed"
        db.add(task)
        db.commit()
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
        return self._build_detail(record)

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

    def _build_detail(self, record: SingleTurnSearchCaseRecord) -> SingleTurnSearchCaseSubmissionDetail:
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
        )
