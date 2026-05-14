from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user, require_admin_or_school_admin, get_user_school_id
from app.models.class_ import Class
from app.models.student import Student
from app.models.teacher_class import TeacherClass
from app.models.user import User
from app.schemas.class_ import ClassCreate, ClassUpdate, ClassResponse

router = APIRouter(prefix="/api/classes", tags=["班级管理"])


@router.get("", response_model=list[ClassResponse])
def list_classes(
    scope: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Class)
    if current_user.role == "student":
        if current_user.student_id is None:
            return []
        bound_student = db.query(Student).filter(Student.id == current_user.student_id).first()
        if bound_student is None:
            return []
        return db.query(Class).filter(Class.id == bound_student.class_id).all()
    if current_user.role == "teacher":
        if scope == "analysis" and current_user.school_id is not None:
            grade_rows = (
                db.query(Class.grade)
                .join(TeacherClass, TeacherClass.class_id == Class.id)
                .filter(
                    TeacherClass.teacher_id == current_user.id,
                    Class.school_id == current_user.school_id,
                )
                .all()
            )
            grades = {row[0] for row in grade_rows if row[0]}
            if not grades:
                return []
            return db.query(Class).filter(
                Class.school_id == current_user.school_id,
                Class.grade.in_(grades),
            ).all()
        class_ids = db.query(TeacherClass.class_id).filter(
            TeacherClass.teacher_id == current_user.id
        ).all()
        ids = [r[0] for r in class_ids]
        return db.query(Class).filter(Class.id.in_(ids)).all()
    school_id = get_user_school_id(current_user)
    if school_id is not None:
        query = query.filter(Class.school_id == school_id)
    return query.all()


@router.post("", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
def create_class(
    req: ClassCreate,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)
    filter_school_id = school_id if school_id is not None else req.school_id
    existing = db.query(Class).filter(
        Class.name == req.name,
        Class.school_id == filter_school_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="班级名称已存在")
    obj = Class(name=req.name, grade=req.grade, school_id=filter_school_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{class_id}", response_model=ClassResponse)
def update_class(
    class_id: int,
    req: ClassUpdate,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)
    query = db.query(Class).filter(Class.id == class_id)
    if school_id is not None:
        query = query.filter(Class.school_id == school_id)
    obj = query.first()
    if not obj:
        raise HTTPException(status_code=404, detail="班级不存在")
    if req.name is not None:
        dup = db.query(Class).filter(
            Class.name == req.name,
            Class.school_id == obj.school_id,
            Class.id != class_id,
        ).first()
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
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)
    query = db.query(Class).filter(Class.id == class_id)
    if school_id is not None:
        query = query.filter(Class.school_id == school_id)
    obj = query.first()
    if not obj:
        raise HTTPException(status_code=404, detail="班级不存在")
    has_students = db.query(Student).filter(Student.class_id == class_id).first()
    if has_students:
        raise HTTPException(status_code=400, detail="该班级下有学生，无法删除")
    db.delete(obj)
    db.commit()
