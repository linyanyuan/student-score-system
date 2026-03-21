from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SchoolCreate(BaseModel):
    name: str
    location: str | None = None
    school_level: str  # primary / middle / high


class SchoolUpdate(BaseModel):
    name: str | None = None
    location: str | None = None
    school_level: str | None = None


class SchoolResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    location: str | None = None
    school_level: str
    created_at: datetime
