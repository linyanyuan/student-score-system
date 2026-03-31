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
    period_name_map = {item.id: item.name for item in db.query(SchedulePeriod).filter(SchedulePeriod.id.in_(period_ids)).all()}

    items: list[TimetableItem] = []
    for row in rows:
        items.append(
            TimetableItem(
                weekday=row.weekday,
                period_id=row.period_id,
                period_name=period_name_map.get(row.period_id),
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
