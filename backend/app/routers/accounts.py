from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_admin
from app.models.school import School
from app.models.user import User
from app.schemas.auth import UserResponse, RoleEnum
from app.utils.security import hash_password

router = APIRouter(prefix="/api/accounts", tags=["账户管理"])


class CreateAccountRequest(BaseModel):
    username: str
    password: str
    role: RoleEnum
    school_id: int

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("密码长度至少为6位")
        return v


class UpdateAccountRequest(BaseModel):
    username: str | None = None
    password: str | None = None
    role: RoleEnum | None = None
    school_id: int | None = None

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) < 6:
            raise ValueError("密码长度至少为6位")
        return v


class BatchDeleteRequest(BaseModel):
    ids: list[int]


@router.get("", response_model=list[UserResponse])
def list_accounts(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
    keyword: str | None = None,
):
    query = db.query(User).filter(User.role != "admin")
    if keyword:
        query = query.filter(User.username.contains(keyword))
    return query.order_by(User.id).all()


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_account(req: CreateAccountRequest, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == req.username).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在")
    if not db.query(School).filter(School.id == req.school_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="学校不存在")
    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        role=req.role.value,
        school_id=req.school_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_account(user_id: int, req: UpdateAccountRequest, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.role != "admin").first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="账户不存在")
    if req.username and req.username != user.username:
        if db.query(User).filter(User.username == req.username).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="用户名已存在")
        user.username = req.username
    if req.password:
        user.password_hash = hash_password(req.password)
    if req.role:
        user.role = req.role.value
    if req.school_id is not None:
        if not db.query(School).filter(School.id == req.school_id).first():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="学校不存在")
        user.school_id = req.school_id
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(user_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id, User.role != "admin").first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="账户不存在")
    db.delete(user)
    db.commit()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def batch_delete_accounts(req: BatchDeleteRequest, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    db.query(User).filter(User.id.in_(req.ids), User.role != "admin").delete(synchronize_session=False)
    db.commit()
