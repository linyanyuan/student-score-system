from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.class_ import Class
from app.models.lesson_plan import LessonPlan
from app.models.lesson_plan_override import LessonPlanOverride
from app.models.schedule_period import SchedulePeriod
from app.models.schedule_period_plan import SchedulePeriodPlan
from app.models.subject import Subject
from app.models.teacher_class_subject import TeacherClassSubject
from app.models.teacher_time_constraint import TeacherTimeConstraint
from app.models.timetable_lock import TimetableLock


def _parse_grade_tokens(raw: str | None) -> set[str]:
    if not raw:
        return set()
    normalized = str(raw).replace("，", ",").replace("、", ",")
    return {token.strip() for token in normalized.split(",") if token and token.strip()}


def subject_applies_to_grade(subject_grades: str | None, grade: str | None) -> bool:
    if not grade:
        return True
    supported_grades = _parse_grade_tokens(subject_grades)
    if not supported_grades:
        return True
    return grade in supported_grades


def decode_json_content(content: str | None) -> dict[str, Any]:
    if not content:
        return {}
    try:
        payload = json.loads(content)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def decode_period_plan_ids(content: str | None) -> list[int]:
    payload = decode_json_content(content)
    raw_ids = payload.get("period_ids") or []
    result: list[int] = []
    seen: set[int] = set()
    for raw_id in raw_ids:
        try:
            period_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        if period_id > 0 and period_id not in seen:
            result.append(period_id)
            seen.add(period_id)
    return result


def _session_for_period(period: SchedulePeriod) -> str:
    start = str(period.start_time or "")
    try:
        hour_str, minute_str = start.split(":", 1)
        minutes = int(hour_str) * 60 + int(minute_str)
    except (TypeError, ValueError):
        return "afternoon"
    return "morning" if minutes < 12 * 60 else "afternoon"


def load_scheduling_raw_config(db: Session, school_id: int, grade: str) -> dict[str, Any]:
    classes = (
        db.query(Class)
        .filter(Class.school_id == school_id, Class.grade == grade)
        .order_by(Class.id)
        .all()
    )
    class_ids = [item.id for item in classes]

    period_plan = (
        db.query(SchedulePeriodPlan)
        .filter(SchedulePeriodPlan.school_id == school_id, SchedulePeriodPlan.grade == grade)
        .first()
    )
    selected_period_ids = decode_period_plan_ids(period_plan.config) if period_plan else None
    if selected_period_ids == []:
        periods = []
    else:
        period_query = db.query(SchedulePeriod).filter(
            SchedulePeriod.school_id == school_id,
            SchedulePeriod.is_active == True,
            SchedulePeriod.include_in_auto_schedule == True,
        )
        if selected_period_ids is not None:
            period_query = period_query.filter(SchedulePeriod.id.in_(selected_period_ids))
        periods = period_query.order_by(SchedulePeriod.sort_order, SchedulePeriod.id).all()
    slots: list[dict[str, Any]] = []
    for weekday in range(1, 6):
        for period in periods:
            slots.append(
                {
                    "weekday": weekday,
                    "period_id": int(period.id),
                    "period_order": int(period.sort_order),
                    "session": _session_for_period(period),
                }
            )

    subjects = db.query(Subject).filter(Subject.school_id == school_id).all()
    subject_name_map = {int(item.id): str(item.name or "") for item in subjects if subject_applies_to_grade(item.grades, grade)}
    valid_subject_ids = set(subject_name_map)

    arrangements = []
    if class_ids:
        rows = (
            db.query(TeacherClassSubject)
            .filter(
                TeacherClassSubject.school_id == school_id,
                TeacherClassSubject.class_id.in_(class_ids),
                TeacherClassSubject.subject_id.in_(valid_subject_ids),
            )
            .all()
        )
        for row in rows:
            arrangements.append(
                {
                    "class_id": int(row.class_id),
                    "subject_id": int(row.subject_id),
                    "teacher_id": int(row.teacher_id),
                    "subject_name": subject_name_map.get(int(row.subject_id), ""),
                }
            )

    lesson_plans = []
    for row in (
        db.query(LessonPlan)
        .filter(LessonPlan.school_id == school_id, LessonPlan.grade == grade)
        .order_by(LessonPlan.subject_id)
        .all()
    ):
        payload = decode_json_content(row.content)
        payload.update({"class_id": 0, "subject_id": int(row.subject_id)})
        lesson_plans.append(payload)

    for row in (
        db.query(LessonPlanOverride)
        .filter(LessonPlanOverride.school_id == school_id, LessonPlanOverride.grade == grade)
        .all()
    ):
        payload = decode_json_content(row.config)
        payload.update({"class_id": int(row.class_id), "subject_id": int(row.subject_id)})
        lesson_plans.append(payload)

    teacher_constraints = []
    for row in (
        db.query(TeacherTimeConstraint)
        .filter(TeacherTimeConstraint.school_id == school_id, TeacherTimeConstraint.grade == grade)
        .all()
    ):
        payload = decode_json_content(row.config)
        payload.update({"teacher_id": int(row.teacher_id)})
        teacher_constraints.append(payload)

    locks = []
    for row in (
        db.query(TimetableLock)
        .filter(TimetableLock.school_id == school_id, TimetableLock.grade == grade)
        .all()
    ):
        locks.append(
            {
                "class_id": int(row.class_id),
                "subject_id": int(row.subject_id),
                "teacher_id": int(row.teacher_id),
                "weekday": int(row.weekday),
                "period_id": int(row.period_id),
            }
        )

    return {
        "grade": grade,
        "classes": [{"id": int(item.id), "name": str(item.name or "")} for item in classes],
        "periods": [{"id": int(item.id), "sort_order": int(item.sort_order), "start_time": item.start_time} for item in periods],
        "slots": slots,
        "arrangements": arrangements,
        "lesson_plans": lesson_plans,
        "teacher_constraints": teacher_constraints,
        "locks": locks,
    }
