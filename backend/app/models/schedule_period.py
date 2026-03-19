from datetime import datetime

from sqlalchemy import Integer, String, Boolean, DateTime, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SchedulePeriod(Base):
    __tablename__ = "schedule_periods"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    start_time: Mapped[str] = mapped_column(String(10), nullable=False)  # 格式: "HH:MM"
    end_time: Mapped[str] = mapped_column(String(10), nullable=False)    # 格式: "HH:MM"
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
