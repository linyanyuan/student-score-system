from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScheduleDraftItem(Base):
    __tablename__ = "schedule_draft_items"
    __table_args__ = (
        UniqueConstraint("draft_id", "class_id", "weekday", "period_id", name="uq_schedule_draft_class_slot"),
        UniqueConstraint("draft_id", "teacher_id", "weekday", "period_id", name="uq_schedule_draft_teacher_slot"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    draft_id: Mapped[int] = mapped_column(Integer, ForeignKey("schedule_drafts.id"), nullable=False)
    class_id: Mapped[int] = mapped_column(Integer, ForeignKey("classes.id"), nullable=False)
    teacher_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id: Mapped[int] = mapped_column(Integer, ForeignKey("subjects.id"), nullable=False)
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    period_id: Mapped[int] = mapped_column(Integer, ForeignKey("schedule_periods.id"), nullable=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    penalty_tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
