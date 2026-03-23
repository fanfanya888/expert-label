"""add project task publish layer

Revision ID: 20260320_0007
Revises: 20260320_0006
Create Date: 2026-03-20 08:00:00.000000
"""

from __future__ import annotations

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision = "20260320_0007"
down_revision = "20260320_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("plugin_code", sa.String(length=64), nullable=False),
        sa.Column("external_task_id", sa.String(length=100), nullable=False),
        sa.Column("task_payload", sa.JSON(), nullable=False),
        sa.Column("publish_status", sa.String(length=32), nullable=False, server_default="offline"),
        sa.Column("task_status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("is_visible", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.UniqueConstraint(
            "project_id",
            "external_task_id",
            name="uq_project_tasks_project_external_task_id",
        ),
    )
    op.create_index("ix_project_tasks_project_id", "project_tasks", ["project_id"], unique=False)
    op.create_index("ix_project_tasks_plugin_code", "project_tasks", ["plugin_code"], unique=False)
    op.create_index("ix_project_tasks_external_task_id", "project_tasks", ["external_task_id"], unique=False)
    op.create_index("ix_project_tasks_task_status", "project_tasks", ["task_status"], unique=False)

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
    legacy_tasks = sa.table(
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
    project_tasks = sa.table(
        "project_tasks",
        sa.column("project_id", sa.Integer()),
        sa.column("plugin_code", sa.String()),
        sa.column("external_task_id", sa.String()),
        sa.column("task_payload", sa.JSON()),
        sa.column("publish_status", sa.String()),
        sa.column("task_status", sa.String()),
        sa.column("is_visible", sa.Boolean()),
        sa.column("published_at", sa.DateTime(timezone=True)),
    )

    project_row = connection.execute(
        sa.select(
            projects.c.id,
            projects.c.published_at,
        )
        .where(
            projects.c.plugin_code == "model_response_review",
            projects.c.source_type == "plugin_seed",
        )
        .limit(1)
    ).mappings().first()

    if project_row is None:
        project_id = connection.execute(
            projects.insert()
            .values(
                name="模型回答评审",
                description="默认的模型回答评审项目，用于验证项目、任务发布和提交闭环。",
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
        published_at = datetime.now(timezone.utc)
    else:
        project_id = int(project_row["id"])
        published_at = project_row["published_at"] or datetime.now(timezone.utc)
        connection.execute(
            projects.update()
            .where(projects.c.id == project_id)
            .values(
                entry_path="/user/projects/{project_id}/model-response-review",
                publish_status="published",
                is_visible=True,
                is_published=True,
                published_at=published_at,
            )
        )

    existing_external_task_ids = set(
        connection.execute(
            sa.select(project_tasks.c.external_task_id).where(project_tasks.c.project_id == project_id)
        ).scalars()
    )

    source_rows = list(
        connection.execute(
            sa.select(
                legacy_tasks.c.task_id,
                legacy_tasks.c.prompt,
                legacy_tasks.c.model_reply,
                legacy_tasks.c.metadata,
                legacy_tasks.c.task_category,
                legacy_tasks.c.rubric_version,
                legacy_tasks.c.status,
            ).where(legacy_tasks.c.project_id == project_id)
        ).mappings()
    )

    if not source_rows:
        source_rows = [
            {
                "task_id": "mrr-release-001",
                "prompt": "Summarize the main causes of urban air pollution and suggest two realistic mitigation strategies.",
                "model_reply": "Urban air pollution mainly comes from vehicle exhaust, industrial emissions, construction dust, and household fuel use. Two realistic mitigation strategies are expanding clean public transportation and tightening industrial emissions standards with enforcement.",
                "metadata": {"difficulty": "easy", "language": "en"},
                "task_category": "Summarization",
                "rubric_version": "2026-03-20",
                "status": "pending",
            },
            {
                "task_id": "mrr-release-002",
                "prompt": "Explain recursion to a beginner in simple terms and provide one Python example.",
                "model_reply": "Recursion is when a function solves a problem by calling itself on a smaller version of the same problem. A simple Python example is factorial, where factorial(n) returns n multiplied by factorial(n-1) until it reaches 1.",
                "metadata": {"difficulty": "medium", "language": "en"},
                "task_category": "Code Explanation",
                "rubric_version": "2026-03-20",
                "status": "pending",
            },
            {
                "task_id": "mrr-release-003",
                "prompt": "Translate the sentence 'Data privacy should be treated as a product requirement, not an afterthought.' into Chinese.",
                "model_reply": "数据隐私应该被视为产品需求，而不是事后才考虑的问题。",
                "metadata": {"difficulty": "easy", "language": "en-zh"},
                "task_category": "Translation",
                "rubric_version": "2026-03-20",
                "status": "pending",
            },
        ]

    seed_rows = []
    for row in source_rows:
        external_task_id = row["task_id"]
        if external_task_id in existing_external_task_ids:
            continue
        seed_rows.append(
            {
                "project_id": project_id,
                "plugin_code": "model_response_review",
                "external_task_id": external_task_id,
                "task_payload": {
                    "prompt": row["prompt"],
                    "model_reply": row["model_reply"],
                    "task_category": row["task_category"],
                    "metadata": row["metadata"] or {},
                    "rubric_version": row["rubric_version"],
                },
                "publish_status": "published",
                "task_status": row["status"] or "pending",
                "is_visible": True,
                "published_at": published_at,
            }
        )

    if seed_rows:
        connection.execute(project_tasks.insert(), seed_rows)


def downgrade() -> None:
    op.drop_index("ix_project_tasks_task_status", table_name="project_tasks")
    op.drop_index("ix_project_tasks_external_task_id", table_name="project_tasks")
    op.drop_index("ix_project_tasks_plugin_code", table_name="project_tasks")
    op.drop_index("ix_project_tasks_project_id", table_name="project_tasks")
    op.drop_table("project_tasks")
