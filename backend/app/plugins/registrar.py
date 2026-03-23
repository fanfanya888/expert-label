from __future__ import annotations

from functools import lru_cache

from app.annotation_core.registry import PluginRegistry
from app.plugins.expert_label_demo.plugin import ExpertLabelDemoPlugin
from app.plugins.model_response_review.plugin import ModelResponseReviewPlugin
from app.plugins.single_turn_search_case.plugin import SingleTurnSearchCasePlugin


def register_builtin_plugins(registry: PluginRegistry) -> PluginRegistry:
    registry.register(ExpertLabelDemoPlugin())
    registry.register(ModelResponseReviewPlugin())
    registry.register(SingleTurnSearchCasePlugin())
    return registry


def build_plugin_registry() -> PluginRegistry:
    return register_builtin_plugins(PluginRegistry())


@lru_cache
def get_plugin_registry() -> PluginRegistry:
    return build_plugin_registry()
