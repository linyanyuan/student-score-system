from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user, require_admin
from app.models.custom_field import CustomFieldDefinition
from app.models.user import User
from app.schemas.custom_field import CustomFieldCreate, CustomFieldUpdate, CustomFieldResponse

router = APIRouter(prefix="/api/custom-fields", tags=["自定义字段管理"])


@router.get("", response_model=list[CustomFieldResponse])
def list_custom_fields(
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(CustomFieldDefinition).order_by(CustomFieldDefinition.sort_order).all()


@router.post("", response_model=CustomFieldResponse, status_code=status.HTTP_201_CREATED)
def create_custom_field(
    req: CustomFieldCreate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    existing = db.query(CustomFieldDefinition).filter(
        CustomFieldDefinition.field_name == req.field_name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="字段名称已存在")
    obj = CustomFieldDefinition(
        field_name=req.field_name,
        field_type=req.field_type,
        options=req.options,
        sort_order=req.sort_order,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{field_id}", response_model=CustomFieldResponse)
def update_custom_field(
    field_id: int,
    req: CustomFieldUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    obj = db.query(CustomFieldDefinition).filter(CustomFieldDefinition.id == field_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="字段不存在")
    if req.field_name is not None:
        dup = db.query(CustomFieldDefinition).filter(
            CustomFieldDefinition.field_name == req.field_name,
            CustomFieldDefinition.id != field_id,
        ).first()
        if dup:
            raise HTTPException(status_code=400, detail="字段名称已存在")
        obj.field_name = req.field_name
    if req.field_type is not None:
        obj.field_type = req.field_type
    if req.options is not None:
        obj.options = req.options
    if req.sort_order is not None:
        obj.sort_order = req.sort_order
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_custom_field(
    field_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    obj = db.query(CustomFieldDefinition).filter(CustomFieldDefinition.id == field_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="字段不存在")
    db.delete(obj)
    db.commit()
