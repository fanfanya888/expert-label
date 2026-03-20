"""add project publish control fields

Revision ID: 20260319_0004
Revises: 20260319_0003
Create Date: 2026-03-19 01:30:00
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260319_0004"
down_revision = "20260319_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("external_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column(
            "is_published",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.add_column(
        "projects",
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "projects",
        sa.Column("published_by", sa.Integer(), nullable=True),
    )
    op.create_index(op.f("ix_projects_is_published"), "projects", ["is_published"], unique=False)
    op.create_foreign_key(
        "fk_projects_published_by_users",
        "projects",
        "users",
        ["published_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_projects_published_by_users", "projects", type_="foreignkey")
    op.drop_index(op.f("ix_projects_is_published"), table_name="projects")
    op.drop_column("projects", "published_by")
    op.drop_column("projects", "published_at")
    op.drop_column("projects", "is_published")
    op.drop_column("projects", "external_url")
