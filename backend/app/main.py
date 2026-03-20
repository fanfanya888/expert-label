from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.api.routes.public import router as public_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.logging import setup_logging

settings = get_settings()
setup_logging(settings.app_debug)


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name, debug=settings.app_debug)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(public_router)
    app.include_router(api_router, prefix=settings.api_prefix)

    return app


app = create_app()
