from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass


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

