from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScheduleImportItem(Base):
    __tablename__ = "schedule_import_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    import_id: Mapped[int] = mapped_column(Integer, ForeignKey("schedule_imports.id"), nullable=False)
    class_id: Mapped[int] = mapped_column(Integer, ForeignKey("classes.id"), nullable=False)
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    period_id: Mapped[int] = mapped_column(Integer, ForeignKey("schedule_periods.id"), nullable=False)
    subject_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("subjects.id"), nullable=True)
    recognized_subject_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    teacher_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    teacher_match_status: Mapped[str] = mapped_column(Text, nullable=False, default="unmatched")
    teacher_match_source: Mapped[str] = mapped_column(Text, nullable=False, default="unmatched")
    teacher_candidates: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    issue_flags: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_empty: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
