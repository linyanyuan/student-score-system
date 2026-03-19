from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_admin
from app.models.teacher_class import TeacherClass
from app.models.user import User
from app.models.class_ import Class
from app.schemas.teacher_class import TeacherClassCreate, TeacherClassResponse

router = APIRouter(prefix="/api/teacher-classes", tags=["教师-班级分配"])


@router.get("", response_model=list[TeacherClassResponse])
def list_teacher_classes(
    teacher_id: int | None = None,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(TeacherClass)
    if teacher_id is not None:
        query = query.filter(TeacherClass.teacher_id == teacher_id)
    return query.all()


@router.post("", response_model=TeacherClassResponse, status_code=status.HTTP_201_CREATED)
def create_teacher_class(
    req: TeacherClassCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    teacher = db.query(User).filter(User.id == req.teacher_id, User.role == "teacher").first()
    if not teacher:
        raise HTTPException(status_code=400, detail="教师不存在")
    cls = db.query(Class).filter(Class.id == req.class_id).first()
    if not cls:
        raise HTTPException(status_code=400, detail="班级不存在")
    existing = db.query(TeacherClass).filter(
        TeacherClass.teacher_id == req.teacher_id,
        TeacherClass.class_id == req.class_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该教师已分配到此班级")
    obj = TeacherClass(teacher_id=req.teacher_id, class_id=req.class_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{tc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_teacher_class(
    tc_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    obj = db.query(TeacherClass).filter(TeacherClass.id == tc_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="关联记录不存在")
    db.delete(obj)
    db.commit()
