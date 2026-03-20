from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app.core.config import get_settings
from app.core.response import build_response, serialize_schema
from app.plugins.registrar import get_plugin_registry
from app.schemas.system import SystemInfo, SystemPing

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/info")
def get_system_info() -> dict[str, object]:
    settings = get_settings()
    registry = get_plugin_registry()
    payload = SystemInfo(
        app_name=settings.app_name,
        environment=settings.app_env,
        debug=settings.app_debug,
        api_prefix=settings.api_prefix,
        redis_enabled=bool(settings.redis_url),
        plugins=registry.list_metadata(),
    )
    return build_response(data=serialize_schema(payload))


@router.get("/ping")
def get_system_ping() -> dict[str, object]:
    payload = SystemPing(status="pong", now=datetime.now(timezone.utc))
    return build_response(data=serialize_schema(payload))

