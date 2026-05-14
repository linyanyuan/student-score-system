from pydantic import BaseModel


class OverviewExamInfo(BaseModel):
    id: int
    name: str


class OverviewClassSummary(BaseModel):
    class_id: int
    class_name: str
    grade: str
    student_count: int
    average_score: float


class OverviewGradeSummary(BaseModel):
    grade: str
    average_score: float


class OverviewResponse(BaseModel):
    role: str
    class_count: int
    student_count: int
    notice_count: int
    latest_exam: OverviewExamInfo | None
    class_summaries: list[OverviewClassSummary]
    grade_summaries: list[OverviewGradeSummary]
