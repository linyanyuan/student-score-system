from pydantic import BaseModel


class TeacherClassCreate(BaseModel):
    teacher_id: int
    class_id: int


class TeacherClassResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: int
    teacher_id: int
    class_id: int


class TeacherClassSubjectBatchCreate(BaseModel):
    teacher_id: int
    subject_id: int
    class_ids: list[int]
    replace_existing: bool = False


class TeacherClassSubjectResponse(BaseModel):
    id: int
    teacher_id: int
    teacher_name: str | None = None
    class_id: int
    class_name: str | None = None
    subject_id: int
    subject_name: str | None = None
