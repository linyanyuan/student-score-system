from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LessonPlan(Base):
    __tablename__ = "lesson_plans"
    __table_args__ = (
        UniqueConstraint("school_id", "grade", "subject_id", name="uq_lesson_plan_school_grade_subject"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    school_id: Mapped[int] = mapped_column(Integer, ForeignKey("schools.id"), nullable=False)
    grade: Mapped[str] = mapped_column(String(20), nullable=False)
    subject_id: Mapped[int] = mapped_column(Integer, ForeignKey("subjects.id"), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)

