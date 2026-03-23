from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CustomFieldDefinition(Base):
    __tablename__ = "custom_field_definitions"
    __table_args__ = (UniqueConstraint("field_name", "school_id", name="uq_custom_field_name_school"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    field_name: Mapped[str] = mapped_column(String(50), nullable=False)
    field_type: Mapped[str] = mapped_column(String(20), nullable=False)  # text/number/date/select
    options: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array for select type
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    school_id: Mapped[int] = mapped_column(Integer, ForeignKey("schools.id"), nullable=True)
