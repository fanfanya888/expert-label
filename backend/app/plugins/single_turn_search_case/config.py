from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.services.llm_service import LLMClientConfig

PLUGIN_ENV_FILE = Path(__file__).with_name("plugin.env")


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


class SingleTurnSearchCasePluginSettings(BaseSettings):
    review_enabled: bool = True
    review_provider: str = "mock"
    review_base_url: str = ""
    review_api_key: str = ""
    review_model: str = "mock-single-turn-search-case-review"
    review_timeout: float = 30.0
    review_temperature: float = 0.1

    model_config = SettingsConfigDict(
        env_file=str(PLUGIN_ENV_FILE),
        env_file_encoding="utf-8",
        env_prefix="SINGLE_TURN_SEARCH_CASE_",
        case_sensitive=False,
        extra="ignore",
    )

    @field_validator("review_enabled", mode="before")
    @classmethod
    def parse_enabled_flag(cls, value: bool | str | None) -> bool:
        return _parse_bool(value)

    def get_review_config(self) -> LLMClientConfig:
        return LLMClientConfig(
            enabled=self.review_enabled,
            provider=self.review_provider,
            base_url=self.review_base_url,
            api_key=self.review_api_key,
            model=self.review_model,
            timeout=self.review_timeout,
            temperature=self.review_temperature,
            slot_name="single-turn-search-case-review",
        )


@lru_cache
def get_single_turn_search_case_settings() -> SingleTurnSearchCasePluginSettings:
    return SingleTurnSearchCasePluginSettings()
