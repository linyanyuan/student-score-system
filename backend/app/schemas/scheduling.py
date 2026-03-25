from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class LessonPlanConfig(BaseModel):
    subject_id: int
    weekly_hours: int = Field(default=0, ge=0)
    priority: int = 1
    avoid_consecutive: bool = False
    forbidden_periods: list[list[int]] = Field(default_factory=list)


class LessonPlanBatchSaveRequest(BaseModel):
    grade: str
    items: list[LessonPlanConfig]


class LessonPlanBatchResponse(BaseModel):
    grade: str
    items: list[LessonPlanConfig]


class TeachingArrangementItem(BaseModel):
    class_id: int
    subject_id: int
    teacher_id: int


class TeachingArrangementBatchSaveRequest(BaseModel):
    grade: str
    items: list[TeachingArrangementItem]


class TeachingArrangementBatchResponse(BaseModel):
    grade: str
    items: list[TeachingArrangementItem]


class ScheduleTaskCreateResponse(BaseModel):
    task_id: int
    status: str


class ScheduleTaskResponse(BaseModel):
    id: int
    status: str
    progress: int
    message: str | None = None
    result: Any = None
    error: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class TimetableItem(BaseModel):
    weekday: int
    period_id: int
    class_id: int
    class_name: str | None = None
    subject_id: int
    subject_name: str | None = None
    teacher_id: int
    teacher_name: str | None = None


class TimetableResponse(BaseModel):
    items: list[TimetableItem]
