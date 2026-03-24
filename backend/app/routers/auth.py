from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user, require_admin
from app.models.student import Student
from app.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, UserResponse, TokenResponse
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
