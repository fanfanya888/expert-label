from __future__ import annotations

from functools import lru_cache

from app.annotation_core.registry import PluginRegistry
from app.plugins.expert_label_demo.plugin import ExpertLabelDemoPlugin


def register_builtin_plugins(registry: PluginRegistry) -> PluginRegistry:
    registry.register(ExpertLabelDemoPlugin())
    return registry


def build_plugin_registry() -> PluginRegistry:
    return register_builtin_plugins(PluginRegistry())


@lru_cache
def get_plugin_registry() -> PluginRegistry:
    return build_plugin_registry()

