"""add single turn search case records

Revision ID: 20260320_0008
Revises: 20260320_0007
Create Date: 2026-03-20 17:30:00.000000
"""

from __future__ import annotations

from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision = "20260320_0008"
down_revision = "20260320_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "single_turn_search_case_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project_id", sa.Integer(), nullable=True),
        sa.Column("task_id", sa.String(length=100), nullable=False),
        sa.Column("annotator_id", sa.Integer(), nullable=True),
        sa.Column("domain", sa.String(length=100), nullable=False),
        sa.Column("scenario_description", sa.Text(), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("timeliness_tag", sa.String(length=64), nullable=False),
        sa.Column("model_a_name", sa.String(length=64), nullable=False),
        sa.Column("model_a_response_text", sa.Text(), nullable=False),
        sa.Column("model_a_share_link", sa.Text(), nullable=False),
        sa.Column("model_a_screenshot", sa.Text(), nullable=False),
        sa.Column("model_b_name", sa.String(length=64), nullable=False),
        sa.Column("model_b_response_text", sa.Text(), nullable=False),
        sa.Column("model_b_share_link", sa.Text(), nullable=False),
        sa.Column("model_b_screenshot", sa.Text(), nullable=False),
        sa.Column("reference_answer", sa.Text(), nullable=False),
        sa.Column("scoring_rules", sa.JSON(), nullable=False),
        sa.Column("model_a_evaluations", sa.JSON(), nullable=False),
        sa.Column("model_b_evaluations", sa.JSON(), nullable=False),
        sa.Column("template_snapshot", sa.JSON(), nullable=False),
        sa.Column("score_summary", sa.JSON(), nullable=False),
        sa.Column("soft_checks", sa.JSON(), nullable=True),
        sa.Column("rule_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("penalty_rule_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("positive_total_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("model_a_raw_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("model_a_percentage", sa.Float(), nullable=False, server_default="0"),
        sa.Column("model_b_raw_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("model_b_percentage", sa.Float(), nullable=False, server_default="0"),
        sa.Column("score_gap", sa.Float(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="submitted"),
        sa.Column("plugin_code", sa.String(length=64), nullable=False),
        sa.Column("plugin_version", sa.String(length=32), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["annotator_id"], ["users.id"]),
    )
    op.create_index("ix_sts_case_records_project_id", "single_turn_search_case_records", ["project_id"], unique=False)
    op.create_index("ix_sts_case_records_task_id", "single_turn_search_case_records", ["task_id"], unique=False)
    op.create_index("ix_sts_case_records_annotator_id", "single_turn_search_case_records", ["annotator_id"], unique=False)
    op.create_index("ix_sts_case_records_domain", "single_turn_search_case_records", ["domain"], unique=False)
    op.create_index("ix_sts_case_records_timeliness_tag", "single_turn_search_case_records", ["timeliness_tag"], unique=False)
    op.create_index("ix_sts_case_records_status", "single_turn_search_case_records", ["status"], unique=False)
    op.create_index("ix_sts_case_records_plugin_code", "single_turn_search_case_records", ["plugin_code"], unique=False)

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

    existing_project = connection.execute(
        sa.select(projects.c.id, projects.c.published_at)
        .where(projects.c.plugin_code == "single_turn_search_case", projects.c.source_type == "plugin_seed")
        .limit(1)
    ).mappings().first()

    if existing_project is None:
        published_at = datetime.now(timezone.utc)
        project_id = connection.execute(
            projects.insert()
            .values(
                name="单轮日常搜索边界评测 Case",
                description="用于生产单轮日常搜索边界评测 case 的默认项目，管理员发布模板，专家提交完整 case。",
                plugin_code="single_turn_search_case",
                entry_path="/user/projects/{project_id}/single-turn-search-case",
                publish_status="published",
                is_visible=True,
                source_type="plugin_seed",
                is_published=True,
                published_at=published_at,
                external_url=None,
            )
            .returning(projects.c.id)
        ).scalar_one()
    else:
        project_id = int(existing_project["id"])
        published_at = existing_project["published_at"] or datetime.now(timezone.utc)
        connection.execute(
            projects.update()
            .where(projects.c.id == project_id)
            .values(
                entry_path="/user/projects/{project_id}/single-turn-search-case",
                publish_status="published",
                is_visible=True,
                is_published=True,
                published_at=published_at,
            )
        )

    existing_task = connection.execute(
        sa.select(project_tasks.c.external_task_id)
        .where(
            project_tasks.c.project_id == project_id,
            project_tasks.c.external_task_id == "search-case-template-001",
        )
        .limit(1)
    ).first()

    if existing_task is None:
        connection.execute(
            project_tasks.insert().values(
                project_id=project_id,
                plugin_code="single_turn_search_case",
                external_task_id="search-case-template-001",
                task_payload={
                    "task_name": "单轮日常搜索边界评测 Case 生产",
                    "task_description": "专家用户围绕真实搜索场景，自主生产一个完整可评测 case。",
                    "instruction_text": "请围绕真实、日常、可搜索的问题构造一个完整 case，并补齐双模型回复、参考答案、评分规则与逐条评分备注。",
                    "require_model_screenshot": True,
                    "require_share_link": True,
                    "scoring_rules_min": 5,
                    "scoring_rules_max": 20,
                    "min_penalty_rules": 2,
                    "timeliness_options": ["弱时效", "中时效", "强时效"],
                    "domain_options": ["本地生活", "旅游出行", "消费决策", "教育培训", "健康信息", "科技数码", "工作效率", "其他"],
                    "show_case_guidance": True,
                    "model_a_name": "模型一",
                    "model_b_name": "模型二",
                },
                publish_status="published",
                task_status="pending",
                is_visible=True,
                published_at=published_at,
            )
        )


def downgrade() -> None:
    op.drop_index("ix_sts_case_records_plugin_code", table_name="single_turn_search_case_records")
    op.drop_index("ix_sts_case_records_status", table_name="single_turn_search_case_records")
    op.drop_index("ix_sts_case_records_timeliness_tag", table_name="single_turn_search_case_records")
    op.drop_index("ix_sts_case_records_domain", table_name="single_turn_search_case_records")
    op.drop_index("ix_sts_case_records_annotator_id", table_name="single_turn_search_case_records")
    op.drop_index("ix_sts_case_records_task_id", table_name="single_turn_search_case_records")
    op.drop_index("ix_sts_case_records_project_id", table_name="single_turn_search_case_records")
    op.drop_table("single_turn_search_case_records")
