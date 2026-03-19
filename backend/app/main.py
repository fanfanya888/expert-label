from __future__ import annotations

from fastapi import Depends, FastAPI, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.response import build_response
from app.db.session import get_db_session
from app.plugins.registrar import build_plugin_registry

settings = get_settings()
plugin_registry = build_plugin_registry()

app = FastAPI(title=settings.app_name, debug=settings.app_debug)


@app.get("/")
def read_root() -> dict[str, object]:
    return build_response(
        data={
            "app_name": settings.app_name,
            "environment": settings.app_env,
            "plugins": plugin_registry.list_metadata(),
        }
    )


@app.get("/health")
def read_health(db: Session = Depends(get_db_session)) -> JSONResponse:
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
                "plugins": plugin_registry.list_keys(),
            },
        ),
    )

