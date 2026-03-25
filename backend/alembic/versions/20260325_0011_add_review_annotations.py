"""add review annotations

Revision ID: 20260325_0011
Revises: 20260324_0010
Create Date: 2026-03-25 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260325_0011"
down_revision = "20260324_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("project_task_reviews", sa.Column("review_annotations", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("project_task_reviews", "review_annotations")
