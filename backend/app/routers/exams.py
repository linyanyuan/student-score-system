from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, get_user_school_id, require_admin_or_school_admin
from app.models.exam import Exam
from app.models.exam_grade_subject import ExamGradeSubject
from app.models.score import Score
from app.models.subject import Subject
from app.models.user import User
from app.schemas.exam import (
    ExamCreate,
    ExamGradeSubjectConfig,
    ExamGradeSubjectConfigResponse,
    ExamGradeSubjectSubjectResponse,
    ExamResponse,
    ExamUpdate,
)
from app.services.exam_grade_subjects import load_exam_grade_subject_map, parse_grade_tokens, subject_applies_to_grade

router = APIRouter(prefix="/api/exams", tags=["考试管理"])


def _build_exam_response(db: Session, exam: Exam, school_id: int | None) -> ExamResponse:
    grade_subject_map = load_exam_grade_subject_map(db, exam.id)
    all_subject_ids = sorted({subject_id for ids in grade_subject_map.values() for subject_id in ids})
    subject_map: dict[int, Subject] = {}
    if all_subject_ids:
        query = db.query(Subject).filter(Subject.id.in_(all_subject_ids))
        if school_id is not None:
            query = query.filter(Subject.school_id == school_id)
        subject_map = {int(subject.id): subject for subject in query.all()}

    grade_subjects = [
        ExamGradeSubjectConfigResponse(
            grade=grade,
            subject_ids=subject_ids,
            subjects=[
                ExamGradeSubjectSubjectResponse(id=subject.id, name=subject.name)
                for subject_id in subject_ids
                if (subject := subject_map.get(subject_id)) is not None
            ],
        )
        for grade, subject_ids in grade_subject_map.items()
    ]

    return ExamResponse(
        id=exam.id,
        name=exam.name,
        exam_date=exam.exam_date,
        grade=exam.grade,
        description=exam.description,
        grade_subjects=grade_subjects,
    )


def _validate_grade_subjects(
    db: Session,
    grade_value: str,
    grade_subjects_payload: list[ExamGradeSubjectConfig],
    school_id: int | None,
) -> list[tuple[str, list[int]]]:
    selected_grades = parse_grade_tokens(grade_value)
    if not selected_grades:
        raise HTTPException(status_code=400, detail="至少选择一个参与年级")

    payload_by_grade = {
        item.grade: list(dict.fromkeys(item.subject_ids or []))
        for item in grade_subjects_payload
    }

    missing_grades = [grade for grade in selected_grades if not payload_by_grade.get(grade)]
    if missing_grades:
        raise HTTPException(status_code=400, detail=f"请为以下年级选择考试科目: {', '.join(missing_grades)}")

    extra_grades = [grade for grade in payload_by_grade if grade not in selected_grades]
    if extra_grades:
        raise HTTPException(status_code=400, detail="年级科目配置包含未参与考试的年级")

    subject_ids = sorted({subject_id for ids in payload_by_grade.values() for subject_id in ids})
    query = db.query(Subject).filter(Subject.id.in_(subject_ids))
    if school_id is not None:
        query = query.filter(Subject.school_id == school_id)
    subjects = {int(subject.id): subject for subject in query.all()}

    normalized_payload: list[tuple[str, list[int]]] = []
    for grade in selected_grades:
        normalized_ids: list[int] = []
        for subject_id in payload_by_grade[grade]:
            subject = subjects.get(subject_id)
            if subject is None:
                raise HTTPException(status_code=400, detail="考试科目不存在或不属于当前学校")
            if not subject_applies_to_grade(subject.grades, grade):
                raise HTTPException(status_code=400, detail=f"科目 {subject.name} 不适用于 {grade}")
            normalized_ids.append(subject_id)
        normalized_payload.append((grade, normalized_ids))

    return normalized_payload


def _replace_exam_grade_subjects(db: Session, exam_id: int, normalized_payload: list[tuple[str, list[int]]]) -> None:
    db.query(ExamGradeSubject).filter(ExamGradeSubject.exam_id == exam_id).delete(synchronize_session=False)
    for grade, subject_ids in normalized_payload:
        for subject_id in subject_ids:
            db.add(ExamGradeSubject(exam_id=exam_id, grade=grade, subject_id=subject_id))


@router.get("", response_model=list[ExamResponse])
def list_exams(
    grade: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Exam)
    school_id = get_user_school_id(current_user)
    if school_id is not None:
        query = query.filter(Exam.school_id == school_id)
    if grade:
        query = query.filter(Exam.grade == grade)
    exams = query.order_by(Exam.exam_date.desc()).all()
    return [_build_exam_response(db, exam, school_id) for exam in exams]


@router.post("", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
def create_exam(
    req: ExamCreate,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)
    filter_school_id = school_id if school_id is not None else req.school_id
    normalized_grade_subjects = _validate_grade_subjects(db, req.grade, req.grade_subjects, filter_school_id)

    obj = Exam(
        name=req.name,
        exam_date=req.exam_date,
        grade=req.grade,
        description=req.description,
        school_id=filter_school_id,
    )
    db.add(obj)
    db.flush()
    _replace_exam_grade_subjects(db, obj.id, normalized_grade_subjects)
    db.commit()
    db.refresh(obj)
    return _build_exam_response(db, obj, filter_school_id)


@router.put("/{exam_id}", response_model=ExamResponse)
def update_exam(
    exam_id: int,
    req: ExamUpdate,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)
    query = db.query(Exam).filter(Exam.id == exam_id)
    if school_id is not None:
        query = query.filter(Exam.school_id == school_id)
    obj = query.first()
    if not obj:
        raise HTTPException(status_code=404, detail="考试不存在")

    next_grade = req.grade if req.grade is not None else obj.grade
    existing_grade_subjects = [
        ExamGradeSubjectConfig(grade=grade, subject_ids=subject_ids)
        for grade, subject_ids in load_exam_grade_subject_map(db, obj.id).items()
    ]
    next_grade_subjects = req.grade_subjects if req.grade_subjects is not None else existing_grade_subjects
    normalized_grade_subjects = _validate_grade_subjects(db, next_grade, next_grade_subjects, school_id)

    if req.name is not None:
        obj.name = req.name
    if req.exam_date is not None:
        obj.exam_date = req.exam_date
    if req.grade is not None:
        obj.grade = req.grade
    if req.description is not None:
        obj.description = req.description

    _replace_exam_grade_subjects(db, obj.id, normalized_grade_subjects)
    db.commit()
    db.refresh(obj)
    return _build_exam_response(db, obj, school_id)


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exam(
    exam_id: int,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)
    query = db.query(Exam).filter(Exam.id == exam_id)
    if school_id is not None:
        query = query.filter(Exam.school_id == school_id)
    obj = query.first()
    if not obj:
        raise HTTPException(status_code=404, detail="考试不存在")

    has_scores = db.query(Score).filter(Score.exam_id == exam_id).first()
    if has_scores:
        raise HTTPException(status_code=400, detail="该考试已有成绩记录，无法删除")

    db.query(ExamGradeSubject).filter(ExamGradeSubject.exam_id == exam_id).delete(synchronize_session=False)
    db.delete(obj)
    db.commit()
