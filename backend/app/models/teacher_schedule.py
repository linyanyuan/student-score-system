from datetime import datetime

from sqlalchemy import Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TeacherSchedule(Base):
    __tablename__ = "teacher_schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    teacher_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    period_id: Mapped[int] = mapped_column(Integer, ForeignKey("schedule_periods.id"), nullable=False)
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-5 (周一到周五)
    class_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("classes.id"), nullable=True)
    subject_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("subjects.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        UniqueConstraint('teacher_id', 'period_id', 'weekday', name='uq_teacher_period_weekday'),
    )
