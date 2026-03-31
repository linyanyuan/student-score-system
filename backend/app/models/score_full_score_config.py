from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ScoreFullScoreConfig(Base):
    __tablename__ = "score_full_score_configs"
    __table_args__ = (UniqueConstraint("school_id", name="uq_score_full_score_config_school"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    school_id: Mapped[int] = mapped_column(Integer, ForeignKey("schools.id"), nullable=False)
    chinese_full_score: Mapped[float] = mapped_column(Float, nullable=False, default=120.0)
    math_full_score: Mapped[float] = mapped_column(Float, nullable=False, default=120.0)
    english_full_score: Mapped[float] = mapped_column(Float, nullable=False, default=120.0)
    other_full_score: Mapped[float] = mapped_column(Float, nullable=False, default=60.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
