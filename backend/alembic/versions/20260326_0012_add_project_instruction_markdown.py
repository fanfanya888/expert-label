"""add project instruction markdown

Revision ID: 20260326_0012
Revises: 20260325_0011
Create Date: 2026-03-26 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260326_0012"
down_revision = "20260325_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("instruction_markdown", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("projects", "instruction_markdown")
