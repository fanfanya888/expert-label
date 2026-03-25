"""add task workflow and user capabilities

Revision ID: 20260324_0010
Revises: 20260324_0009
Create Date: 2026-03-24 18:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260324_0010"
down_revision = "20260324_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("can_annotate", sa.Boolean(), nullable=True, server_default=sa.true()),
    )
    op.add_column(
        "users",
        sa.Column("can_review", sa.Boolean(), nullable=True, server_default=sa.false()),
    )

    bind = op.get_bind()
    bind.execute(sa.text("UPDATE users SET can_annotate = TRUE, can_review = FALSE WHERE role = 'user'"))
    bind.execute(sa.text("UPDATE users SET can_annotate = FALSE, can_review = FALSE WHERE role = 'admin'"))
    bind.execute(sa.text("UPDATE users SET can_annotate = TRUE, can_review = TRUE WHERE username = 'user'"))

    op.alter_column("users", "can_annotate", existing_type=sa.Boolean(), nullable=False)
    op.alter_column("users", "can_review", existing_type=sa.Boolean(), nullable=False)

    op.add_column("project_tasks", sa.Column("annotation_assignee_id", sa.Integer(), nullable=True))
    op.add_column("project_tasks", sa.Column("annotation_claimed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("project_tasks", sa.Column("annotation_submitted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("project_tasks", sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "ix_project_tasks_annotation_assignee_id",
        "project_tasks",
        ["annotation_assignee_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_project_tasks_annotation_assignee_id_users",
        "project_tasks",
        "users",
        ["annotation_assignee_id"],
        ["id"],
    )

    bind.execute(
        sa.text(
            """
            UPDATE project_tasks
            SET task_status = CASE
                WHEN task_status = 'completed' THEN 'approved'
                WHEN task_status = 'pending' THEN 'annotation_pending'
                ELSE COALESCE(task_status, 'annotation_pending')
            END
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE project_tasks
            SET approved_at = COALESCE(updated_at, created_at, NOW())
            WHERE task_status = 'approved' AND approved_at IS NULL
            """
        )
    )
    op.alter_column(
        "project_tasks",
        "task_status",
        existing_type=sa.String(length=32),
        server_default=sa.text("'annotation_pending'"),
    )

    op.create_table(
        "project_task_reviews",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_task_id", sa.Integer(), nullable=False),
        sa.Column("review_round", sa.Integer(), nullable=False),
        sa.Column("review_status", sa.String(length=32), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("reviewer_id", sa.Integer(), nullable=True),
        sa.Column("review_result", sa.String(length=32), nullable=True),
        sa.Column("review_comment", sa.Text(), nullable=True),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_task_id"], ["project_tasks.id"]),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"]),
    )
    op.create_index(
        "ix_project_task_reviews_project_task_id",
        "project_task_reviews",
        ["project_task_id"],
        unique=False,
    )
    op.create_index(
        "ix_project_task_reviews_review_status",
        "project_task_reviews",
        ["review_status"],
        unique=False,
    )
    op.create_index(
        "ix_project_task_reviews_reviewer_id",
        "project_task_reviews",
        ["reviewer_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_project_task_reviews_reviewer_id", table_name="project_task_reviews")
    op.drop_index("ix_project_task_reviews_review_status", table_name="project_task_reviews")
    op.drop_index("ix_project_task_reviews_project_task_id", table_name="project_task_reviews")
    op.drop_table("project_task_reviews")

    op.alter_column(
        "project_tasks",
        "task_status",
        existing_type=sa.String(length=32),
        server_default=sa.text("'pending'"),
    )
    op.execute(
        sa.text(
            """
            UPDATE project_tasks
            SET task_status = CASE
                WHEN task_status = 'approved' THEN 'completed'
                ELSE 'pending'
            END
            """
        )
    )
    op.drop_constraint("fk_project_tasks_annotation_assignee_id_users", "project_tasks", type_="foreignkey")
    op.drop_index("ix_project_tasks_annotation_assignee_id", table_name="project_tasks")
    op.drop_column("project_tasks", "approved_at")
    op.drop_column("project_tasks", "annotation_submitted_at")
    op.drop_column("project_tasks", "annotation_claimed_at")
    op.drop_column("project_tasks", "annotation_assignee_id")

    op.drop_column("users", "can_review")
    op.drop_column("users", "can_annotate")
