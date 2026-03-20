from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import admin_projects, admin_users, me_projects, system, users

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(admin_users.router)
api_router.include_router(admin_projects.router)
api_router.include_router(me_projects.router)
api_router.include_router(users.router)
