"""add auth fields and simplify user roles

Revision ID: 20260324_0009
Revises: 20260320_0008
Create Date: 2026-03-24 12:00:00
"""
from __future__ import annotations

import hashlib
import secrets

from alembic import op
import sqlalchemy as sa


revision = "20260324_0009"
down_revision = "20260320_0008"
branch_labels = None
depends_on = None

PASSWORD_ITERATIONS = 200_000
PASSWORD_SALT_BYTES = 16
DEFAULT_EXISTING_PASSWORD = "ChangeMe123!"
DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_EMAIL = "admin@example.com"
DEFAULT_ADMIN_PASSWORD = "Admin@123"
DEFAULT_USER_USERNAME = "user"
DEFAULT_USER_EMAIL = "user@example.com"
DEFAULT_USER_PASSWORD = "User@123"


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(PASSWORD_SALT_BYTES)
    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    )
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt}${derived_key.hex()}"


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("session_token_hash", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("session_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_users_session_token_hash"), "users", ["session_token_hash"], unique=False)
    op.alter_column("users", "role", server_default=sa.text("'user'"))

    bind = op.get_bind()
    users_table = sa.table(
        "users",
        sa.column("id", sa.Integer()),
        sa.column("username", sa.String(length=50)),
        sa.column("email", sa.String(length=255)),
        sa.column("role", sa.String(length=32)),
        sa.column("password_hash", sa.String(length=255)),
        sa.column("is_active", sa.Boolean()),
    )

    bind.execute(sa.text("UPDATE users SET role = 'admin' WHERE role = 'super_admin'"))
    bind.execute(sa.text("UPDATE users SET role = 'user' WHERE role = 'annotator'"))

    existing_users = bind.execute(
        sa.select(
            users_table.c.id,
            users_table.c.username,
            users_table.c.role,
        )
    ).fetchall()

    for row in existing_users:
        bind.execute(
            sa.update(users_table)
            .where(users_table.c.id == row.id)
            .values(password_hash=_hash_password(DEFAULT_EXISTING_PASSWORD))
        )

    admin_row = bind.execute(
        sa.select(users_table.c.id).where(users_table.c.username == DEFAULT_ADMIN_USERNAME)
    ).first()
    if admin_row is None:
        bind.execute(
            sa.insert(users_table).values(
                username=DEFAULT_ADMIN_USERNAME,
                email=DEFAULT_ADMIN_EMAIL,
                password_hash=_hash_password(DEFAULT_ADMIN_PASSWORD),
                role="admin",
                is_active=True,
            )
        )
    else:
        bind.execute(
            sa.update(users_table)
            .where(users_table.c.id == admin_row.id)
            .values(
                password_hash=_hash_password(DEFAULT_ADMIN_PASSWORD),
                role="admin",
                is_active=True,
            )
        )

    user_row = bind.execute(
        sa.select(users_table.c.id).where(users_table.c.username == DEFAULT_USER_USERNAME)
    ).first()
    if user_row is None:
        bind.execute(
            sa.insert(users_table).values(
                username=DEFAULT_USER_USERNAME,
                email=DEFAULT_USER_EMAIL,
                password_hash=_hash_password(DEFAULT_USER_PASSWORD),
                role="user",
                is_active=True,
            )
        )
    else:
        bind.execute(
            sa.update(users_table)
            .where(users_table.c.id == user_row.id)
            .values(
                password_hash=_hash_password(DEFAULT_USER_PASSWORD),
                role="user",
                is_active=True,
            )
        )

    op.alter_column("users", "password_hash", existing_type=sa.String(length=255), nullable=False)


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("UPDATE users SET role = 'annotator' WHERE role = 'user'"))

    op.alter_column("users", "role", server_default=sa.text("'annotator'"))
    op.drop_index(op.f("ix_users_session_token_hash"), table_name="users")
    op.drop_column("users", "session_expires_at")
    op.drop_column("users", "session_token_hash")
    op.drop_column("users", "password_hash")
