from datetime import datetime

from pydantic import BaseModel, field_validator


class CustomFieldCreate(BaseModel):
    field_name: str
    field_type: str
    options: str | None = None
    sort_order: int = 0
    school_id: int | None = None

    @field_validator("field_type")
    @classmethod
    def validate_field_type(cls, v: str) -> str:
        if v not in ("text", "number", "date", "select"):
            raise ValueError("字段类型必须为 text/number/date/select")
        return v


class CustomFieldUpdate(BaseModel):
    field_name: str | None = None
    field_type: str | None = None
    options: str | None = None
    sort_order: int | None = None

    @field_validator("field_type")
    @classmethod
    def validate_field_type(cls, v: str | None) -> str | None:
        if v is not None and v not in ("text", "number", "date", "select"):
            raise ValueError("字段类型必须为 text/number/date/select")
        return v


class CustomFieldResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    field_name: str
    field_type: str
    options: str | None = None
    sort_order: int
    created_at: datetime
