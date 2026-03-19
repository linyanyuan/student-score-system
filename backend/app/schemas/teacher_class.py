from pydantic import BaseModel


class TeacherClassCreate(BaseModel):
    teacher_id: int
    class_id: int


class TeacherClassResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    teacher_id: int
    class_id: int
