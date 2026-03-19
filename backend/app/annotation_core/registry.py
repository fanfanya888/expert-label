from __future__ import annotations

from app.annotation_core.base import AnnotationPlugin


class PluginRegistry:
    def __init__(self) -> None:
        self._plugins: dict[str, AnnotationPlugin] = {}

    def register(self, plugin: AnnotationPlugin) -> None:
        key = plugin.metadata.key
        if key in self._plugins:
            raise ValueError(f"Plugin '{key}' is already registered.")
        self._plugins[key] = plugin

    def get(self, key: str) -> AnnotationPlugin | None:
        return self._plugins.get(key)

    def list_keys(self) -> list[str]:
        return list(self._plugins.keys())

    def list_metadata(self) -> list[dict[str, str]]:
        return [plugin.metadata.to_dict() for plugin in self._plugins.values()]

