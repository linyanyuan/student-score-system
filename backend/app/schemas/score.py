from typing import Optional

from pydantic import BaseModel


class ScoreCreate(BaseModel):
    student_id: int
    exam_id: int
    subject_id: int
    score: float


class ScoreUpdate(BaseModel):
    score: float


class ScoreItemResponse(BaseModel):
    student_id: int
    student_no: str
    student_name: str
    class_name: str
    subjects: dict[str, float]
    total_score: float
    rank_class: Optional[int] = None
    rank_grade: Optional[int] = None
    prev_total_score: Optional[float] = None
    prev_rank_class: Optional[int] = None
    prev_rank_grade: Optional[int] = None
    rank_class_change: str = "-"
    rank_grade_change: str = "-"


class ScorePaginatedResponse(BaseModel):
    items: list[ScoreItemResponse]
    total: int
    page: int
    page_size: int


class BatchDeleteScoresRequest(BaseModel):
    exam_id: int
    student_ids: list[int]
