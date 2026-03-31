from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User
from app.utils.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


ROLE_ALIASES = {
    "admin": {"admin", "管理员"},
    "school_admin": {"school_admin", "school-admin", "schooladmin", "school admin", "学校管理员"},
    "teacher": {"teacher", "教师"},
    "student": {"student", "学生"},
}


def normalize_role(value: str | None) -> str:
    raw = str(value or "").strip()
    lowered = raw.lower()
    for canonical, aliases in ROLE_ALIASES.items():
        if lowered in aliases or raw in aliases:
            return canonical
    return lowered


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(token)
        username: str | None = payload.get("sub")
        if username is None:
            raise ValueError("无效的认证凭据")
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证凭据",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if normalize_role(current_user.role) != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限",
        )
    return current_user


def require_admin_or_school_admin(current_user: User = Depends(get_current_user)) -> User:
    normalized = normalize_role(current_user.role)
    if normalized not in ("admin", "school_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员或学校管理员权限",
        )
    return current_user


def require_school_admin(current_user: User = Depends(get_current_user)) -> User:
    if normalize_role(current_user.role) != "school_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要学校管理员权限",
        )
    return current_user


def require_teacher_or_above(current_user: User = Depends(get_current_user)) -> User:
    if normalize_role(current_user.role) not in ("admin", "school_admin", "teacher"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要教师或以上权限",
        )
    return current_user


def require_teacher_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if normalize_role(current_user.role) not in ("admin", "school_admin", "teacher"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要教师或管理员权限",
        )
    return current_user


def get_user_school_id(current_user: User) -> int | None:
    """Return school_id for non-admin users, None for admin (no filter)."""
    if normalize_role(current_user.role) == "admin":
        return None
    return current_user.school_id


def get_accessible_class_ids(current_user: User, db: Session) -> list[int] | None:
    """Return list of class IDs accessible to the user, or None if all accessible (admin)."""
    normalized = normalize_role(current_user.role)
    if normalized == "admin":
        return None
    if normalized == "school_admin":
        from app.models.class_ import Class

        rows = db.query(Class.id).filter(Class.school_id == current_user.school_id).all()
        return [r[0] for r in rows]

    from app.models.teacher_class import TeacherClass

    rows = db.query(TeacherClass.class_id).filter(TeacherClass.teacher_id == current_user.id).all()
    return [r[0] for r in rows]
