from sqlalchemy import Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TeacherClassSubject(Base):
    __tablename__ = "teacher_class_subjects"
    __table_args__ = (
        UniqueConstraint("class_id", "subject_id", name="uq_teacher_class_subject"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    teacher_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    class_id: Mapped[int] = mapped_column(Integer, ForeignKey("classes.id"), nullable=False)
    subject_id: Mapped[int] = mapped_column(Integer, ForeignKey("subjects.id"), nullable=False)

