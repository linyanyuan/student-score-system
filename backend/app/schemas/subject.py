from pydantic import BaseModel


class SubjectCreate(BaseModel):
    name: str
    code: str


class SubjectUpdate(BaseModel):
    name: str | None = None
    code: str | None = None


class SubjectResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    name: str
    code: str
