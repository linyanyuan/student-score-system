from datetime import date
from typing import Optional

from pydantic import BaseModel


class ExamCreate(BaseModel):
    name: str
    exam_date: date
    grade: str
    description: Optional[str] = None


class ExamUpdate(BaseModel):
    name: Optional[str] = None
    exam_date: Optional[date] = None
    grade: Optional[str] = None
    description: Optional[str] = None


class ExamResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    exam_date: date
    grade: str
    description: Optional[str] = None
