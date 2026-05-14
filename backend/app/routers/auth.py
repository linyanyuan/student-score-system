from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user, normalize_role, require_admin
from app.models.student import Student
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PasswordHelpAccount,
    PasswordHelpResponse,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.utils.security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _to_user_response(user: User, db: Session) -> UserResponse:
    student = None
    if user.student_id is not None:
        student = db.query(Student).filter(Student.id == user.student_id).first()

    return UserResponse(
        id=user.id,
        username=user.username,
        role=user.role,
        school_id=user.school_id,
        student_id=user.student_id,
        student_name=student.name if student else None,
        student_no=student.student_no if student else None,
        created_at=user.created_at,
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="username already registered",
        )

    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        role=req.role.value,
        school_id=req.school_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_user_response(user, db)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == req.username).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid username or password",
        )

    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    return TokenResponse(access_token=access_token)


@router.get("/password-help", response_model=PasswordHelpResponse)
def password_help(username: str, db: Session = Depends(get_db)):
    normalized_username = username.strip()
    if not normalized_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请输入账号",
        )

    user = db.query(User).filter(User.username == normalized_username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="账号不存在",
        )

    role = normalize_role(user.role)
    if role in ("admin", "school_admin"):
        return PasswordHelpResponse(
            kind="school_admin_self",
            message="系统只保存加密后的密码，无法查看当前明文密码。如忘记密码，请使用建校初始密码或联系平台管理员重置。",
            account=PasswordHelpAccount(
                username=user.username,
                role=user.role,
                school_id=user.school_id,
                password_hint="当前密码无法直接查看；请使用建校初始密码或联系平台管理员重置。",
            ),
            admins=[],
        )

    school_users = (
        db.query(User)
        .filter(User.school_id == user.school_id)
        .order_by(User.username.asc())
        .all()
    )
    admins = [
        school_user
        for school_user in school_users
        if normalize_role(school_user.role) == "school_admin"
    ]
    return PasswordHelpResponse(
        kind="school_admin_contacts",
        message="请联系本校学校管理员重置密码。",
        account=None,
        admins=[
            PasswordHelpAccount(
                username=admin.username,
                role=admin.role,
                school_id=admin.school_id,
            )
            for admin in admins
        ],
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _to_user_response(current_user, db)


@router.get("/teachers", response_model=list[UserResponse])
def list_teachers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.dependencies import get_user_school_id

    if current_user.role not in ("admin", "school_admin"):
        raise HTTPException(status_code=403, detail="admin or school_admin role required")

    query = db.query(User).filter(User.role == "teacher")
    school_id = get_user_school_id(current_user)
    if school_id is not None:
        query = query.filter(User.school_id == school_id)
    return [_to_user_response(user, db) for user in query.all()]
