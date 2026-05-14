from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SchoolNoticeRecipient(Base):
    __tablename__ = "school_notice_recipients"
    __table_args__ = (
        UniqueConstraint("notice_id", "teacher_id", name="uq_school_notice_recipient"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    notice_id: Mapped[int] = mapped_column(Integer, ForeignKey("school_notices.id"), nullable=False)
    teacher_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
