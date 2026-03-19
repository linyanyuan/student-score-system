from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user, require_admin
from app.models.user import User
from app.models.teacher_schedule import TeacherSchedule
from app.models.schedule_period import SchedulePeriod
from app.models.class_ import Class
from app.models.subject import Subject
from app.schemas.schedule import TeacherScheduleCreate, TeacherScheduleUpdate, TeacherScheduleResponse

router = APIRouter(prefix="/api/teacher-schedules", tags=["教师课表"])


@router.get("/my-schedule", response_model=list[TeacherScheduleResponse])
def get_my_schedule(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取当前教师的课表"""
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要教师或管理员权限")

    schedules = db.query(TeacherSchedule).filter(
        TeacherSchedule.teacher_id == current_user.id
    ).all()

    result = []
    for schedule in schedules:
        period = db.query(SchedulePeriod).filter(SchedulePeriod.id == schedule.period_id).first()
        class_obj = db.query(Class).filter(Class.id == schedule.class_id).first() if schedule.class_id else None
        subject = db.query(Subject).filter(Subject.id == schedule.subject_id).first() if schedule.subject_id else None

        result.append(TeacherScheduleResponse(
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
            updated_at=schedule.updated_at
        ))

    return result


@router.get("/{teacher_id}", response_model=list[TeacherScheduleResponse])
def get_teacher_schedule(
    teacher_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin)
):
    """获取指定教师的课表（仅管理员）"""
    schedules = db.query(TeacherSchedule).filter(
        TeacherSchedule.teacher_id == teacher_id
    ).all()

    result = []
    for schedule in schedules:
        period = db.query(SchedulePeriod).filter(SchedulePeriod.id == schedule.period_id).first()
        class_obj = db.query(Class).filter(Class.id == schedule.class_id).first() if schedule.class_id else None
        subject = db.query(Subject).filter(Subject.id == schedule.subject_id).first() if schedule.subject_id else None

        result.append(TeacherScheduleResponse(
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
            updated_at=schedule.updated_at
        ))

    return result


@router.post("/", response_model=TeacherScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_or_update_schedule(
    req: TeacherScheduleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建或更新课表项"""
    if current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要教师或管理员权限")

    # 检查是否已存在
    existing = db.query(TeacherSchedule).filter(
        TeacherSchedule.teacher_id == current_user.id,
        TeacherSchedule.period_id == req.period_id,
        TeacherSchedule.weekday == req.weekday
    ).first()

    if existing:
        # 更新
        existing.class_id = req.class_id
        existing.subject_id = req.subject_id
        db.commit()
        db.refresh(existing)
        schedule = existing
    else:
        # 创建
        schedule = TeacherSchedule(
            teacher_id=current_user.id,
            period_id=req.period_id,
            weekday=req.weekday,
            class_id=req.class_id,
            subject_id=req.subject_id
        )
        db.add(schedule)
        db.commit()
        db.refresh(schedule)

    # 构建响应
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
        updated_at=schedule.updated_at
    )


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(
    schedule_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除课表项"""
    schedule = db.query(TeacherSchedule).filter(TeacherSchedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="课表项不存在")

    # 权限检查
    if current_user.role != "admin" and schedule.teacher_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权删除此课表项")

    db.delete(schedule)
    db.commit()
