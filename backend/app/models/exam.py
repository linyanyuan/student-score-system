from datetime import date
from typing import Optional

from sqlalchemy import Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Exam(Base):
    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    exam_date: Mapped[date] = mapped_column(Date, nullable=False)
    grade: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    school_id: Mapped[int] = mapped_column(Integer, ForeignKey("schools.id"), nullable=True)
