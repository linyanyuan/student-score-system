from sqlalchemy import Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Class(Base):
    __tablename__ = "classes"
    __table_args__ = (UniqueConstraint("name", "school_id", name="uq_class_name_school"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    grade: Mapped[str] = mapped_column(String(20), nullable=False)
    school_id: Mapped[int] = mapped_column(Integer, ForeignKey("schools.id"), nullable=True)
