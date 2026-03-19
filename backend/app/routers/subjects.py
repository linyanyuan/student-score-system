from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user, require_admin
from app.models.subject import Subject
from app.models.user import User
from app.schemas.subject import SubjectCreate, SubjectUpdate, SubjectResponse

router = APIRouter(prefix="/api/subjects", tags=["科目管理"])


@router.get("", response_model=list[SubjectResponse])
def list_subjects(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Subject).all()


@router.post("", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    req: SubjectCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.query(Subject).filter(Subject.name == req.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="科目名称已存在")
    obj = Subject(name=req.name, code=req.code)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{subject_id}", response_model=SubjectResponse)
def update_subject(
    subject_id: int,
    req: SubjectUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    obj = db.query(Subject).filter(Subject.id == subject_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="科目不存在")
    if req.name is not None:
        dup = db.query(Subject).filter(Subject.name == req.name, Subject.id != subject_id).first()
        if dup:
            raise HTTPException(status_code=400, detail="科目名称已存在")
        obj.name = req.name
    if req.code is not None:
        obj.code = req.code
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subject(
    subject_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    obj = db.query(Subject).filter(Subject.id == subject_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="科目不存在")
    db.delete(obj)
    db.commit()
