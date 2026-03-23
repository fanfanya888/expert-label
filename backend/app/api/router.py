from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import admin_project_tasks, admin_projects, admin_users, me_projects, system, users
from app.plugins.model_response_review.router import router as model_response_review_router
from app.plugins.single_turn_search_case.router import router as single_turn_search_case_router

api_router = APIRouter()
api_router.include_router(system.router)
api_router.include_router(admin_users.router)
api_router.include_router(admin_projects.router)
api_router.include_router(admin_project_tasks.router)
api_router.include_router(me_projects.router)
api_router.include_router(users.router)
api_router.include_router(model_response_review_router)
api_router.include_router(single_turn_search_case_router)
