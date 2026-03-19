from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import json

from app.dependencies import get_db, get_current_user
from app.models.seat_arrangement import SeatArrangement
from app.models.teacher_class import TeacherClass
from app.models.user import User

router = APIRouter(prefix="/api/seats", tags=["座位管理"])


class LayoutConfig(BaseModel):
    columns: int
    column_rows: list[int]
    podium_position: str


class SeatArrangementRequest(BaseModel):
    layout_config: LayoutConfig
    seat_data: dict


class SeatArrangementResponse(BaseModel):
    id: int
    class_id: int
    layout_config: dict
    seat_data: dict
    updated_at: str

    class Config:
        from_attributes = True


def check_seat_permission(user: User, class_id: int, db: Session) -> bool:
    """检查用户是否有权限管理指定班级的座位表"""
    if user.role == "admin":
        return True
    if user.role == "teacher":
        return db.query(TeacherClass).filter(
            TeacherClass.teacher_id == user.id,
            TeacherClass.class_id == class_id
        ).first() is not None
    return False


@router.get("/{class_id}", response_model=SeatArrangementResponse)
def get_seat_arrangement(
    class_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not check_seat_permission(current_user, class_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限访问该班级座位表"
        )

    arrangement = db.query(SeatArrangement).filter(
        SeatArrangement.class_id == class_id
    ).first()

    if not arrangement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="该班级暂无座位表"
        )

    return SeatArrangementResponse(
        id=arrangement.id,
        class_id=arrangement.class_id,
        layout_config=json.loads(arrangement.layout_config),
        seat_data=json.loads(arrangement.seat_data),
        updated_at=arrangement.updated_at.isoformat()
    )


@router.post("/{class_id}")
def save_seat_arrangement(
    class_id: int,
    req: SeatArrangementRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not check_seat_permission(current_user, class_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限管理该班级座位表"
        )

    # 验证 layout_config
    if len(req.layout_config.column_rows) != req.layout_config.columns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="column_rows 数组长度必须等于 columns"
        )

    if req.layout_config.podium_position not in ["top", "bottom", "left", "right"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="podium_position 必须是 top/bottom/left/right"
        )

    arrangement = db.query(SeatArrangement).filter(
        SeatArrangement.class_id == class_id
    ).first()

    layout_config_json = json.dumps(req.layout_config.dict())
    seat_data_json = json.dumps(req.seat_data)

    if arrangement:
        arrangement.layout_config = layout_config_json
        arrangement.seat_data = seat_data_json
        arrangement.teacher_id = current_user.id
    else:
        arrangement = SeatArrangement(
            class_id=class_id,
            teacher_id=current_user.id,
            layout_config=layout_config_json,
            seat_data=seat_data_json
        )
        db.add(arrangement)

    db.commit()
    db.refresh(arrangement)

    return {
        "message": "保存成功",
        "updated_at": arrangement.updated_at.isoformat()
    }


@router.delete("/{class_id}")
def delete_seat_arrangement(
    class_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not check_seat_permission(current_user, class_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限管理该班级座位表"
        )

    arrangement = db.query(SeatArrangement).filter(
        SeatArrangement.class_id == class_id
    ).first()

    if arrangement:
        db.delete(arrangement)
        db.commit()

    return {"message": "座位表已重置"}
