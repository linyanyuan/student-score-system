from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, get_user_school_id, require_school_admin
from app.models.class_timetable import ClassTimetable
from app.models.schedule_draft_item import ScheduleDraftItem
from app.models.schedule_period import SchedulePeriod
from app.models.school import School
from app.models.teacher_schedule import TeacherSchedule
from app.models.timetable_lock import TimetableLock
from app.models.user import User
from app.schemas.schedule import SchedulePeriodCreate, SchedulePeriodResponse, SchedulePeriodUpdate

router = APIRouter(prefix="/api/schedule-periods", tags=["节次配置"])


def _query_scoped_periods(db: Session, current_user: User):
    query = db.query(SchedulePeriod).filter(SchedulePeriod.is_active == True)
    school_id = get_user_school_id(current_user)
    if school_id is not None:
        query = query.filter(SchedulePeriod.school_id == school_id)
    return query


def _require_school_admin_school_id(current_user: User) -> int:
    school_id = current_user.school_id
    if school_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前账号未绑定学校")
    return int(school_id)


def _middle_or_primary_template() -> list[dict[str, str | int]]:
    return [
        {"name": "第1节", "start_time": "08:10", "end_time": "08:55", "sort_order": 1},
        {"name": "第2节", "start_time": "09:05", "end_time": "09:50", "sort_order": 2},
        {"name": "第3节", "start_time": "10:10", "end_time": "10:55", "sort_order": 3},
        {"name": "第4节", "start_time": "11:05", "end_time": "11:50", "sort_order": 4},
        {"name": "第5节", "start_time": "13:40", "end_time": "14:25", "sort_order": 5},
        {"name": "第6节", "start_time": "14:35", "end_time": "15:20", "sort_order": 6},
        {"name": "第7节", "start_time": "15:30", "end_time": "16:15", "sort_order": 7},
        {"name": "第8节", "start_time": "16:35", "end_time": "17:20", "sort_order": 8},
    ]


def _high_school_template() -> list[dict[str, str | int]]:
    return [
        {"name": "早自习", "start_time": "07:00", "end_time": "07:40", "sort_order": 1},
        {"name": "第1节", "start_time": "08:00", "end_time": "08:40", "sort_order": 2},
        {"name": "第2节", "start_time": "08:50", "end_time": "09:30", "sort_order": 3},
        {"name": "第3节", "start_time": "09:50", "end_time": "10:30", "sort_order": 4},
        {"name": "第4节", "start_time": "10:40", "end_time": "11:20", "sort_order": 5},
        {"name": "第5节", "start_time": "11:30", "end_time": "12:10", "sort_order": 6},
        {"name": "第6节", "start_time": "14:20", "end_time": "15:00", "sort_order": 7},
        {"name": "第7节", "start_time": "15:10", "end_time": "15:50", "sort_order": 8},
        {"name": "第8节", "start_time": "16:00", "end_time": "16:40", "sort_order": 9},
        {"name": "第9节", "start_time": "16:50", "end_time": "17:30", "sort_order": 10},
        {"name": "晚自习1", "start_time": "17:50", "end_time": "18:30", "sort_order": 11},
        {"name": "晚自习2", "start_time": "18:40", "end_time": "19:20", "sort_order": 12},
        {"name": "晚自习3", "start_time": "19:30", "end_time": "20:10", "sort_order": 13},
        {"name": "晚自习4", "start_time": "20:20", "end_time": "21:00", "sort_order": 14},
    ]


def _build_default_template(school_level: str) -> list[dict[str, str | int]]:
    return _high_school_template() if school_level == "high" else _middle_or_primary_template()


@router.get("/", response_model=list[SchedulePeriodResponse])
def get_schedule_periods(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _query_scoped_periods(db, current_user).order_by(SchedulePeriod.sort_order, SchedulePeriod.id).all()


@router.post("/", response_model=SchedulePeriodResponse, status_code=status.HTTP_201_CREATED)
def create_schedule_period(
    req: SchedulePeriodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_school_admin),
):
    period = SchedulePeriod(
        name=req.name,
        start_time=req.start_time,
        end_time=req.end_time,
        school_id=_require_school_admin_school_id(current_user),
        sort_order=req.sort_order,
        include_in_auto_schedule=req.include_in_auto_schedule,
    )
    db.add(period)
    db.commit()
    db.refresh(period)
    return period


@router.post("/default-template", response_model=list[SchedulePeriodResponse], status_code=status.HTTP_201_CREATED)
def create_default_schedule_period_template(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_school_admin),
):
    school_id = _require_school_admin_school_id(current_user)
    school = db.query(School).filter(School.id == school_id).first()
    if not school:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="学校不存在")

    if db.query(SchedulePeriod.id).filter(SchedulePeriod.school_id == school_id).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前学校已有节次，不能生成默认模板")

    periods = [
        SchedulePeriod(
            name=str(item["name"]),
            start_time=str(item["start_time"]),
            end_time=str(item["end_time"]),
            school_id=school_id,
            sort_order=int(item["sort_order"]),
            include_in_auto_schedule=True,
        )
        for item in _build_default_template(str(school.school_level or "middle"))
    ]
    db.add_all(periods)
    db.commit()
    for item in periods:
        db.refresh(item)
    return periods


@router.put("/{period_id}", response_model=SchedulePeriodResponse)
def update_schedule_period(
    period_id: int,
    req: SchedulePeriodUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_school_admin),
):
    school_id = _require_school_admin_school_id(current_user)
    period = db.query(SchedulePeriod).filter(SchedulePeriod.id == period_id, SchedulePeriod.school_id == school_id).first()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="节次不存在")

    if req.name is not None:
        period.name = req.name
    if req.start_time is not None:
        period.start_time = req.start_time
    if req.end_time is not None:
        period.end_time = req.end_time
    if req.sort_order is not None:
        period.sort_order = req.sort_order
    if req.is_active is not None:
        period.is_active = req.is_active
    if req.include_in_auto_schedule is not None:
        period.include_in_auto_schedule = req.include_in_auto_schedule

    db.commit()
    db.refresh(period)
    return period


@router.delete("/{period_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule_period(
    period_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_school_admin),
):
    school_id = _require_school_admin_school_id(current_user)
    period = db.query(SchedulePeriod).filter(SchedulePeriod.id == period_id, SchedulePeriod.school_id == school_id).first()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="节次不存在")

    usage_count = (
        db.query(TeacherSchedule).filter(TeacherSchedule.period_id == period_id).count()
        + db.query(ClassTimetable).filter(ClassTimetable.period_id == period_id, ClassTimetable.school_id == school_id).count()
        + db.query(ScheduleDraftItem)
        .join(SchedulePeriod, SchedulePeriod.id == ScheduleDraftItem.period_id)
        .filter(ScheduleDraftItem.period_id == period_id, SchedulePeriod.school_id == school_id)
        .count()
        + db.query(TimetableLock).filter(TimetableLock.period_id == period_id, TimetableLock.school_id == school_id).count()
    )
    if usage_count > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该节次已被使用，无法删除")

    db.delete(period)
    db.commit()
