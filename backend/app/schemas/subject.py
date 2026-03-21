from typing import Optional
from pydantic import BaseModel

_UNSET = object()


class SubjectCreate(BaseModel):
    name: str
    code: str
    grades: Optional[str] = None  # 逗号分隔的年级
    school_id: int | None = None


class SubjectUpdate(BaseModel):
    model_config = {"from_attributes": True}

    name: str | None = None
    code: str | None = None
    grades: str | None = None  # None 表示清空年级


class SubjectResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    code: str
    grades: Optional[str] = None
