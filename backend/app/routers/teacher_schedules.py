from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user, require_admin
from app.models.user import User
from app.models.student import Student
from app.models.teacher_schedule import TeacherSchedule
from app.models.schedule_period import SchedulePeriod
from app.models.class_ import Class
from app.models.subject import Subject
from app.schemas.schedule import TeacherScheduleCreate, TeacherScheduleResponse

router = APIRouter(prefix="/api/teacher-schedules", tags=["教师课表"])


def _to_schedule_response(db: Session, schedule: TeacherSchedule) -> TeacherScheduleResponse:
    period = db.query(SchedulePeriod).filter(SchedulePeriod.id == schedule.period_id).first()
    class_obj = db.query(Class).filter(Class.id == schedule.class_id).first() if schedule.class_id else None
    subject = db.query(Subject).filter(Subject.id == schedule.subject_id).first() if schedule.subject_id else None

    return TeacherScheduleResponse(
        id=schedule.id,
        teacher_id=schedule.teacher_id,
        period_id=schedule.period_id,
        period_name=period.name if period else None,
        start_time=period.start_time if period else None,
        end_time=period.end_time if period else None,
        weekday=schedule.weekday,
        class_id=schedule.class_id,
        class_name=class_obj.name if class_obj else None,
        subject_id=schedule.subject_id,
        subject_name=subject.name if subject else None,
        created_at=schedule.created_at,
        updated_at=schedule.updated_at,
    )


@router.get("/my-schedule", response_model=list[TeacherScheduleResponse])
def get_my_schedule(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get current user's schedule view."""
    if current_user.role == "teacher":
        schedules = (
            db.query(TeacherSchedule)
            .filter(TeacherSchedule.teacher_id == current_user.id)
            .order_by(TeacherSchedule.weekday, TeacherSchedule.period_id)
            .all()
        )
        return [_to_schedule_response(db, schedule) for schedule in schedules]

    if current_user.role == "student":
        student = db.query(Student).filter(Student.student_no == current_user.username).first()
        if not student:
            return []
        schedules = (
            db.query(TeacherSchedule)
            .filter(TeacherSchedule.class_id == student.class_id)
            .order_by(TeacherSchedule.weekday, TeacherSchedule.period_id)
            .all()
        )
        return [_to_schedule_response(db, schedule) for schedule in schedules]

    if current_user.role == "school_admin":
        if current_user.school_id is None:
            return []
        class_ids = [r[0] for r in db.query(Class.id).filter(Class.school_id == current_user.school_id).all()]
        if not class_ids:
            return []
        schedules = (
            db.query(TeacherSchedule)
            .filter(TeacherSchedule.class_id.in_(class_ids))
            .order_by(TeacherSchedule.weekday, TeacherSchedule.period_id)
            .all()
        )
        return [_to_schedule_response(db, schedule) for schedule in schedules]

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要学校管理员、教师或学生权限")


@router.get("/{teacher_id}", response_model=list[TeacherScheduleResponse])
def get_teacher_schedule(
    teacher_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin),
):
    """Get specified teacher's schedule (admin only)."""
    schedules = db.query(TeacherSchedule).filter(TeacherSchedule.teacher_id == teacher_id).all()
    return [_to_schedule_response(db, schedule) for schedule in schedules]


@router.post("/", response_model=TeacherScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_or_update_schedule(
    req: TeacherScheduleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or update schedule item."""
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要教师或管理员权限")

    existing = db.query(TeacherSchedule).filter(
        TeacherSchedule.teacher_id == current_user.id,
        TeacherSchedule.period_id == req.period_id,
        TeacherSchedule.weekday == req.weekday,
    ).first()

    if existing:
        existing.class_id = req.class_id
        existing.subject_id = req.subject_id
        db.commit()
        db.refresh(existing)
        schedule = existing
    else:
        schedule = TeacherSchedule(
            teacher_id=current_user.id,
            period_id=req.period_id,
            weekday=req.weekday,
            class_id=req.class_id,
            subject_id=req.subject_id,
        )
        db.add(schedule)
        db.commit()
        db.refresh(schedule)

    return _to_schedule_response(db, schedule)


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete schedule item."""
    schedule = db.query(TeacherSchedule).filter(TeacherSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="课表项不存在")

    if current_user.role != "admin" and schedule.teacher_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权删除此课表项")

    db.delete(schedule)
    db.commit()
