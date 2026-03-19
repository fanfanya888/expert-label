from __future__ import annotations

from app.annotation_core.base import AnnotationPlugin, PluginMetadata


class ExpertLabelDemoPlugin(AnnotationPlugin):
    metadata = PluginMetadata(
        key="expert_label_demo",
        name="Expert Label Demo",
        version="0.1.0",
    )

    def describe(self) -> dict[str, str]:
        return {
            "summary": "Minimal demo plugin for Phase 1B.",
        }

