from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class PluginMetadata:
    key: str
    name: str
    version: str

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


class AnnotationPlugin(ABC):
    metadata: PluginMetadata

    @abstractmethod
    def describe(self) -> dict[str, str]:
        """Return a minimal description for registry inspection."""

    def get_schema(self) -> dict[str, Any]:
        raise NotImplementedError("This plugin does not expose a page schema.")

    def get_rubric(self) -> dict[str, Any]:
        raise NotImplementedError("This plugin does not expose a rubric.")

    def validate_task_payload(self, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError("This plugin does not support task payload validation.")

    def validate_submission(self, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError("This plugin does not support submission validation.")

    def save_submission(self, db: Any, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError("This plugin does not support submission persistence.")
