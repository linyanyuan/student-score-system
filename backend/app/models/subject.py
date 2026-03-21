from typing import Optional

from sqlalchemy import Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Subject(Base):
    __tablename__ = "subjects"
    __table_args__ = (UniqueConstraint("name", "school_id", name="uq_subject_name_school"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    grades: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)  # 逗号分隔的年级，如"七年级,八年级"
    school_id: Mapped[int] = mapped_column(Integer, ForeignKey("schools.id"), nullable=True)
