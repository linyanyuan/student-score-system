from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, get_accessible_class_ids
from app.models.class_ import Class
from app.models.class_timetable import ClassTimetable
from app.models.schedule_period import SchedulePeriod
from app.models.student import Student
from app.models.subject import Subject
from app.models.user import User
from app.schemas.scheduling import TimetableItem, TimetableResponse

router = APIRouter(prefix="/api/timetable", tags=["timetable"])


_CHINESE_DIGITS = {
    "一": 1,
    "二": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
    "十": 10,
}


def _parse_chinese_number(value: str | None) -> int | None:
    if not value:
        return None
    if value == "十":
        return 10
    if "十" in value:
        left, right = value.split("十", 1)
        tens = _CHINESE_DIGITS.get(left, 1 if left == "" else None)
        ones = _CHINESE_DIGITS.get(right, 0 if right == "" else None)
        if tens is None or ones is None:
            return None
        return tens * 10 + ones
    return _CHINESE_DIGITS.get(value)


def _period_key(name: str | None) -> str:
    text = "".join(str(name or "").split())
    if text.startswith("第") and text.endswith("节"):
        middle = text[1:-1]
        if middle.isdigit():
            return f"lesson-{int(middle)}"
        parsed = _parse_chinese_number(middle)
        if parsed is not None:
            return f"lesson-{parsed}"
    if text.endswith("节"):
        middle = text[:-1]
        if middle.isdigit():
            return f"lesson-{int(middle)}"
        parsed = _parse_chinese_number(middle)
        if parsed is not None:
            return f"lesson-{parsed}"
    return text


def _school_period_alias_map(
    db: Session,
    rows: list[ClassTimetable],
    period_map: dict[int, SchedulePeriod],
) -> dict[int, SchedulePeriod]:
    school_ids = sorted({row.school_id for row in rows if row.school_id is not None})
    if not school_ids:
        return {}

    school_periods = (
        db.query(SchedulePeriod)
        .filter(SchedulePeriod.school_id.in_(school_ids))
        .order_by(SchedulePeriod.school_id.asc(), SchedulePeriod.sort_order.asc(), SchedulePeriod.id.asc())
        .all()
    )
    school_period_by_key = {
        (item.school_id, _period_key(item.name)): item
        for item in school_periods
        if item.school_id is not None
    }

    alias_map: dict[int, SchedulePeriod] = {}
    for row in rows:
        period = period_map.get(row.period_id)
        if period is None or row.school_id is None:
            continue
        school_period = school_period_by_key.get((row.school_id, _period_key(period.name)))
        if school_period is not None:
            alias_map[row.period_id] = school_period
    return alias_map


def _build_timetable_items(db: Session, rows: list[ClassTimetable]) -> list[TimetableItem]:
    if not rows:
        return []

    class_ids = sorted({row.class_id for row in rows})
    subject_ids = sorted({row.subject_id for row in rows})
    teacher_ids = sorted({row.teacher_id for row in rows})
    period_ids = sorted({row.period_id for row in rows})

    class_name_map = {item.id: item.name for item in db.query(Class).filter(Class.id.in_(class_ids)).all()}
    subject_name_map = {item.id: item.name for item in db.query(Subject).filter(Subject.id.in_(subject_ids)).all()}
    teacher_name_map = {item.id: item.username for item in db.query(User).filter(User.id.in_(teacher_ids)).all()}
    period_map = {item.id: item for item in db.query(SchedulePeriod).filter(SchedulePeriod.id.in_(period_ids)).all()}
    school_period_aliases = _school_period_alias_map(db, rows, period_map)

    items: list[TimetableItem] = []
    for row in rows:
        period = school_period_aliases.get(row.period_id) or period_map.get(row.period_id)
        items.append(
            TimetableItem(
                weekday=row.weekday,
                period_id=row.period_id,
                period_name=period.name if period else None,
                period_start_time=period.start_time if period else None,
                period_end_time=period.end_time if period else None,
                class_id=row.class_id,
                class_name=class_name_map.get(row.class_id),
                subject_id=row.subject_id,
                subject_name=subject_name_map.get(row.subject_id),
                teacher_id=row.teacher_id,
                teacher_name=teacher_name_map.get(row.teacher_id),
            )
        )
    return items


@router.get("/class/{class_id}", response_model=TimetableResponse)
def get_class_timetable(
    class_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    class_obj = db.query(Class).filter(Class.id == class_id).first()
    if not class_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="class not found")

    if current_user.role == "student":
        if current_user.student_id is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="student account is not bound")
        student = db.query(Student).filter(Student.id == current_user.student_id).first()
        if not student or student.class_id != class_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    elif current_user.role == "teacher":
        accessible = get_accessible_class_ids(current_user, db) or []
        if class_id not in accessible:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    elif current_user.role == "school_admin":
        if current_user.school_id is None or class_obj.school_id != current_user.school_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="class not found")
    elif current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    rows = (
        db.query(ClassTimetable)
        .filter(ClassTimetable.class_id == class_id)
        .order_by(ClassTimetable.weekday, ClassTimetable.period_id)
        .all()
    )
    return TimetableResponse(items=_build_timetable_items(db, rows))


@router.get("/teacher/{teacher_id}", response_model=TimetableResponse)
def get_teacher_timetable(
    teacher_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    teacher = db.query(User).filter(User.id == teacher_id, User.role == "teacher").first()
    if not teacher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="teacher not found")

    if current_user.role == "teacher":
        if current_user.id != teacher_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
    elif current_user.role == "school_admin":
        if current_user.school_id is None or teacher.school_id != current_user.school_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="teacher not found")
    elif current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    rows = (
        db.query(ClassTimetable)
        .filter(ClassTimetable.teacher_id == teacher_id)
        .order_by(ClassTimetable.weekday, ClassTimetable.period_id)
        .all()
    )
    return TimetableResponse(items=_build_timetable_items(db, rows))


@router.get("/my", response_model=TimetableResponse)
def get_my_timetable(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the current user's own timetable.
    - teacher: all classes they teach
    - student: their class timetable
    """
    if current_user.role == "teacher":
        rows = (
            db.query(ClassTimetable)
            .filter(ClassTimetable.teacher_id == current_user.id)
            .order_by(ClassTimetable.weekday, ClassTimetable.period_id)
            .all()
        )
        return TimetableResponse(items=_build_timetable_items(db, rows))

    if current_user.role == "student":
        if current_user.student_id is None:
            return TimetableResponse(items=[])
        student = db.query(Student).filter(Student.id == current_user.student_id).first()
        if not student:
            return TimetableResponse(items=[])
        rows = (
            db.query(ClassTimetable)
            .filter(ClassTimetable.class_id == student.class_id)
            .order_by(ClassTimetable.weekday, ClassTimetable.period_id)
            .all()
        )
        return TimetableResponse(items=_build_timetable_items(db, rows))

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")
