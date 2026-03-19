from datetime import datetime

from sqlalchemy import Integer, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TotalRank(Base):
    __tablename__ = "total_ranks"
    __table_args__ = (
        UniqueConstraint("student_id", "exam_id", name="uq_student_exam_rank"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    student_id: Mapped[int] = mapped_column(Integer, ForeignKey("students.id"), nullable=False)
    exam_id: Mapped[int] = mapped_column(Integer, ForeignKey("exams.id"), nullable=False)
    total_score: Mapped[float] = mapped_column(Float, nullable=False)
    rank_class: Mapped[int] = mapped_column(Integer, nullable=False)
    rank_grade: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
