from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user, require_admin
from app.models.exam import Exam
from app.models.score import Score
from app.models.user import User
from app.schemas.exam import ExamCreate, ExamUpdate, ExamResponse

router = APIRouter(prefix="/api/exams", tags=["考试管理"])


@router.get("", response_model=list[ExamResponse])
def list_exams(
    grade: str | None = None,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Exam)
    if grade:
        query = query.filter(Exam.grade == grade)
    return query.order_by(Exam.exam_date.desc()).all()


@router.post("", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
def create_exam(
    req: ExamCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    obj = Exam(name=req.name, exam_date=req.exam_date, grade=req.grade, description=req.description)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{exam_id}", response_model=ExamResponse)
def update_exam(
    exam_id: int,
    req: ExamUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    obj = db.query(Exam).filter(Exam.id == exam_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="考试不存在")
    if req.name is not None:
        obj.name = req.name
    if req.exam_date is not None:
        obj.exam_date = req.exam_date
    if req.grade is not None:
        obj.grade = req.grade
    if req.description is not None:
        obj.description = req.description
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exam(
    exam_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    obj = db.query(Exam).filter(Exam.id == exam_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="考试不存在")
    has_scores = db.query(Score).filter(Score.exam_id == exam_id).first()
    if has_scores:
        raise HTTPException(status_code=400, detail="该考试已有成绩记录，无法删除")
    db.delete(obj)
    db.commit()
