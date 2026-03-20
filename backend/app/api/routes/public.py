from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.response import build_response
from app.db.session import get_db
from app.plugins.registrar import get_plugin_registry

router = APIRouter(tags=["public"])


@router.get("/")
def read_root() -> dict[str, object]:
    settings = get_settings()
    registry = get_plugin_registry()
    return build_response(
        data={
            "app_name": settings.app_name,
            "environment": settings.app_env,
            "plugins": registry.list_metadata(),
        }
    )


@router.get("/health")
def read_health(db: Session = Depends(get_db)) -> JSONResponse:
    registry = get_plugin_registry()
    database_status = "connected"

    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        database_status = "unavailable"

    http_status = (
        status.HTTP_200_OK
        if database_status == "connected"
        else status.HTTP_503_SERVICE_UNAVAILABLE
    )

    return JSONResponse(
        status_code=http_status,
        content=build_response(
            message="ok" if database_status == "connected" else "database unavailable",
            data={
                "status": "healthy" if database_status == "connected" else "degraded",
                "database": database_status,
                "plugins": registry.list_keys(),
            },
        ),
    )

