from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_user_school_id, require_admin_or_school_admin
from app.models.class_ import Class
from app.models.class_timetable import ClassTimetable
from app.models.subject import Subject
from app.models.teacher_class import TeacherClass
from app.models.teacher_class_subject import TeacherClassSubject
from app.models.user import User
from app.schemas.teacher_class import (
    TeacherClassCreate,
    TeacherClassResponse,
    TeacherClassSubjectBatchCreate,
    TeacherClassSubjectResponse,
)

router = APIRouter(prefix="/api/teacher-classes", tags=["教师班级分配"])


def _parse_grades(raw: str | None) -> set[str]:
    if not raw:
        return set()
    normalized = str(raw).replace("，", ",").replace("、", ",")
    return {item.strip() for item in normalized.split(",") if item and item.strip()}


def _subject_applies_to_grade(subject: Subject, grade: str | None) -> bool:
    if not grade:
        return True
    allowed_grades = _parse_grades(subject.grades)
    if not allowed_grades:
        return True
    return grade in allowed_grades


def _build_subject_assignment_response(db: Session, rows: list[TeacherClassSubject]) -> list[TeacherClassSubjectResponse]:
    if not rows:
        return []

    teacher_ids = sorted({row.teacher_id for row in rows})
    class_ids = sorted({row.class_id for row in rows})
    subject_ids = sorted({row.subject_id for row in rows})

    teacher_name_map = {item.id: item.username for item in db.query(User).filter(User.id.in_(teacher_ids)).all()}
    class_name_map = {item.id: item.name for item in db.query(Class).filter(Class.id.in_(class_ids)).all()}
    subject_name_map = {item.id: item.name for item in db.query(Subject).filter(Subject.id.in_(subject_ids)).all()}

    return [
        TeacherClassSubjectResponse(
            id=row.id,
            teacher_id=row.teacher_id,
            teacher_name=teacher_name_map.get(row.teacher_id),
            class_id=row.class_id,
            class_name=class_name_map.get(row.class_id),
            subject_id=row.subject_id,
            subject_name=subject_name_map.get(row.subject_id),
        )
        for row in rows
    ]


def _bootstrap_subject_assignments_from_timetable(
    db: Session,
    school_id: int | None,
    teacher_id: int | None = None,
) -> int:
    if school_id is None:
        return 0

    class_ids = [row[0] for row in db.query(Class.id).filter(Class.school_id == school_id).all()]
    if not class_ids:
        return 0

    pair_query = db.query(TeacherClass.teacher_id, TeacherClass.class_id).filter(TeacherClass.class_id.in_(class_ids))
    if teacher_id is not None:
        pair_query = pair_query.filter(TeacherClass.teacher_id == teacher_id)
    bound_pairs = {(int(row[0]), int(row[1])) for row in pair_query.all()}
    if not bound_pairs:
        return 0

    existing_query = db.query(TeacherClassSubject.class_id, TeacherClassSubject.subject_id).filter(
        TeacherClassSubject.school_id == school_id,
        TeacherClassSubject.class_id.in_(class_ids),
    )
    if teacher_id is not None:
        existing_query = existing_query.filter(TeacherClassSubject.teacher_id == teacher_id)
    existing_keys = {(int(row[0]), int(row[1])) for row in existing_query.all()}

    timetable_rows = (
        db.query(ClassTimetable)
        .filter(ClassTimetable.school_id == school_id, ClassTimetable.class_id.in_(class_ids))
        .order_by(ClassTimetable.updated_at.desc(), ClassTimetable.id.desc())
        .all()
    )
    if not timetable_rows:
        return 0

    created = 0
    chosen_keys: set[tuple[int, int]] = set()
    for row in timetable_rows:
        class_id = int(row.class_id)
        subject_id = int(row.subject_id)
        tid = int(row.teacher_id)
        key = (class_id, subject_id)
        pair = (tid, class_id)
        if pair not in bound_pairs:
            continue
        if teacher_id is not None and tid != int(teacher_id):
            continue
        if key in existing_keys or key in chosen_keys:
            continue

        db.add(
            TeacherClassSubject(
                school_id=school_id,
                teacher_id=tid,
                class_id=class_id,
                subject_id=subject_id,
            )
        )
        chosen_keys.add(key)
        created += 1

    if created > 0:
        db.commit()
    return created


@router.get("", response_model=list[TeacherClassResponse])
def list_teacher_classes(
    teacher_id: int | None = None,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)

    query = db.query(TeacherClass)
    if school_id is not None:
        school_class_ids = [r[0] for r in db.query(Class.id).filter(Class.school_id == school_id).all()]
        query = query.filter(TeacherClass.class_id.in_(school_class_ids))
    if teacher_id is not None:
        query = query.filter(TeacherClass.teacher_id == teacher_id)

    return query.order_by(TeacherClass.id.desc()).all()


@router.post("", response_model=TeacherClassResponse, status_code=status.HTTP_201_CREATED)
def create_teacher_class(
    req: TeacherClassCreate,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)

    teacher = db.query(User).filter(User.id == req.teacher_id, User.role == "teacher").first()
    if not teacher:
        raise HTTPException(status_code=400, detail="教师不存在")
    if school_id is not None and teacher.school_id != school_id:
        raise HTTPException(status_code=403, detail="该教师不属于当前学校")

    cls = db.query(Class).filter(Class.id == req.class_id).first()
    if not cls:
        raise HTTPException(status_code=400, detail="班级不存在")
    if school_id is not None and cls.school_id != school_id:
        raise HTTPException(status_code=403, detail="该班级不属于当前学校")

    existing = db.query(TeacherClass).filter(
        TeacherClass.teacher_id == req.teacher_id,
        TeacherClass.class_id == req.class_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="该教师已绑定此班级")

    obj = TeacherClass(teacher_id=req.teacher_id, class_id=req.class_id)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/subject-assignments", response_model=list[TeacherClassSubjectResponse])
def list_teacher_subject_assignments(
    teacher_id: int | None = None,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)

    query = db.query(TeacherClassSubject)
    if school_id is not None:
        query = query.filter(TeacherClassSubject.school_id == school_id)
    if teacher_id is not None:
        query = query.filter(TeacherClassSubject.teacher_id == teacher_id)

    rows = query.order_by(TeacherClassSubject.id.desc()).all()
    if not rows:
        _bootstrap_subject_assignments_from_timetable(db, school_id, teacher_id=teacher_id)
        rows = query.order_by(TeacherClassSubject.id.desc()).all()
        if not rows:
            return []

    pair_query = db.query(TeacherClass.teacher_id, TeacherClass.class_id)
    if teacher_id is not None:
        pair_query = pair_query.filter(TeacherClass.teacher_id == teacher_id)
    if school_id is not None:
        school_class_ids = [r[0] for r in db.query(Class.id).filter(Class.school_id == school_id).all()]
        pair_query = pair_query.filter(TeacherClass.class_id.in_(school_class_ids))

    bound_pairs = {(int(row[0]), int(row[1])) for row in pair_query.all()}
    valid_rows = [row for row in rows if (int(row.teacher_id), int(row.class_id)) in bound_pairs]

    return _build_subject_assignment_response(db, valid_rows)


@router.post("/subject-assignments", response_model=list[TeacherClassSubjectResponse], status_code=status.HTTP_201_CREATED)
def create_teacher_subject_assignments(
    req: TeacherClassSubjectBatchCreate,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)

    class_ids: list[int] = []
    for cid in req.class_ids:
        try:
            class_ids.append(int(cid))
        except (TypeError, ValueError):
            continue
    class_ids = sorted(set(class_ids))

    if not class_ids:
        raise HTTPException(status_code=400, detail="请至少选择一个班级")

    teacher = db.query(User).filter(User.id == req.teacher_id, User.role == "teacher").first()
    if not teacher:
        raise HTTPException(status_code=400, detail="教师不存在")
    if teacher.school_id is None:
        raise HTTPException(status_code=400, detail="教师缺少学校信息")
    if school_id is not None and teacher.school_id != school_id:
        raise HTTPException(status_code=403, detail="该教师不属于当前学校")

    subject = db.query(Subject).filter(Subject.id == req.subject_id).first()
    if not subject:
        raise HTTPException(status_code=400, detail="科目不存在")
    if subject.school_id != teacher.school_id:
        raise HTTPException(status_code=400, detail="科目与教师不在同一学校")

    rows = db.query(Class).filter(Class.id.in_(class_ids)).all()
    class_map = {row.id: row for row in rows}

    not_found_ids = [cid for cid in class_ids if cid not in class_map]
    if not_found_ids:
        raise HTTPException(status_code=400, detail=f"班级不存在: {not_found_ids}")

    wrong_school_ids = [cid for cid in class_ids if class_map[cid].school_id != teacher.school_id]
    if wrong_school_ids:
        raise HTTPException(status_code=400, detail=f"班级与教师不在同一学校: {wrong_school_ids}")

    invalid_grade_class_ids = [cid for cid in class_ids if not _subject_applies_to_grade(subject, class_map[cid].grade)]
    if invalid_grade_class_ids:
        invalid_class_names = [f"{class_map[cid].grade}-{class_map[cid].name}" for cid in invalid_grade_class_ids]
        raise HTTPException(
            status_code=400,
            detail=f"科目 {subject.name} 不适用于所选班级年级: {invalid_class_names}",
        )

    bound_class_ids = {
        row[0]
        for row in db.query(TeacherClass.class_id).filter(
            TeacherClass.teacher_id == req.teacher_id,
            TeacherClass.class_id.in_(class_ids),
        ).all()
    }
    unbound_ids = sorted(set(class_ids) - bound_class_ids)
    if unbound_ids:
        raise HTTPException(status_code=400, detail=f"所选班级尚未绑定该教师: {unbound_ids}")

    if req.replace_existing:
        db.query(TeacherClassSubject).filter(
            TeacherClassSubject.school_id == teacher.school_id,
            TeacherClassSubject.teacher_id == req.teacher_id,
            TeacherClassSubject.subject_id == req.subject_id,
            ~TeacherClassSubject.class_id.in_(class_ids),
        ).delete(synchronize_session=False)

    affected_ids: list[int] = []
    for class_id in class_ids:
        existing = db.query(TeacherClassSubject).filter(
            TeacherClassSubject.class_id == class_id,
            TeacherClassSubject.subject_id == req.subject_id,
        ).first()
        if existing:
            existing.teacher_id = req.teacher_id
            existing.school_id = teacher.school_id
            affected_ids.append(existing.id)
            continue

        obj = TeacherClassSubject(
            school_id=teacher.school_id,
            teacher_id=req.teacher_id,
            class_id=class_id,
            subject_id=req.subject_id,
        )
        db.add(obj)
        db.flush()
        affected_ids.append(obj.id)

    db.commit()

    saved_rows = (
        db.query(TeacherClassSubject)
        .filter(TeacherClassSubject.id.in_(affected_ids))
        .order_by(TeacherClassSubject.id.desc())
        .all()
    )
    return _build_subject_assignment_response(db, saved_rows)


@router.delete("/subject-assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_teacher_subject_assignment(
    assignment_id: int,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)

    obj = db.query(TeacherClassSubject).filter(TeacherClassSubject.id == assignment_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="记录不存在")
    if school_id is not None and obj.school_id != school_id:
        raise HTTPException(status_code=403, detail="无权限操作该记录")

    db.delete(obj)
    db.commit()


@router.delete("/{tc_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_teacher_class(
    tc_id: int,
    current_user: User = Depends(require_admin_or_school_admin),
    db: Session = Depends(get_db),
):
    school_id = get_user_school_id(current_user)

    obj = db.query(TeacherClass).filter(TeacherClass.id == tc_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="关联记录不存在")

    cls = db.query(Class).filter(Class.id == obj.class_id).first()
    if school_id is not None and cls and cls.school_id != school_id:
        raise HTTPException(status_code=403, detail="无权限操作该记录")

    teacher_id = int(obj.teacher_id)
    class_id = int(obj.class_id)
    school_id_for_row = int(cls.school_id) if cls and cls.school_id is not None else None

    db.delete(obj)

    cleanup_query = db.query(TeacherClassSubject).filter(
        TeacherClassSubject.teacher_id == teacher_id,
        TeacherClassSubject.class_id == class_id,
    )
    if school_id_for_row is not None:
        cleanup_query = cleanup_query.filter(TeacherClassSubject.school_id == school_id_for_row)
    cleanup_query.delete(synchronize_session=False)

    db.commit()
