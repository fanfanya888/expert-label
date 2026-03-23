"""add model response review records

Revision ID: 20260320_0005
Revises: 20260319_0004
Create Date: 2026-03-20 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260320_0005"
down_revision = "20260319_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "model_response_review_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("task_id", sa.String(length=100), nullable=False),
        sa.Column("annotator_id", sa.Integer(), nullable=True),
        sa.Column("task_category", sa.String(length=64), nullable=False),
        sa.Column("answer_rating", sa.String(length=32), nullable=False),
        sa.Column("rating_reason", sa.Text(), nullable=False),
        sa.Column("prompt_snapshot", sa.Text(), nullable=False),
        sa.Column("model_reply_snapshot", sa.Text(), nullable=False),
        sa.Column("rubric_version", sa.String(length=32), nullable=False),
        sa.Column("rubric_snapshot", sa.JSON(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("plugin_code", sa.String(length=64), nullable=False),
        sa.Column("plugin_version", sa.String(length=32), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["annotator_id"], ["users.id"]),
    )
    op.create_index("ix_model_response_review_records_task_id", "model_response_review_records", ["task_id"], unique=False)
    op.create_index("ix_model_response_review_records_annotator_id", "model_response_review_records", ["annotator_id"], unique=False)
    op.create_index("ix_model_response_review_records_task_category", "model_response_review_records", ["task_category"], unique=False)
    op.create_index("ix_model_response_review_records_answer_rating", "model_response_review_records", ["answer_rating"], unique=False)
    op.create_index("ix_model_response_review_records_plugin_code", "model_response_review_records", ["plugin_code"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_model_response_review_records_plugin_code", table_name="model_response_review_records")
    op.drop_index("ix_model_response_review_records_answer_rating", table_name="model_response_review_records")
    op.drop_index("ix_model_response_review_records_task_category", table_name="model_response_review_records")
    op.drop_index("ix_model_response_review_records_annotator_id", table_name="model_response_review_records")
    op.drop_index("ix_model_response_review_records_task_id", table_name="model_response_review_records")
    op.drop_table("model_response_review_records")
