from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SchoolNoticeAudience(Base):
    __tablename__ = "school_notice_audiences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    notice_id: Mapped[int] = mapped_column(Integer, ForeignKey("school_notices.id"), nullable=False)
    audience_type: Mapped[str] = mapped_column(String(30), nullable=False)
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
