from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_admin
from app.models.school import School
from app.models.user import User
from app.schemas.school import SchoolCreate, SchoolUpdate, SchoolResponse

router = APIRouter(prefix="/api/schools", tags=["学校管理"])


@router.get("", response_model=list[SchoolResponse])
def list_schools(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    return db.query(School).order_by(School.id).all()


@router.post("", response_model=SchoolResponse, status_code=status.HTTP_201_CREATED)
def create_school(req: SchoolCreate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    school = School(**req.model_dump())
    db.add(school)
    db.commit()
    db.refresh(school)
    return school


@router.put("/{school_id}", response_model=SchoolResponse)
def update_school(school_id: int, req: SchoolUpdate, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="学校不存在")
    for field, value in req.model_dump(exclude_unset=True).items():
        setattr(school, field, value)
    db.commit()
    db.refresh(school)
    return school


@router.delete("/{school_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_school(school_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="学校不存在")
    # 检查是否有关联用户
    from app.models.user import User as UserModel
    if db.query(UserModel).filter(UserModel.school_id == school_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该学校下存在账户，无法删除")
    db.delete(school)
    db.commit()
