from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

DEFAULT_DOMAIN_OPTIONS = [
    "本地生活",
    "旅游出行",
    "消费决策",
    "教育培训",
    "健康信息",
    "科技数码",
    "工作效率",
    "其他",
]

DEFAULT_TIMELINESS_OPTIONS = [
    "弱时效",
    "中时效",
    "强时效",
]

EVIDENCE_SOURCE_OPTIONS = [
    "web_link",
    "prompt_requirement",
    "project_document",
    "none",
]


class SingleTurnSearchCaseMetadata(BaseModel):
    key: str
    name: str
    version: str
    summary: str


class SingleTurnSearchCaseSchema(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    plugin_code: str
    plugin_version: str
    page_title: str
    sections: list[str]
    evidence_source_options: list[str]
    default_domain_options: list[str]
    default_timeliness_options: list[str]
    model_labels: list[str]


class SingleTurnSearchCaseProjectStats(BaseModel):
    project_id: int
    total_tasks: int
    completed_tasks: int
    pending_tasks: int


class SingleTurnSearchCaseTaskPayload(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    task_name: str = Field(min_length=1, max_length=100)
    task_description: str | None = None
    instruction_text: str | None = None
    require_model_screenshot: bool = True
    require_share_link: bool = True
    scoring_rules_min: int = 5
    scoring_rules_max: int = 20
    min_penalty_rules: int = 2
    timeliness_options: list[str] = Field(default_factory=lambda: list(DEFAULT_TIMELINESS_OPTIONS))
    domain_options: list[str] = Field(default_factory=lambda: list(DEFAULT_DOMAIN_OPTIONS))
    show_case_guidance: bool = True
    model_a_name: str = "模型一"
    model_b_name: str = "模型二"

    @field_validator("task_name", "model_a_name", "model_b_name")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("value is required")
        return stripped

    @field_validator("task_description", "instruction_text", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("scoring_rules_min", "scoring_rules_max")
    @classmethod
    def validate_rule_range(cls, value: int) -> int:
        if value < 5 or value > 20:
            raise ValueError("rule count must be between 5 and 20")
        return value

    @field_validator("min_penalty_rules")
    @classmethod
    def validate_penalty_minimum(cls, value: int) -> int:
        if value < 1 or value > 10:
            raise ValueError("min_penalty_rules is out of range")
        return value

    @field_validator("timeliness_options", "domain_options")
    @classmethod
    def validate_options(cls, value: list[str]) -> list[str]:
        normalized = [item.strip() for item in value if item and item.strip()]
        if not normalized:
            raise ValueError("options cannot be empty")
        return normalized

    @model_validator(mode="after")
    def validate_task_payload(self) -> "SingleTurnSearchCaseTaskPayload":
        if self.scoring_rules_min > self.scoring_rules_max:
            raise ValueError("scoring_rules_min cannot be greater than scoring_rules_max")
        if self.min_penalty_rules > self.scoring_rules_max:
            raise ValueError("min_penalty_rules cannot exceed scoring_rules_max")
        return self


class SingleTurnSearchCaseTaskRead(SingleTurnSearchCaseTaskPayload):
    project_id: int
    task_id: str
    status: str


class SearchCaseModelAnswer(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_name: str
    response_text: str
    share_link: str
    screenshot: str

    @field_validator("model_name", "response_text", "share_link", "screenshot")
    @classmethod
    def validate_required_answer_field(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("field is required")
        return stripped


class SearchCaseRuleInput(BaseModel):
    rule_category: str
    rule_text: str
    weight: int
    evidence_source_type: Literal["web_link", "prompt_requirement", "project_document", "none"]
    reference_url: str | None = None
    quote_text: str | None = None
    evidence_screenshot: str | None = None
    optional_note: str | None = None

    @field_validator("rule_category", "rule_text")
    @classmethod
    def validate_required_rule_field(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("field is required")
        return stripped

    @field_validator("reference_url", "quote_text", "evidence_screenshot", "optional_note", mode="before")
    @classmethod
    def normalize_optional_rule_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("weight")
    @classmethod
    def validate_weight(cls, value: int) -> int:
        if value == 0 or value < -20 or value > 20:
            raise ValueError("weight must be an integer between -20 and 20, and cannot be 0")
        return value

    @model_validator(mode="after")
    def validate_atomic_rule(self) -> "SearchCaseRuleInput":
        text = self.rule_text
        for token in [";", "；", "\n", "并且", "以及", " and ", " or "]:
            if token in text:
                raise ValueError("each rule must contain only one atomic evaluation point")
        return self

    @property
    def sign(self) -> str:
        return "positive" if self.weight > 0 else "negative"


class SearchCaseRuleEvaluation(BaseModel):
    rule_index: int
    hit: bool
    note: str

    @field_validator("note")
    @classmethod
    def validate_note(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("note is required")
        return stripped


class SearchCaseSoftCheck(BaseModel):
    code: str
    level: Literal["info", "warning"]
    message: str


class SearchCaseScoreSummary(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    positive_total_score: int
    model_a_raw_score: int
    model_a_percentage: float
    model_b_raw_score: int
    model_b_percentage: float
    score_gap: float
    model_a_below_target: bool
    score_gap_exceeds_target: bool


class SingleTurnSearchCaseSubmission(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    project_id: int
    task_id: str = Field(min_length=1, max_length=100)
    annotator_id: int | None = None
    domain: str
    scenario_description: str
    prompt: str
    timeliness_tag: str
    model_a: SearchCaseModelAnswer
    model_b: SearchCaseModelAnswer
    reference_answer: str
    scoring_rules: list[SearchCaseRuleInput]
    model_a_evaluations: list[SearchCaseRuleEvaluation]
    model_b_evaluations: list[SearchCaseRuleEvaluation]

    @field_validator("domain", "scenario_description", "prompt", "timeliness_tag", "reference_answer")
    @classmethod
    def validate_required_submission_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("field is required")
        return stripped


class SingleTurnSearchCaseValidationIssue(BaseModel):
    field: str
    message: str


class SingleTurnSearchCaseValidationResult(BaseModel):
    valid: bool
    errors: list[SingleTurnSearchCaseValidationIssue] = Field(default_factory=list)
    soft_checks: list[SearchCaseSoftCheck] = Field(default_factory=list)
    score_preview: SearchCaseScoreSummary | None = None
    normalized: SingleTurnSearchCaseSubmission | None = None


class SearchCaseAiReviewDraftModelAnswer(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_name: str | None = None
    response_text: str | None = None
    share_link: str | None = None
    screenshot: str | None = None


class SearchCaseAiReviewDraftRule(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    rule_index: int = Field(ge=0)
    rule_category: str | None = None
    rule_text: str | None = None
    weight: int | None = None
    evidence_source_type: str | None = None
    reference_url: str | None = None
    quote_text: str | None = None
    evidence_screenshot: str | None = None
    optional_note: str | None = None
    model_a_human_hit: bool | None = None
    model_a_human_note: str | None = None
    model_b_human_hit: bool | None = None
    model_b_human_note: str | None = None

    @field_validator(
        "rule_category",
        "rule_text",
        "reference_url",
        "quote_text",
        "evidence_screenshot",
        "optional_note",
        "model_a_human_note",
        "model_b_human_note",
        mode="before",
    )
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class SingleTurnSearchCaseAiReviewRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    project_id: int
    task_id: str | None = None
    domain: str | None = None
    scenario_description: str | None = None
    prompt: str | None = None
    timeliness_tag: str | None = None
    model_a: SearchCaseAiReviewDraftModelAnswer
    model_b: SearchCaseAiReviewDraftModelAnswer
    rule: SearchCaseAiReviewDraftRule

    @field_validator("task_id", "domain", "scenario_description", "prompt", "timeliness_tag", mode="before")
    @classmethod
    def normalize_root_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class SearchCaseAiReviewMissingField(BaseModel):
    field: str
    label: str
    message: str


class SearchCaseAiReviewPrecheck(BaseModel):
    passed: bool
    missing_fields: list[SearchCaseAiReviewMissingField] = Field(default_factory=list)


class SearchCaseAiReviewCheckItem(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    passed: bool
    detail: str


class SearchCaseAiRuleReviewResult(BaseModel):
    status: Literal["pass", "fail", "risk"]
    issues: list[str] = Field(default_factory=list)
    checks: dict[str, SearchCaseAiReviewCheckItem] = Field(default_factory=dict)
    reference_advice: str
    extra_suggestions: list[str] = Field(default_factory=list)


class SearchCaseAiModelReviewResult(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    ai_judgement: Literal["yes", "no", "uncertain"]
    human_judgement: Literal["yes", "no"]
    consistency: Literal["consistent", "inconsistent", "debatable"]
    remark_quality: Literal["good", "weak", "insufficient"]
    reason: str
    reference_advice: str
    extra_suggestions: list[str] = Field(default_factory=list)


class SearchCaseAiReviewSummary(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    overall_status: Literal["pass", "fail", "risk"]
    summary: str


class SingleTurnSearchCaseAiReviewResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    ok: bool
    precheck: SearchCaseAiReviewPrecheck
    review_result: SearchCaseAiReviewSummary | None = None
    rule_review: SearchCaseAiRuleReviewResult | None = None
    model_1_review: SearchCaseAiModelReviewResult | None = None
    model_2_review: SearchCaseAiModelReviewResult | None = None
    provider: str | None = None
    error_message: str | None = None


class SingleTurnSearchCaseAiRuleCheckResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    ok: bool
    precheck: SearchCaseAiReviewPrecheck
    result: SearchCaseAiRuleReviewResult | None = None
    provider: str | None = None
    error_message: str | None = None


class SingleTurnSearchCaseAiModelCheckResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    ok: bool
    precheck: SearchCaseAiReviewPrecheck
    result: SearchCaseAiModelReviewResult | None = None
    provider: str | None = None
    error_message: str | None = None


class SingleTurnSearchCaseSavedSubmission(BaseModel):
    submission_id: int
    project_id: int
    task_id: str
    plugin_code: str
    plugin_version: str
    task_status: str
    status: str
    score_summary: SearchCaseScoreSummary
    submitted_at: datetime


class SingleTurnSearchCaseLatestReview(BaseModel):
    review_id: int
    review_round: int
    review_result: str | None = None
    review_comment: str | None = None
    review_annotations: list[dict[str, str]] = Field(default_factory=list)
    submitted_at: datetime | None = None


class SingleTurnSearchCaseSubmissionSummary(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    submission_id: int
    project_id: int | None
    task_id: str
    annotator_id: int | None
    domain: str
    prompt: str
    timeliness_tag: str
    rule_count: int
    penalty_rule_count: int
    model_a_raw_score: int
    model_a_percentage: float
    model_b_raw_score: int
    model_b_percentage: float
    score_gap: float
    status: str
    submitted_at: datetime


class SingleTurnSearchCaseSubmissionDetail(SingleTurnSearchCaseSubmissionSummary):
    scenario_description: str
    model_a: SearchCaseModelAnswer
    model_b: SearchCaseModelAnswer
    reference_answer: str
    scoring_rules: list[SearchCaseRuleInput]
    model_a_evaluations: list[SearchCaseRuleEvaluation]
    model_b_evaluations: list[SearchCaseRuleEvaluation]
    score_summary: SearchCaseScoreSummary
    soft_checks: list[SearchCaseSoftCheck] = Field(default_factory=list)
    template_snapshot: dict[str, Any]
    plugin_code: str
    plugin_version: str
    latest_review: SingleTurnSearchCaseLatestReview | None = None
