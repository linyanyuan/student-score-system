from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.memo import Memo
from app.schemas.schedule import MemoCreate, MemoUpdate, MemoResponse

router = APIRouter(prefix="/api/memos", tags=["备忘录"])


@router.get("/", response_model=list[MemoResponse])
def get_memos(
    status_filter: str | None = Query(None, alias="status"),
    limit: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取当前用户的备忘录列表"""
    query = db.query(Memo).filter(Memo.teacher_id == current_user.id)

    if status_filter:
        query = query.filter(Memo.status == status_filter)

    query = query.order_by(
        Memo.status.asc(),
        Memo.priority.desc(),
        Memo.due_date.asc()
    )

    if limit:
        query = query.limit(limit)

    return query.all()


@router.post("/", response_model=MemoResponse, status_code=status.HTTP_201_CREATED)
def create_memo(
    req: MemoCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建备忘录"""
    memo = Memo(
        teacher_id=current_user.id,
        title=req.title,
        description=req.description,
        priority=req.priority,
        category=req.category,
        due_date=req.due_date
    )
    db.add(memo)
    db.commit()
    db.refresh(memo)
    return memo


@router.put("/{memo_id}", response_model=MemoResponse)
def update_memo(
    memo_id: int,
    req: MemoUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新备忘录"""
    memo = db.query(Memo).filter(Memo.id == memo_id).first()
    if not memo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="备忘录不存在")

    if memo.teacher_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限操作此备忘录")

    if req.title is not None:
        memo.title = req.title
    if req.description is not None:
        memo.description = req.description
    if req.priority is not None:
        memo.priority = req.priority
    if req.category is not None:
        memo.category = req.category
    if req.status is not None:
        memo.status = req.status
    if req.due_date is not None:
        memo.due_date = req.due_date

    db.commit()
    db.refresh(memo)
    return memo


@router.delete("/{memo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_memo(
    memo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除备忘录"""
    memo = db.query(Memo).filter(Memo.id == memo_id).first()
    if not memo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="备忘录不存在")

    if memo.teacher_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限操作此备忘录")

    db.delete(memo)
    db.commit()


@router.patch("/{memo_id}/status", response_model=MemoResponse)
def update_memo_status(
    memo_id: int,
    status_value: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新备忘录状态"""
    memo = db.query(Memo).filter(Memo.id == memo_id).first()
    if not memo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="备忘录不存在")

    if memo.teacher_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限操作此备忘录")

    memo.status = status_value
    db.commit()
    db.refresh(memo)
    return memo
