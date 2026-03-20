from __future__ import annotations

from typing import Any


def build_response(
    data: Any = None,
    message: str = "ok",
    code: int = 0,
) -> dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "data": data,
    }


def serialize_schema(data: Any) -> Any:
    if hasattr(data, "model_dump"):
        return data.model_dump(mode="json")
    if isinstance(data, list):
        return [serialize_schema(item) for item in data]
    return data

