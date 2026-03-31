from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.dependencies import get_db, normalize_role, require_admin_or_school_admin
from app.models.class_ import Class
from app.models.school import School
from app.models.student import Student
from app.models.user import User
from app.routers.auth import _to_user_response
from app.schemas.auth import RoleEnum, UserResponse
from app.utils.security import hash_password

router = APIRouter(prefix="/api/accounts", tags=["account management"])

ROLE_VALUES_BY_CANONICAL = {
    "admin": ("admin", "管理员"),
    "school_admin": ("school_admin", "school-admin", "schooladmin", "school admin", "学校管理员"),
    "teacher": ("teacher", "教师"),
    "student": ("student", "学生"),
}
SCHOOL_ADMIN_MANAGEABLE_ROLES = {"teacher", "student"}
MANAGEABLE_ROLE_VALUES = tuple(
    {
        *ROLE_VALUES_BY_CANONICAL["teacher"],
        *ROLE_VALUES_BY_CANONICAL["student"],
    }
)


class CreateAccountRequest(BaseModel):
    username: str
    password: str
    role: RoleEnum
    school_id: int | None = None
    student_id: int | None = None

    @field_validator("password")
    @classmethod
    def password_min_length(cls, value: str) -> str:
        if len(value) < 6:
            raise ValueError("password must be at least 6 characters")
        return value


class UpdateAccountRequest(BaseModel):
    username: str | None = None
    password: str | None = None
    role: RoleEnum | None = None
    school_id: int | None = None
    student_id: int | None = None

    @field_validator("password")
    @classmethod
    def password_min_length(cls, value: str | None) -> str | None:
        if value is not None and len(value) < 6:
            raise ValueError("password must be at least 6 characters")
        return value


class BatchDeleteRequest(BaseModel):
    ids: list[int]


def _ensure_school_admin_role_scope(current_user: User, target_role: str) -> None:
    if normalize_role(current_user.role) != "school_admin":
        return
    if target_role not in SCHOOL_ADMIN_MANAGEABLE_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="school admin can only manage teacher and student accounts",
        )


def _resolve_effective_school_id(current_user: User, requested_school_id: int | None) -> int | None:
    current_role = normalize_role(current_user.role)
    if current_role == "admin":
        return requested_school_id

    if current_role != "school_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="insufficient permission")

    if current_user.school_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="school admin account is missing school binding")

    if requested_school_id is not None and requested_school_id != current_user.school_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="cannot manage accounts outside current school")

    return current_user.school_id


def _query_manageable_accounts(current_user: User, db: Session):
    query = db.query(User).filter(~User.role.in_(ROLE_VALUES_BY_CANONICAL["admin"]))
    if normalize_role(current_user.role) == "school_admin":
        query = query.filter(
            User.school_id == current_user.school_id,
            User.role.in_(MANAGEABLE_ROLE_VALUES),
        )
    return query


def _get_manageable_account(user_id: int, current_user: User, db: Session) -> User:
    user = _query_manageable_accounts(current_user, db).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="account does not exist")
    return user


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
        student_query = student_query.join(Class, Class.id == Student.class_id).filter(Class.school_id == school_id)
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
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
    keyword: str | None = None,
):
    query = _query_manageable_accounts(current_user, db)
    if keyword:
        query = query.filter(User.username.contains(keyword))
    return [_to_user_response(user, db) for user in query.order_by(User.id).all()]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_account(
    req: CreateAccountRequest,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已存在")

    effective_role = normalize_role(req.role.value)
    _ensure_school_admin_role_scope(current_user, effective_role)

    effective_school_id = _resolve_effective_school_id(current_user, req.school_id)
    if effective_school_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="school is required")
    if not db.query(School).filter(School.id == effective_school_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="school does not exist")

    _validate_student_binding(
        role=effective_role,
        student_id=req.student_id,
        existing_user_id=None,
        db=db,
        school_id=effective_school_id,
    )

    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        role=effective_role,
        school_id=effective_school_id,
        student_id=req.student_id if effective_role == RoleEnum.student.value else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_user_response(user, db)


@router.put("/{user_id}", response_model=UserResponse)
def update_account(
    user_id: int,
    req: UpdateAccountRequest,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    user = _get_manageable_account(user_id, current_user, db)

    if req.username and req.username != user.username:
        if db.query(User).filter(User.username == req.username).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已存在")

    effective_role = normalize_role(req.role.value if req.role is not None else user.role)
    _ensure_school_admin_role_scope(current_user, effective_role)

    requested_school_id = req.school_id if req.school_id is not None else user.school_id
    effective_school_id = _resolve_effective_school_id(current_user, requested_school_id)
    if effective_school_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="school is required")
    if not db.query(School).filter(School.id == effective_school_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="school does not exist")

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

    user.school_id = effective_school_id
    user.student_id = effective_student_id

    db.commit()
    db.refresh(user)
    return _to_user_response(user, db)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    user_id: int,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    user = _get_manageable_account(user_id, current_user, db)
    db.delete(user)
    db.commit()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def batch_delete_accounts(
    req: BatchDeleteRequest,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    query = _query_manageable_accounts(current_user, db).filter(User.id.in_(req.ids))
    query.delete(synchronize_session=False)
    db.commit()
