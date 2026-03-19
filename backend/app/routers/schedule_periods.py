from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_admin
from app.models.schedule_period import SchedulePeriod
from app.schemas.schedule import SchedulePeriodCreate, SchedulePeriodUpdate, SchedulePeriodResponse

router = APIRouter(prefix="/api/schedule-periods", tags=["节次配置"])


@router.get("/", response_model=list[SchedulePeriodResponse])
def get_schedule_periods(db: Session = Depends(get_db)):
    """获取所有节次列表"""
    periods = db.query(SchedulePeriod).filter(SchedulePeriod.is_active == True).order_by(SchedulePeriod.sort_order).all()
    return periods


@router.post("/", response_model=SchedulePeriodResponse, status_code=status.HTTP_201_CREATED)
def create_schedule_period(
    req: SchedulePeriodCreate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin)
):
    """创建节次（仅管理员）"""
    period = SchedulePeriod(
        name=req.name,
        start_time=req.start_time,
        end_time=req.end_time,
        sort_order=req.sort_order
    )
    db.add(period)
    db.commit()
    db.refresh(period)
    return period


@router.put("/{period_id}", response_model=SchedulePeriodResponse)
def update_schedule_period(
    period_id: int,
    req: SchedulePeriodUpdate,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin)
):
    """更新节次（仅管理员）"""
    period = db.query(SchedulePeriod).filter(SchedulePeriod.id == period_id).first()
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

    db.commit()
    db.refresh(period)
    return period


@router.delete("/{period_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule_period(
    period_id: int,
    db: Session = Depends(get_db),
    _: None = Depends(require_admin)
):
    """删除节次（仅管理员）"""
    from app.models.teacher_schedule import TeacherSchedule

    # 检查是否有课表使用该节次
    usage_count = db.query(TeacherSchedule).filter(TeacherSchedule.period_id == period_id).count()
    if usage_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该节次已被使用，无法删除"
        )

    period = db.query(SchedulePeriod).filter(SchedulePeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="节次不存在")

    db.delete(period)
    db.commit()
