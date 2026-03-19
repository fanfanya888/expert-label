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

