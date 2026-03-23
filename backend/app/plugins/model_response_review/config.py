from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.services.llm_service import LLMClientConfig

PLUGIN_ENV_FILE = Path(__file__).with_name("plugin.env")


class ModelSlotSettings(BaseModel):
    enabled: bool = False
    provider: str = "mock"
    base_url: str = ""
    api_key: str = ""
    model: str = "mock-model-response-review"
    timeout: float = 30.0
    temperature: float = 0.2

    def to_client_config(self, slot_name: str) -> LLMClientConfig:
        return LLMClientConfig(
            enabled=self.enabled,
            provider=self.provider,
            base_url=self.base_url,
            api_key=self.api_key,
            model=self.model,
            timeout=self.timeout,
            temperature=self.temperature,
            slot_name=slot_name,
        )


def _parse_bool(value: bool | str | None) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "t", "yes", "y", "on", "ture"}:
        return True
    if normalized in {"0", "false", "f", "no", "n", "off", ""}:
        return False
    raise ValueError("invalid boolean value")


class ModelResponseReviewPluginSettings(BaseSettings):
    generation_enabled: bool = False
    generation_allow_mock_fallback: bool = False
    generation_provider: str = "mock"
    generation_base_url: str = ""
    generation_api_key: str = ""
    generation_model: str = "mock-model-response-review"
    generation_timeout: float = 30.0
    generation_temperature: float = 0.2

    review_enabled: bool = False
    review_provider: str = "mock"
    review_base_url: str = ""
    review_api_key: str = ""
    review_model: str = "mock-review-model-response-review"
    review_timeout: float = 30.0
    review_temperature: float = 0.0

    model_config = SettingsConfigDict(
        env_file=str(PLUGIN_ENV_FILE),
        env_file_encoding="utf-8",
        env_prefix="MODEL_RESPONSE_REVIEW_",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("generation_enabled", "generation_allow_mock_fallback", "review_enabled", mode="before")
    @classmethod
    def parse_enabled_flags(cls, value: bool | str | None) -> bool:
        return _parse_bool(value)

    def get_slot(self, slot_name: str) -> LLMClientConfig:
        if slot_name == "generation":
            slot = ModelSlotSettings(
                enabled=self.generation_enabled,
                provider=self.generation_provider,
                base_url=self.generation_base_url,
                api_key=self.generation_api_key,
                model=self.generation_model,
                timeout=self.generation_timeout,
                temperature=self.generation_temperature,
            )
            return slot.to_client_config("generation")

        if slot_name == "review":
            slot = ModelSlotSettings(
                enabled=self.review_enabled,
                provider=self.review_provider,
                base_url=self.review_base_url,
                api_key=self.review_api_key,
                model=self.review_model,
                timeout=self.review_timeout,
                temperature=self.review_temperature,
            )
            return slot.to_client_config("review")

        raise KeyError(f"Unsupported model slot: {slot_name}")


@lru_cache
def get_model_response_review_settings() -> ModelResponseReviewPluginSettings:
    return ModelResponseReviewPluginSettings()
