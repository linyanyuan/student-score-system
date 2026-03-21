from pydantic import BaseModel


class ClassCreate(BaseModel):
    name: str
    grade: str
    school_id: int | None = None


class ClassUpdate(BaseModel):
    name: str | None = None
    grade: str | None = None


class ClassResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    grade: str
    school_id: int | None = None
