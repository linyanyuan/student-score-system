from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_admin
from app.models.class_ import Class
from app.models.school import School
from app.models.student import Student
from app.models.user import User
from app.routers.auth import _to_user_response
from app.schemas.auth import UserResponse, RoleEnum
from app.utils.security import hash_password

router = APIRouter(prefix="/api/accounts", tags=["account management"])


class CreateAccountRequest(BaseModel):
    username: str
    password: str
    role: RoleEnum
    school_id: int
    student_id: int | None = None

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("password must be at least 6 characters")
        return v


class UpdateAccountRequest(BaseModel):
    username: str | None = None
    password: str | None = None
    role: RoleEnum | None = None
    school_id: int | None = None
    student_id: int | None = None

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) < 6:
            raise ValueError("password must be at least 6 characters")
        return v


class BatchDeleteRequest(BaseModel):
    ids: list[int]


def _validate_student_binding(
    role: str,
    student_id: int | None,
    existing_user_id: int | None,
    db: Session,
    school_id: int | None = None,
) -> None:
    if role != "student":
        if student_id is not None:
            raise HTTPException(status_code=400, detail="only student accounts can bind a student profile")
        return

    if student_id is None:
        return

    student_query = db.query(Student).filter(Student.id == student_id)
    if school_id is not None:
        student_query = (
            student_query.join(Class, Class.id == Student.class_id)
            .filter(Class.school_id == school_id)
        )
    student = student_query.first()
    if student is None:
        raise HTTPException(status_code=400, detail="student profile does not exist")

    existing_query = db.query(User).filter(User.student_id == student_id)
    if existing_user_id is not None:
        existing_query = existing_query.filter(User.id != existing_user_id)
    if existing_query.first() is not None:
        raise HTTPException(status_code=400, detail="student profile is already bound to another account")


@router.get("", response_model=list[UserResponse])
def list_accounts(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
    keyword: str | None = None,
):
    query = db.query(User).filter(User.role != "admin")
    if keyword:
        query = query.filter(User.username.contains(keyword))
    return [_to_user_response(user, db) for user in query.order_by(User.id).all()]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_account(req: CreateAccountRequest, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已存在")
    if not db.query(School).filter(School.id == req.school_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="school does not exist")

    _validate_student_binding(
        role=req.role.value,
        student_id=req.student_id,
        existing_user_id=None,
        db=db,
        school_id=req.school_id,
    )

    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        role=req.role.value,
        school_id=req.school_id,
        student_id=req.student_id if req.role == RoleEnum.student else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_user_response(user, db)


@router.put("/{user_id}", response_model=UserResponse)
def update_account(user_id: int, req: UpdateAccountRequest, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.role != "admin").first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="account does not exist")

    if req.username and req.username != user.username:
        if db.query(User).filter(User.username == req.username).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已存在")

    effective_school_id = req.school_id if req.school_id is not None else user.school_id
    if effective_school_id is not None and not db.query(School).filter(School.id == effective_school_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="school does not exist")

    effective_role = req.role.value if req.role is not None else user.role
    if "student_id" in req.model_fields_set:
        effective_student_id = req.student_id
    elif effective_role != "student":
        effective_student_id = None
    else:
        effective_student_id = user.student_id

    _validate_student_binding(
        role=effective_role,
        student_id=effective_student_id,
        existing_user_id=user.id,
        db=db,
        school_id=effective_school_id,
    )

    if req.username and req.username != user.username:
        user.username = req.username
    if req.password:
        user.password_hash = hash_password(req.password)
    if req.role is not None:
        user.role = req.role.value
    if req.school_id is not None:
        user.school_id = req.school_id
    user.student_id = effective_student_id

    db.commit()
    db.refresh(user)
    return _to_user_response(user, db)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(user_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.role != "admin").first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="account does not exist")
    db.delete(user)
    db.commit()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def batch_delete_accounts(req: BatchDeleteRequest, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    db.query(User).filter(User.id.in_(req.ids), User.role != "admin").delete(synchronize_session=False)
    db.commit()
