from datetime import datetime, date

from pydantic import BaseModel, field_validator


class StudentCreate(BaseModel):
    student_no: str
    name: str
    gender: str
    birth_date: date | None = None
    class_id: int
    phone: str | None = None
    custom_fields: str | None = None  # JSON string

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        if v not in ("M", "F"):
            raise ValueError("性别必须为 M 或 F")
        return v


class StudentUpdate(BaseModel):
    student_no: str | None = None
    name: str | None = None
    gender: str | None = None
    birth_date: date | None = None
    class_id: int | None = None
    phone: str | None = None
    custom_fields: str | None = None

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str | None) -> str | None:
        if v is not None and v not in ("M", "F"):
            raise ValueError("性别必须为 M 或 F")
        return v


class StudentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    student_no: str
    name: str
    gender: str
    birth_date: date | None = None
    class_id: int
    phone: str | None = None
    custom_fields: str | None = None
    created_at: datetime


class BatchDeleteRequest(BaseModel):
    ids: list[int]


class BatchDeleteResponse(BaseModel):
    deleted_count: int


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
