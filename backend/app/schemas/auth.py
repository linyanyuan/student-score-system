from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, field_validator


class RoleEnum(str, Enum):
    school_admin = "school_admin"
    teacher = "teacher"
    student = "student"


class RegisterRequest(BaseModel):
    username: str
    password: str
    role: RoleEnum
    school_id: int | None = None

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("密码长度至少为6位")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str
    school_id: int | None = None
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
