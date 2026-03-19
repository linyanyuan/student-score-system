from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user, require_admin
from app.models.class_ import Class
from app.models.student import Student
from app.models.user import User
from app.schemas.class_ import ClassCreate, ClassUpdate, ClassResponse

router = APIRouter(prefix="/api/classes", tags=["班级管理"])


@router.get("", response_model=list[ClassResponse])
def list_classes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "teacher":
        from app.models.teacher_class import TeacherClass
        class_ids = db.query(TeacherClass.class_id).filter(
            TeacherClass.teacher_id == current_user.id
        ).all()
        ids = [r[0] for r in class_ids]
        return db.query(Class).filter(Class.id.in_(ids)).all()
    return db.query(Class).all()


@router.post("", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
def create_class(
    req: ClassCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.query(Class).filter(Class.name == req.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="班级名称已存在")
    obj = Class(name=req.name, grade=req.grade)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{class_id}", response_model=ClassResponse)
def update_class(
    class_id: int,
    req: ClassUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    obj = db.query(Class).filter(Class.id == class_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="班级不存在")
    if req.name is not None:
        dup = db.query(Class).filter(Class.name == req.name, Class.id != class_id).first()
        if dup:
            raise HTTPException(status_code=400, detail="班级名称已存在")
        obj.name = req.name
    if req.grade is not None:
        obj.grade = req.grade
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_class(
    class_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    obj = db.query(Class).filter(Class.id == class_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="班级不存在")
    has_students = db.query(Student).filter(Student.class_id == class_id).first()
    if has_students:
        raise HTTPException(status_code=400, detail="该班级下有学生，无法删除")
    db.delete(obj)
    db.commit()
