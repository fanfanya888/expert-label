"""add project plugin fields and model response review tasks

Revision ID: 20260320_0006
Revises: 20260320_0005
Create Date: 2026-03-20 01:00:00.000000
"""

from __future__ import annotations

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision = "20260320_0006"
down_revision = "20260320_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("plugin_code", sa.String(length=64), nullable=True))
    op.add_column("projects", sa.Column("entry_path", sa.String(length=255), nullable=True))
    op.add_column(
        "projects",
        sa.Column("publish_status", sa.String(length=32), nullable=False, server_default="offline"),
    )
    op.add_column(
        "projects",
        sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "projects",
        sa.Column("source_type", sa.String(length=32), nullable=False, server_default="unknown"),
    )
    op.create_index("ix_projects_plugin_code", "projects", ["plugin_code"], unique=False)

    op.execute(
        sa.text(
            """
            UPDATE projects
            SET publish_status = CASE WHEN is_published THEN 'published' ELSE 'offline' END,
                is_visible = is_published,
                source_type = COALESCE(source_type, 'unknown')
            """
        )
    )

    op.add_column("model_response_review_records", sa.Column("project_id", sa.Integer(), nullable=True))
    op.create_index(
        "ix_model_response_review_records_project_id",
        "model_response_review_records",
        ["project_id"],
        unique=False,
    )
    op.create_foreign_key(
        "fk_model_response_review_records_project_id_projects",
        "model_response_review_records",
        "projects",
        ["project_id"],
        ["id"],
    )

    op.create_table(
        "model_response_review_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("task_id", sa.String(length=100), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("model_reply", sa.Text(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("task_category", sa.String(length=64), nullable=False),
        sa.Column("rubric_version", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.UniqueConstraint("task_id"),
    )
    op.create_index("ix_model_response_review_tasks_project_id", "model_response_review_tasks", ["project_id"], unique=False)
    op.create_index("ix_model_response_review_tasks_task_id", "model_response_review_tasks", ["task_id"], unique=False)
    op.create_index("ix_model_response_review_tasks_task_category", "model_response_review_tasks", ["task_category"], unique=False)
    op.create_index("ix_model_response_review_tasks_status", "model_response_review_tasks", ["status"], unique=False)

    connection = op.get_bind()
    projects = sa.table(
        "projects",
        sa.column("id", sa.Integer()),
        sa.column("name", sa.String()),
        sa.column("description", sa.Text()),
        sa.column("plugin_code", sa.String()),
        sa.column("entry_path", sa.String()),
        sa.column("publish_status", sa.String()),
        sa.column("is_visible", sa.Boolean()),
        sa.column("source_type", sa.String()),
        sa.column("is_published", sa.Boolean()),
        sa.column("published_at", sa.DateTime(timezone=True)),
        sa.column("external_url", sa.String()),
    )
    tasks = sa.table(
        "model_response_review_tasks",
        sa.column("project_id", sa.Integer()),
        sa.column("task_id", sa.String()),
        sa.column("prompt", sa.Text()),
        sa.column("model_reply", sa.Text()),
        sa.column("metadata", sa.JSON()),
        sa.column("task_category", sa.String()),
        sa.column("rubric_version", sa.String()),
        sa.column("status", sa.String()),
    )

    project_id = connection.execute(
        sa.select(projects.c.id)
        .where(
            projects.c.plugin_code == "model_response_review",
            projects.c.source_type == "plugin_seed",
        )
        .limit(1)
    ).scalar_one_or_none()

    if project_id is None:
        project_id = connection.execute(
            projects.insert()
            .values(
                name="模型回答评审",
                description="默认的模型回答评审项目，用于验证项目、任务和提交闭环。",
                plugin_code="model_response_review",
                entry_path="/user/projects/{project_id}/model-response-review",
                publish_status="published",
                is_visible=True,
                source_type="plugin_seed",
                is_published=True,
                published_at=datetime.now(timezone.utc),
                external_url=None,
            )
            .returning(projects.c.id)
        ).scalar_one()

    existing_task_ids = set(
        connection.execute(
            sa.select(tasks.c.task_id).where(tasks.c.project_id == project_id)
        ).scalars()
    )

    seed_tasks = [
        {
            "project_id": project_id,
            "task_id": "mrr-task-001",
            "prompt": "Summarize the main causes of urban air pollution and suggest two realistic mitigation strategies.",
            "model_reply": "Urban air pollution mainly comes from vehicle exhaust, industrial emissions, construction dust, and household fuel use. Two realistic mitigation strategies are expanding clean public transportation and tightening industrial emissions standards with enforcement.",
            "metadata": {"difficulty": "easy", "language": "en"},
            "task_category": "Summarization",
            "rubric_version": "2026-03-20",
            "status": "pending",
        },
        {
            "project_id": project_id,
            "task_id": "mrr-task-002",
            "prompt": "Explain recursion to a beginner in simple terms and provide one Python example.",
            "model_reply": "Recursion is when a function solves a problem by calling itself on a smaller version of the same problem. A simple Python example is factorial, where factorial(n) returns n multiplied by factorial(n-1) until it reaches 1.",
            "metadata": {"difficulty": "medium", "language": "en"},
            "task_category": "Code Explanation",
            "rubric_version": "2026-03-20",
            "status": "pending",
        },
        {
            "project_id": project_id,
            "task_id": "mrr-task-003",
            "prompt": "Translate the sentence 'Data privacy should be treated as a product requirement, not an afterthought.' into Chinese.",
            "model_reply": "数据隐私应该被视为产品需求，而不是事后才考虑的问题。",
            "metadata": {"difficulty": "easy", "language": "en-zh"},
            "task_category": "Translation",
            "rubric_version": "2026-03-20",
            "status": "pending",
        },
        {
            "project_id": project_id,
            "task_id": "mrr-task-004",
            "prompt": "A user asks: 'Can I take ibuprofen and aspirin together every day?' Draft a safe and brief answer.",
            "model_reply": "Taking ibuprofen and aspirin together every day may increase the risk of stomach bleeding and may affect how aspirin works for heart protection. You should talk with a doctor or pharmacist before using both regularly.",
            "metadata": {"difficulty": "medium", "language": "en", "safety_sensitive": True},
            "task_category": "Question Answering",
            "rubric_version": "2026-03-20",
            "status": "pending",
        },
    ]

    new_tasks = [item for item in seed_tasks if item["task_id"] not in existing_task_ids]
    if new_tasks:
        connection.execute(tasks.insert(), new_tasks)


def downgrade() -> None:
    op.drop_index("ix_model_response_review_tasks_status", table_name="model_response_review_tasks")
    op.drop_index("ix_model_response_review_tasks_task_category", table_name="model_response_review_tasks")
    op.drop_index("ix_model_response_review_tasks_task_id", table_name="model_response_review_tasks")
    op.drop_index("ix_model_response_review_tasks_project_id", table_name="model_response_review_tasks")
    op.drop_table("model_response_review_tasks")

    op.drop_constraint(
        "fk_model_response_review_records_project_id_projects",
        "model_response_review_records",
        type_="foreignkey",
    )
    op.drop_index("ix_model_response_review_records_project_id", table_name="model_response_review_records")
    op.drop_column("model_response_review_records", "project_id")

    op.drop_index("ix_projects_plugin_code", table_name="projects")
    op.drop_column("projects", "source_type")
    op.drop_column("projects", "is_visible")
    op.drop_column("projects", "publish_status")
    op.drop_column("projects", "entry_path")
    op.drop_column("projects", "plugin_code")
