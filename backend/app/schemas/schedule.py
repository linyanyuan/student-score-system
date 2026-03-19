from datetime import datetime, date

from pydantic import BaseModel, ConfigDict


# SchedulePeriod Schemas
class SchedulePeriodCreate(BaseModel):
    name: str
    start_time: str  # 格式: "HH:MM"
    end_time: str    # 格式: "HH:MM"
    sort_order: int


class SchedulePeriodUpdate(BaseModel):
    name: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class SchedulePeriodResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    start_time: str
    end_time: str
    sort_order: int
    is_active: bool
    created_at: datetime


# TeacherSchedule Schemas
class TeacherScheduleCreate(BaseModel):
    period_id: int
    weekday: int  # 1-5
    class_id: int | None = None
    subject_id: int | None = None


class TeacherScheduleUpdate(BaseModel):
    class_id: int | None = None
    subject_id: int | None = None


class TeacherScheduleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    period_id: int
    period_name: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    weekday: int
    class_id: int | None
    class_name: str | None = None
    subject_id: int | None
    subject_name: str | None = None
    created_at: datetime
    updated_at: datetime


# Memo Schemas
class MemoCreate(BaseModel):
    title: str
    description: str | None = None
    priority: str = "medium"  # high/medium/low
    category: str | None = None
    due_date: date | None = None


class MemoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    category: str | None = None
    status: str | None = None
    due_date: date | None = None


class MemoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    teacher_id: int
    title: str
    description: str | None
    priority: str
    category: str | None
    status: str
    due_date: date | None
    created_at: datetime
    updated_at: datetime


# DailyQuote Schemas
class DailyQuoteResponse(BaseModel):
    content: str
    source: str | None = None
