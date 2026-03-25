from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ClassTimetable(Base):
    __tablename__ = "class_timetables"
    __table_args__ = (
        UniqueConstraint("class_id", "weekday", "period_id", name="uq_class_timetable_slot"),
        UniqueConstraint("teacher_id", "weekday", "period_id", name="uq_teacher_timetable_slot"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    class_id: Mapped[int] = mapped_column(Integer, ForeignKey("classes.id"), nullable=False)
    teacher_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id: Mapped[int] = mapped_column(Integer, ForeignKey("subjects.id"), nullable=False)
    period_id: Mapped[int] = mapped_column(Integer, ForeignKey("schedule_periods.id"), nullable=False)
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

