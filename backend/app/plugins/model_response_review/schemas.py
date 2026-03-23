from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.plugins.model_response_review.rubric import ANSWER_RATINGS, RUBRIC_VERSION, TASK_CATEGORIES


class ModelResponseReviewMetadata(BaseModel):
    key: str
    name: str
    version: str
    summary: str


class ModelResponseReviewSchema(BaseModel):
    plugin_code: str
    plugin_version: str
    page_title: str
    sections: list[str]
    task_category_options: list[str]
    answer_rating_options: list[str]
    rating_reason_placeholder: str


class ModelResponseReviewRubricLevel(BaseModel):
    rating: str
    guidance: str


class ModelResponseReviewRubric(BaseModel):
    title: str
    version: str
    intro: str
    levels: list[ModelResponseReviewRubricLevel]
    review_notes: list[str]


class ModelResponseReviewProjectStats(BaseModel):
    project_id: int
    total_tasks: int
    completed_tasks: int
    pending_tasks: int


class ModelResponseReviewTaskPayload(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    prompt: str = Field(min_length=1)
    model_reply: str | None = None
    task_category: str = "Other"
    metadata: dict[str, Any] = Field(default_factory=dict)
    rubric_version: str = Field(default=RUBRIC_VERSION, min_length=1, max_length=32)

    @field_validator("prompt")
    @classmethod
    def validate_prompt(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("prompt is required")
        return stripped

    @field_validator("model_reply", mode="before")
    @classmethod
    def normalize_model_reply(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("task_category", mode="before")
    @classmethod
    def normalize_task_category(cls, value: str | None) -> str:
        if value is None:
            return "Other"
        stripped = value.strip()
        return stripped or "Other"

    @field_validator("task_category")
    @classmethod
    def validate_task_category(cls, value: str) -> str:
        if value not in TASK_CATEGORIES:
            raise ValueError("task_category is invalid")
        return value

    @field_validator("rubric_version", mode="before")
    @classmethod
    def normalize_rubric_version(cls, value: str | None) -> str:
        if value is None:
            return RUBRIC_VERSION
        stripped = value.strip()
        return stripped or RUBRIC_VERSION


class ModelResponseReviewTaskRead(ModelResponseReviewTaskPayload):
    project_id: int
    task_id: str
    status: str


class ModelResponseReviewSubmission(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    project_id: int
    task_id: str = Field(min_length=1, max_length=100)
    annotator_id: int | None = None
    task_category: str
    answer_rating: str
    rating_reason: str
    prompt_snapshot: str = Field(min_length=1)
    model_reply_snapshot: str = Field(min_length=1)
    rubric_version: str = Field(min_length=1, max_length=32)
    rubric_snapshot: dict[str, Any]
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("task_category")
    @classmethod
    def validate_submission_task_category(cls, value: str) -> str:
        stripped = value.strip()
        if stripped not in TASK_CATEGORIES:
            raise ValueError("task_category is invalid")
        return stripped

    @field_validator("answer_rating")
    @classmethod
    def validate_answer_rating(cls, value: str) -> str:
        stripped = value.strip()
        if stripped not in ANSWER_RATINGS:
            raise ValueError("answer_rating is invalid")
        return stripped

    @field_validator("rating_reason")
    @classmethod
    def validate_rating_reason(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("rating_reason is required")
        return stripped


class ModelResponseReviewValidationIssue(BaseModel):
    field: str
    message: str


class ModelResponseReviewValidationResult(BaseModel):
    valid: bool
    errors: list[ModelResponseReviewValidationIssue] = Field(default_factory=list)
    normalized: ModelResponseReviewSubmission | None = None


class ModelResponseReviewSavedSubmission(BaseModel):
    submission_id: int
    project_id: int
    task_id: str
    plugin_code: str
    plugin_version: str
    task_status: str
    submitted_at: datetime


class ModelResponseReviewSubmissionRecord(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    submission_id: int
    project_id: int | None
    task_id: str
    annotator_id: int | None = None
    task_category: str
    answer_rating: str
    rating_reason: str
    prompt_snapshot: str
    model_reply_snapshot: str
    rubric_version: str
    metadata: dict[str, Any] | None = None
    plugin_code: str
    plugin_version: str
    submitted_at: datetime
