from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class LessonPlanConfig(BaseModel):
    subject_id: int
    weekly_hours: int = Field(default=0, ge=0)
    daily_max_hours: int = Field(default=99, ge=0)
    preferred_session: Literal["any", "morning_prefer", "afternoon_prefer"] = "any"
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


class LessonPlanOverrideItem(BaseModel):
    class_id: int
    subject_id: int
    weekly_hours: int = Field(default=0, ge=0)
    daily_max_hours: int = Field(default=99, ge=0)
    preferred_session: Literal["any", "morning_prefer", "afternoon_prefer"] = "any"
    forbidden_periods: list[list[int]] = Field(default_factory=list)


class LessonPlanOverrideBatchSaveRequest(BaseModel):
    grade: str
    items: list[LessonPlanOverrideItem]


class LessonPlanOverrideBatchResponse(BaseModel):
    grade: str
    items: list[LessonPlanOverrideItem]


class TeacherConstraintItem(BaseModel):
    teacher_id: int
    daily_max_hours: int = Field(default=0, ge=0)
    forbidden_periods: list[list[int]] = Field(default_factory=list)
    preferred_periods: list[list[int]] = Field(default_factory=list)


class TeacherConstraintBatchSaveRequest(BaseModel):
    grade: str
    items: list[TeacherConstraintItem]


class TeacherConstraintBatchResponse(BaseModel):
    grade: str
    items: list[TeacherConstraintItem]


class TimetableLockItem(BaseModel):
    class_id: int
    subject_id: int
    teacher_id: int
    weekday: int = Field(ge=1, le=7)
    period_id: int = Field(gt=0)
    source: str = "manual"
    note: str = ""


class TimetableLockBatchSaveRequest(BaseModel):
    grade: str
    items: list[TimetableLockItem]


class TimetableLockBatchResponse(BaseModel):
    grade: str
    items: list[TimetableLockItem]


class PeriodPlanSaveRequest(BaseModel):
    grade: str
    period_ids: list[int] = Field(default_factory=list)


class PeriodPlanResponse(BaseModel):
    grade: str
    period_ids: list[int] = Field(default_factory=list)


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


class DraftDiagnostic(BaseModel):
    code: str
    message: str
    blocking: bool = True
    entity: dict[str, Any] = Field(default_factory=dict)


class DraftPublishCheck(BaseModel):
    code: str
    message: str
    blocking: bool = True
    entity: dict[str, Any] = Field(default_factory=dict)


class DraftSummaryPayload(BaseModel):
    hard_pass_rate: int = 0
    score: int = 0
    locked_hits: int = 0
    locked_total: int = 0
    risk_count: int = 0


class ScheduleDraftResponse(BaseModel):
    id: int
    grade: str
    status: str
    score: int | None = None
    summary: DraftSummaryPayload = Field(default_factory=DraftSummaryPayload)
    diagnostics: list[DraftDiagnostic] = Field(default_factory=list)
    publish_checks: list[DraftPublishCheck] = Field(default_factory=list)
    published_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DraftItem(BaseModel):
    weekday: int
    period_id: int
    period_name: str | None = None
    class_id: int
    class_name: str | None = None
    subject_id: int
    subject_name: str | None = None
    teacher_id: int
    teacher_name: str | None = None
    is_locked: bool = False
    penalty_tags: list[str] = Field(default_factory=list)


class ScheduleDraftItemsResponse(BaseModel):
    items: list[DraftItem] = Field(default_factory=list)


class PublishDraftResponse(BaseModel):
    draft_id: int
    status: str
    rows: int


class ScheduleImportSummary(BaseModel):
    total_slots: int = 0
    recognized_slots: int = 0
    unrecognized_subject_slots: int = 0
    teacher_unmatched_slots: int = 0
    teacher_ambiguous_slots: int = 0
    teacher_time_conflict_slots: int = 0
    manually_fixed_slots: int = 0


class ScheduleImportResponse(BaseModel):
    id: int
    grade: str
    scope: str
    class_id: int | None = None
    source_type: str
    status: str
    message: str | None = None
    error: str | None = None
    summary: ScheduleImportSummary = Field(default_factory=ScheduleImportSummary)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ScheduleImportItemResponse(BaseModel):
    id: int
    class_id: int
    class_name: str | None = None
    weekday: int
    period_id: int
    period_name: str | None = None
    subject_id: int | None = None
    subject_name: str | None = None
    recognized_subject_name: str | None = None
    teacher_id: int | None = None
    teacher_name: str | None = None
    teacher_match_status: str
    teacher_match_source: str
    teacher_candidates: list[dict[str, Any]] = Field(default_factory=list)
    confidence: float | None = None
    issue_flags: list[str] = Field(default_factory=list)
    conflict_items: list[dict[str, Any]] = Field(default_factory=list)
    is_empty: bool = False


class ScheduleImportItemsResponse(BaseModel):
    items: list[ScheduleImportItemResponse] = Field(default_factory=list)


class ScheduleImportItemUpdate(BaseModel):
    subject_id: int | None = None
    teacher_id: int | None = None
    is_empty: bool | None = None


class ScheduleImportDraftCreateResponse(BaseModel):
    import_id: int
    draft_id: int
    status: str


class TimetableItem(BaseModel):
    weekday: int
    period_id: int
    period_name: str | None = None
    period_start_time: str | None = None
    period_end_time: str | None = None
    class_id: int
    class_name: str | None = None
    subject_id: int
    subject_name: str | None = None
    teacher_id: int
    teacher_name: str | None = None


class TimetableResponse(BaseModel):
    items: list[TimetableItem]
