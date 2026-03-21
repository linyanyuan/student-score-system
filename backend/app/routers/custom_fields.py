from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user, require_admin_or_school_admin, get_user_school_id
from app.models.custom_field import CustomFieldDefinition
from app.models.user import User
from app.schemas.custom_field import CustomFieldCreate, CustomFieldUpdate, CustomFieldResponse

router = APIRouter(prefix="/api/custom-fields", tags=["自定义字段管理"])


@router.get("", response_model=list[CustomFieldResponse])
def list_custom_fields(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(CustomFieldDefinition)
    school_id = get_user_school_id(current_user)
    if school_id is not None:
        query = query.filter(CustomFieldDefinition.school_id == school_id)
    return query.order_by(CustomFieldDefinition.sort_order).all()


@router.post("", response_model=CustomFieldResponse, status_code=status.HTTP_201_CREATED)
def create_custom_field(
    req: CustomFieldCreate,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)
    filter_school_id = school_id if school_id is not None else req.school_id
    existing = db.query(CustomFieldDefinition).filter(
        CustomFieldDefinition.field_name == req.field_name,
        CustomFieldDefinition.school_id == filter_school_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="字段名称已存在")
    obj = CustomFieldDefinition(
        field_name=req.field_name,
        field_type=req.field_type,
        options=req.options,
        sort_order=req.sort_order,
        school_id=filter_school_id,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{field_id}", response_model=CustomFieldResponse)
def update_custom_field(
    field_id: int,
    req: CustomFieldUpdate,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)
    query = db.query(CustomFieldDefinition).filter(CustomFieldDefinition.id == field_id)
    if school_id is not None:
        query = query.filter(CustomFieldDefinition.school_id == school_id)
    obj = query.first()
    if not obj:
        raise HTTPException(status_code=404, detail="字段不存在")
    if req.field_name is not None:
        dup = db.query(CustomFieldDefinition).filter(
            CustomFieldDefinition.field_name == req.field_name,
            CustomFieldDefinition.school_id == obj.school_id,
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
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)
    query = db.query(CustomFieldDefinition).filter(CustomFieldDefinition.id == field_id)
    if school_id is not None:
        query = query.filter(CustomFieldDefinition.school_id == school_id)
    obj = query.first()
    if not obj:
        raise HTTPException(status_code=404, detail="字段不存在")
    db.delete(obj)
    db.commit()
