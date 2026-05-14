from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, get_user_school_id, normalize_role
from app.models.class_ import Class
from app.models.exam import Exam
from app.models.school_notice import SchoolNotice
from app.models.school_notice_recipient import SchoolNoticeRecipient
from app.models.student import Student
from app.models.teacher_class import TeacherClass
from app.models.total_rank import TotalRank
from app.models.user import User
from app.schemas.overview import (
    OverviewClassSummary,
    OverviewExamInfo,
    OverviewGradeSummary,
    OverviewResponse,
)

router = APIRouter(prefix="/api/overview", tags=["我的概览"])


@router.get("/my", response_model=OverviewResponse)
def get_my_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = normalize_role(current_user.role)
    school_id = get_user_school_id(current_user)
    class_rows = _overview_classes(current_user, db)
    class_ids = [row.id for row in class_rows]
    latest_exam = _latest_exam(db, school_id)
    student_count = _student_count(db, class_ids)
    notice_count = _notice_count(current_user, db)

    if role == "teacher":
        return OverviewResponse(
            role=role,
            class_count=len(class_rows),
            student_count=student_count,
            notice_count=notice_count,
            latest_exam=_exam_info(latest_exam),
            class_summaries=_class_summaries(db, class_rows, latest_exam),
            grade_summaries=[],
        )

    return OverviewResponse(
        role=role,
        class_count=len(class_rows),
        student_count=student_count,
        notice_count=notice_count,
        latest_exam=_exam_info(latest_exam),
        class_summaries=[],
        grade_summaries=_grade_summaries(db, class_rows, latest_exam),
    )


def _overview_classes(current_user: User, db: Session) -> list[Class]:
    role = normalize_role(current_user.role)
    query = db.query(Class)
    if role == "teacher":
        query = query.join(TeacherClass, TeacherClass.class_id == Class.id).filter(
            TeacherClass.teacher_id == current_user.id,
        )
    elif role == "student":
        if current_user.student_id is None:
            return []
        student = db.query(Student).filter(Student.id == current_user.student_id).first()
        if student is None:
            return []
        query = query.filter(Class.id == student.class_id)
    elif current_user.school_id is not None:
        query = query.filter(Class.school_id == current_user.school_id)
    return query.order_by(Class.grade.asc(), Class.name.asc()).all()


def _notice_count(current_user: User, db: Session) -> int:
    role = normalize_role(current_user.role)
    if role in ("admin", "school_admin"):
        query = db.query(func.count(SchoolNotice.id))
        if current_user.school_id is not None:
            query = query.filter(SchoolNotice.school_id == current_user.school_id)
        return query.scalar() or 0
    return (
        db.query(func.count(SchoolNoticeRecipient.id))
        .filter(
            SchoolNoticeRecipient.teacher_id == current_user.id,
            SchoolNoticeRecipient.is_read.is_(False),
        )
        .scalar()
        or 0
    )


def _latest_exam(db: Session, school_id: int | None) -> Exam | None:
    query = db.query(Exam)
    if school_id is not None:
        query = query.filter(Exam.school_id == school_id)
    return query.order_by(Exam.exam_date.desc(), Exam.id.desc()).first()


def _student_count(db: Session, class_ids: list[int]) -> int:
    if not class_ids:
        return 0
    return db.query(func.count(Student.id)).filter(Student.class_id.in_(class_ids)).scalar() or 0


def _exam_info(exam: Exam | None) -> OverviewExamInfo | None:
    if exam is None:
        return None
    return OverviewExamInfo(id=exam.id, name=exam.name)


def _class_summaries(
    db: Session,
    class_rows: list[Class],
    latest_exam: Exam | None,
) -> list[OverviewClassSummary]:
    if latest_exam is None:
        return []
    student_counts = _student_counts_by_class(db, [row.id for row in class_rows])
    summaries: list[OverviewClassSummary] = []
    for class_row in class_rows:
        avg_score = (
            db.query(func.avg(TotalRank.total_score))
            .join(Student, Student.id == TotalRank.student_id)
            .filter(
                TotalRank.exam_id == latest_exam.id,
                Student.class_id == class_row.id,
            )
            .scalar()
        )
        if avg_score is None:
            continue
        summaries.append(
            OverviewClassSummary(
                class_id=class_row.id,
                class_name=class_row.name,
                grade=class_row.grade,
                student_count=student_counts.get(class_row.id, 0),
                average_score=round(float(avg_score), 2),
            )
        )
    return summaries


def _student_counts_by_class(db: Session, class_ids: list[int]) -> dict[int, int]:
    if not class_ids:
        return {}
    rows = (
        db.query(Student.class_id, func.count(Student.id))
        .filter(Student.class_id.in_(class_ids))
        .group_by(Student.class_id)
        .all()
    )
    return {class_id: count for class_id, count in rows if class_id is not None}


def _grade_summaries(
    db: Session,
    class_rows: list[Class],
    latest_exam: Exam | None,
) -> list[OverviewGradeSummary]:
    if latest_exam is None or not class_rows:
        return []
    class_grade_map = {row.id: row.grade for row in class_rows}
    rows = (
        db.query(Student.class_id, TotalRank.total_score)
        .join(TotalRank, TotalRank.student_id == Student.id)
        .filter(
            TotalRank.exam_id == latest_exam.id,
            Student.class_id.in_(class_grade_map.keys()),
        )
        .all()
    )
    scores_by_grade: dict[str, list[float]] = {}
    for class_id, total_score in rows:
        grade = class_grade_map.get(class_id)
        if not grade:
            continue
        scores_by_grade.setdefault(grade, []).append(float(total_score))
    summaries = [
        OverviewGradeSummary(
            grade=grade,
            average_score=round(sum(scores) / len(scores), 2),
        )
        for grade, scores in scores_by_grade.items()
        if scores
    ]
    return sorted(summaries, key=lambda item: item.average_score, reverse=True)
