from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, normalize_role
from app.models.class_ import Class
from app.models.school_notice import SchoolNotice
from app.models.school_notice_audience import SchoolNoticeAudience
from app.models.school_notice_recipient import SchoolNoticeRecipient
from app.models.student import Student
from app.models.teacher_class import TeacherClass
from app.models.user import User
from app.schemas.school_notice import (
    SchoolNoticeAudiencePayload,
    SchoolNoticeAudienceResponse,
    SchoolNoticeCreateRequest,
    SchoolNoticeInboxItemResponse,
    SchoolNoticeSummaryResponse,
    SchoolNoticeUpdateRequest,
)

router = APIRouter(prefix="/api/school-notices", tags=["校内通知"])


def _require_school_admin(current_user: User) -> None:
    if normalize_role(current_user.role) != "school_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要学校管理员权限")


def _serialize_notice(db: Session, notice: SchoolNotice) -> SchoolNoticeSummaryResponse:
    audiences = (
        db.query(SchoolNoticeAudience)
        .filter(SchoolNoticeAudience.notice_id == notice.id)
        .all()
    )
    recipients = (
        db.query(SchoolNoticeRecipient)
        .filter(SchoolNoticeRecipient.notice_id == notice.id)
        .all()
    )
    return SchoolNoticeSummaryResponse(
        id=notice.id,
        school_id=notice.school_id,
        title=notice.title,
        content=notice.content,
        created_by=notice.created_by,
        status=notice.status,
        sent_at=notice.sent_at,
        created_at=notice.created_at,
        updated_at=notice.updated_at,
        audiences=[
            SchoolNoticeAudienceResponse(
                audience_type=item.audience_type,
                target_id=item.target_id,
                target_label=item.target_label,
            )
            for item in audiences
        ],
        recipient_count=len(recipients),
        read_count=sum(1 for item in recipients if item.is_read),
    )


def _school_teacher_ids(db: Session, school_id: int) -> set[int]:
    rows = db.query(User.id).filter(User.role == "teacher", User.school_id == school_id).all()
    return {row[0] for row in rows}


def _teacher_ids_for_grade(db: Session, school_id: int, grade: str) -> set[int]:
    rows = (
        db.query(TeacherClass.teacher_id)
        .join(Class, Class.id == TeacherClass.class_id)
        .filter(Class.school_id == school_id, Class.grade == grade)
        .all()
    )
    return {row[0] for row in rows}


def _student_user_ids_for_grade(db: Session, school_id: int, grade: str) -> set[int]:
    rows = (
        db.query(User.id)
        .join(Student, Student.id == User.student_id)
        .join(Class, Class.id == Student.class_id)
        .filter(
            User.role == "student",
            User.school_id == school_id,
            Class.grade == grade,
        )
        .all()
    )
    return {row[0] for row in rows}


def _teacher_ids_for_class(db: Session, school_id: int, class_id: int) -> set[int]:
    class_obj = db.query(Class).filter(Class.id == class_id, Class.school_id == school_id).first()
    if class_obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="班级不存在")
    rows = db.query(TeacherClass.teacher_id).filter(TeacherClass.class_id == class_id).all()
    return {row[0] for row in rows}


def _student_user_ids_for_class(db: Session, school_id: int, class_id: int) -> set[int]:
    rows = (
        db.query(User.id)
        .join(Student, Student.id == User.student_id)
        .filter(
            User.role == "student",
            User.school_id == school_id,
            Student.class_id == class_id,
        )
        .all()
    )
    return {row[0] for row in rows}


def _expand_recipients(
    db: Session,
    school_id: int,
    audiences: list[SchoolNoticeAudiencePayload],
) -> set[int]:
    teacher_ids = _school_teacher_ids(db, school_id)
    recipients: set[int] = set()
    for audience in audiences:
        if audience.audience_type == "all_teachers":
            recipients.update(teacher_ids)
        elif audience.audience_type == "teacher":
            if audience.target_id is None or audience.target_id not in teacher_ids:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="教师范围无效")
            recipients.add(audience.target_id)
        elif audience.audience_type == "grade":
            if not audience.target_label:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="年级范围无效")
            recipients.update(_teacher_ids_for_grade(db, school_id, audience.target_label))
            recipients.update(_student_user_ids_for_grade(db, school_id, audience.target_label))
        elif audience.audience_type == "class":
            if audience.target_id is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="班级范围无效")
            recipients.update(_teacher_ids_for_class(db, school_id, audience.target_id))
            recipients.update(_student_user_ids_for_class(db, school_id, audience.target_id))
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="通知范围类型不支持")
    return recipients


def _replace_audiences(db: Session, notice_id: int, audiences: list[SchoolNoticeAudiencePayload]) -> None:
    db.query(SchoolNoticeAudience).filter(SchoolNoticeAudience.notice_id == notice_id).delete()
    for audience in audiences:
        db.add(
            SchoolNoticeAudience(
                notice_id=notice_id,
                audience_type=audience.audience_type,
                target_id=audience.target_id,
                target_label=audience.target_label,
            )
        )


@router.get("/manage", response_model=list[SchoolNoticeSummaryResponse])
def list_manage_notices(
    status_filter: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_school_admin(current_user)
    query = db.query(SchoolNotice).filter(SchoolNotice.school_id == current_user.school_id)
    if status_filter:
        query = query.filter(SchoolNotice.status == status_filter)
    rows = query.order_by(SchoolNotice.updated_at.desc(), SchoolNotice.id.desc()).all()
    return [_serialize_notice(db, item) for item in rows]


@router.post("/", response_model=SchoolNoticeSummaryResponse, status_code=status.HTTP_201_CREATED)
def create_notice(
    req: SchoolNoticeCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_school_admin(current_user)
    notice = SchoolNotice(
        school_id=current_user.school_id,
        title=req.title,
        content=req.content,
        created_by=current_user.id,
        status="draft",
    )
    db.add(notice)
    db.flush()
    _replace_audiences(db, notice.id, req.audiences)
    db.commit()
    db.refresh(notice)
    return _serialize_notice(db, notice)


@router.get("/inbox", response_model=list[SchoolNoticeInboxItemResponse])
def list_inbox_notices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if normalize_role(current_user.role) not in ("teacher", "school_admin", "admin", "student"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该数据")
    rows = (
        db.query(SchoolNoticeRecipient, SchoolNotice)
        .join(SchoolNotice, SchoolNotice.id == SchoolNoticeRecipient.notice_id)
        .filter(SchoolNoticeRecipient.teacher_id == current_user.id)
        .order_by(SchoolNoticeRecipient.is_read.asc(), SchoolNotice.sent_at.desc(), SchoolNotice.id.desc())
        .all()
    )
    return [
        SchoolNoticeInboxItemResponse(
            id=recipient.id,
            notice_id=notice.id,
            title=notice.title,
            content=notice.content,
            status=notice.status,
            sent_at=notice.sent_at,
            created_at=notice.created_at,
            is_read=recipient.is_read,
            read_at=recipient.read_at,
        )
        for recipient, notice in rows
    ]


@router.get("/inbox/{recipient_id}", response_model=SchoolNoticeInboxItemResponse)
def get_inbox_notice(
    recipient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(SchoolNoticeRecipient, SchoolNotice)
        .join(SchoolNotice, SchoolNotice.id == SchoolNoticeRecipient.notice_id)
        .filter(SchoolNoticeRecipient.id == recipient_id, SchoolNoticeRecipient.teacher_id == current_user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="通知不存在")
    recipient, notice = row
    return SchoolNoticeInboxItemResponse(
        id=recipient.id,
        notice_id=notice.id,
        title=notice.title,
        content=notice.content,
        status=notice.status,
        sent_at=notice.sent_at,
        created_at=notice.created_at,
        is_read=recipient.is_read,
        read_at=recipient.read_at,
    )


@router.get("/{notice_id}", response_model=SchoolNoticeSummaryResponse)
def get_notice(
    notice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_school_admin(current_user)
    notice = db.query(SchoolNotice).filter(SchoolNotice.id == notice_id, SchoolNotice.school_id == current_user.school_id).first()
    if notice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="通知不存在")
    return _serialize_notice(db, notice)


@router.put("/{notice_id}", response_model=SchoolNoticeSummaryResponse)
def update_notice(
    notice_id: int,
    req: SchoolNoticeUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_school_admin(current_user)
    notice = db.query(SchoolNotice).filter(SchoolNotice.id == notice_id, SchoolNotice.school_id == current_user.school_id).first()
    if notice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="通知不存在")
    if req.title is not None:
        notice.title = req.title
    if req.content is not None:
        notice.content = req.content
    if req.audiences is not None:
        _replace_audiences(db, notice.id, req.audiences)
        db.query(SchoolNoticeRecipient).filter(SchoolNoticeRecipient.notice_id == notice.id).delete()
        if notice.status == "sent":
            for teacher_id in sorted(_expand_recipients(db, current_user.school_id, req.audiences)):
                db.add(SchoolNoticeRecipient(notice_id=notice.id, teacher_id=teacher_id))
    db.commit()
    db.refresh(notice)
    return _serialize_notice(db, notice)


@router.delete("/{notice_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notice(
    notice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_school_admin(current_user)
    notice = db.query(SchoolNotice).filter(SchoolNotice.id == notice_id, SchoolNotice.school_id == current_user.school_id).first()
    if notice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="通知不存在")
    db.query(SchoolNoticeAudience).filter(SchoolNoticeAudience.notice_id == notice.id).delete()
    db.query(SchoolNoticeRecipient).filter(SchoolNoticeRecipient.notice_id == notice.id).delete()
    db.delete(notice)
    db.commit()


@router.post("/{notice_id}/send", response_model=SchoolNoticeSummaryResponse)
def send_notice(
    notice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_school_admin(current_user)
    notice = db.query(SchoolNotice).filter(SchoolNotice.id == notice_id, SchoolNotice.school_id == current_user.school_id).first()
    if notice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="通知不存在")
    audiences = db.query(SchoolNoticeAudience).filter(SchoolNoticeAudience.notice_id == notice.id).all()
    payloads = [
        SchoolNoticeAudiencePayload(
            audience_type=item.audience_type,
            target_id=item.target_id,
            target_label=item.target_label,
        )
        for item in audiences
    ]
    recipients = _expand_recipients(db, current_user.school_id, payloads)
    db.query(SchoolNoticeRecipient).filter(SchoolNoticeRecipient.notice_id == notice.id).delete()
    for teacher_id in sorted(recipients):
        db.add(SchoolNoticeRecipient(notice_id=notice.id, teacher_id=teacher_id))
    notice.status = "sent"
    notice.sent_at = datetime.now()
    db.commit()
    db.refresh(notice)
    return _serialize_notice(db, notice)


@router.patch("/inbox/{recipient_id}/read", response_model=SchoolNoticeInboxItemResponse)
def mark_inbox_notice_read(
    recipient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(SchoolNoticeRecipient, SchoolNotice)
        .join(SchoolNotice, SchoolNotice.id == SchoolNoticeRecipient.notice_id)
        .filter(SchoolNoticeRecipient.id == recipient_id, SchoolNoticeRecipient.teacher_id == current_user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="通知不存在")
    recipient, notice = row
    if not recipient.is_read:
        recipient.is_read = True
        recipient.read_at = datetime.now()
        db.commit()
        db.refresh(recipient)
    return SchoolNoticeInboxItemResponse(
        id=recipient.id,
        notice_id=notice.id,
        title=notice.title,
        content=notice.content,
        status=notice.status,
        sent_at=notice.sent_at,
        created_at=notice.created_at,
        is_read=recipient.is_read,
        read_at=recipient.read_at,
    )
