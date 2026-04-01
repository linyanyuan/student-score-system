from datetime import date
from typing import Optional

from pydantic import BaseModel


class ExamGradeSubjectSubjectResponse(BaseModel):
    id: int
    name: str


class ExamGradeSubjectConfig(BaseModel):
    grade: str
    subject_ids: list[int]


class ExamGradeSubjectConfigResponse(BaseModel):
    grade: str
    subject_ids: list[int]
    subjects: list[ExamGradeSubjectSubjectResponse] = []


class ExamCreate(BaseModel):
    name: str
    exam_date: date
    grade: str
    description: Optional[str] = None
    school_id: Optional[int] = None
    grade_subjects: list[ExamGradeSubjectConfig] = []


class ExamUpdate(BaseModel):
    name: Optional[str] = None
    exam_date: Optional[date] = None
    grade: Optional[str] = None
    description: Optional[str] = None
    grade_subjects: Optional[list[ExamGradeSubjectConfig]] = None


class ExamResponse(BaseModel):
    id: int
    name: str
    exam_date: date
    grade: str
    description: Optional[str] = None
    grade_subjects: list[ExamGradeSubjectConfigResponse] = []
