from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SchedulePeriod(Base):
    __tablename__ = "schedule_periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    start_time: Mapped[str] = mapped_column(String(10), nullable=False)  # format: HH:MM
    end_time: Mapped[str] = mapped_column(String(10), nullable=False)  # format: HH:MM
    school_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("schools.id"), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    include_in_auto_schedule: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
