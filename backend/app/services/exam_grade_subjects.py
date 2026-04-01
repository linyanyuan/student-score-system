from collections import OrderedDict

from sqlalchemy.orm import Session

from app.models.exam_grade_subject import ExamGradeSubject
from app.models.subject import Subject


def parse_grade_tokens(raw: str | None) -> list[str]:
    if not raw:
        return []
    normalized = str(raw).replace("，", ",").replace("、", ",")
    return [part.strip() for part in normalized.split(",") if part and part.strip()]


def parse_grade_set(raw: str | None) -> set[str]:
    return set(parse_grade_tokens(raw))


def subject_applies_to_grade(subject_grades: str | None, grade: str | None) -> bool:
    if not grade:
        return False
    supported_grades = parse_grade_set(subject_grades)
    if not supported_grades:
        return True
    return grade in supported_grades


def load_exam_grade_subject_map(db: Session, exam_id: int) -> dict[str, list[int]]:
    rows = (
        db.query(ExamGradeSubject)
        .filter(ExamGradeSubject.exam_id == exam_id)
        .order_by(ExamGradeSubject.id.asc())
        .all()
    )
    mapping: OrderedDict[str, list[int]] = OrderedDict()
    for row in rows:
        mapping.setdefault(row.grade, []).append(int(row.subject_id))
    return dict(mapping)


def load_exam_subjects_for_grade(
    db: Session,
    exam_id: int,
    grade: str,
    school_id: int | None = None,
) -> list[Subject]:
    subject_ids = load_exam_grade_subject_map(db, exam_id).get(grade, [])
    if not subject_ids:
        return []

    query = db.query(Subject).filter(Subject.id.in_(subject_ids))
    if school_id is not None:
        query = query.filter(Subject.school_id == school_id)
    subjects = query.all()
    subject_map = {int(subject.id): subject for subject in subjects}
    return [subject_map[subject_id] for subject_id in subject_ids if subject_id in subject_map]
