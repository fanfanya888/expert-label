from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class SystemInfo(BaseModel):
    app_name: str
    environment: str
    debug: bool
    api_prefix: str
    redis_enabled: bool
    plugins: list[dict[str, str]]


class SystemPing(BaseModel):
    status: str
    now: datetime

