from __future__ import annotations

from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Project(TimestampMixin, Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    external_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_published: Mapped[bool] = mapped_column(
        Boolean,
        index=True,
        default=False,
        server_default=sa.false(),
        nullable=False,
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    published_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    owner: Mapped["User | None"] = relationship(
        back_populates="projects",
        foreign_keys=[owner_id],
    )
    publisher: Mapped["User | None"] = relationship(
        back_populates="published_projects",
        foreign_keys=[published_by],
    )
