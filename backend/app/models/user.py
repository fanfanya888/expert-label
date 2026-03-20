from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    role: Mapped[str] = mapped_column(
        String(32),
        index=True,
        default="annotator",
        server_default=sa.text("'annotator'"),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default=sa.true(),
        nullable=False,
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    projects: Mapped[list["Project"]] = relationship(
        back_populates="owner",
        foreign_keys="Project.owner_id",
    )
    published_projects: Mapped[list["Project"]] = relationship(
        back_populates="publisher",
        foreign_keys="Project.published_by",
    )
