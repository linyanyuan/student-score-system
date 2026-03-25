from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session, sessionmaker

from app.database import SessionLocal
from app.dependencies import get_db, require_school_admin
from app.models.class_ import Class
from app.models.class_timetable import ClassTimetable
from app.models.lesson_plan import LessonPlan
from app.models.schedule_period import SchedulePeriod
from app.models.schedule_task import ScheduleTask
from app.models.subject import Subject
from app.models.teacher_class_subject import TeacherClassSubject
from app.models.user import User
from app.schemas.scheduling import (
    LessonPlanBatchResponse,
    LessonPlanBatchSaveRequest,
    LessonPlanConfig,
    ScheduleTaskCreateResponse,
    ScheduleTaskResponse,
    TeachingArrangementBatchResponse,
    TeachingArrangementBatchSaveRequest,
    TeachingArrangementItem,
)
from app.services.scheduling.engine import BacktrackingScheduleEngine

router = APIRouter(prefix="/api/schedule", tags=["schedule"])


def _normalize_forbidden_periods(values: Any) -> list[list[int]]:
    normalized: list[list[int]] = []
    if not isinstance(values, list):
        return normalized

    for item in values:
        if not isinstance(item, (list, tuple)) or len(item) != 2:
            continue
        try:
            weekday = int(item[0])
            period = int(item[1])
        except (TypeError, ValueError):
            continue
        if weekday < 1 or weekday > 7 or period <= 0:
            continue
        normalized.append([weekday, period])
    return normalized


def _encode_lesson_plan_content(item: LessonPlanConfig) -> str:
    payload = {
        "weekly_hours": max(0, int(item.weekly_hours)),
        "priority": int(item.priority),
        "avoid_consecutive": bool(item.avoid_consecutive),
        "forbidden_periods": _normalize_forbidden_periods(item.forbidden_periods),
    }
    return json.dumps(payload, ensure_ascii=False)


def _decode_lesson_plan_content(content: str | None) -> dict[str, Any]:
    raw: dict[str, Any]
    if not content:
        raw = {}
    else:
        try:
            loaded = json.loads(content)
            raw = loaded if isinstance(loaded, dict) else {}
        except json.JSONDecodeError:
            raw = {}

    weekly_hours = raw.get("weekly_hours", 0)
    priority = raw.get("priority", 1)

    try:
        weekly_hours_int = max(0, int(weekly_hours))
    except (TypeError, ValueError):
        weekly_hours_int = 0

    try:
        priority_int = int(priority)
    except (TypeError, ValueError):
        priority_int = 1

    return {
        "weekly_hours": weekly_hours_int,
        "priority": priority_int,
        "avoid_consecutive": bool(raw.get("avoid_consecutive", False)),
        "forbidden_periods": _normalize_forbidden_periods(raw.get("forbidden_periods") or raw.get("forbidden_slots") or []),
    }


def _require_school_id(current_user: User) -> int:
    if current_user.school_id is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="当前账户缺少学校信息")
    return current_user.school_id


def _to_lesson_plan_response(grade: str, plans: list[LessonPlan]) -> LessonPlanBatchResponse:
    items: list[LessonPlanConfig] = []
    for plan in plans:
        decoded = _decode_lesson_plan_content(plan.content)
        items.append(
            LessonPlanConfig(
                subject_id=plan.subject_id,
                weekly_hours=decoded["weekly_hours"],
                priority=decoded["priority"],
                avoid_consecutive=decoded["avoid_consecutive"],
                forbidden_periods=decoded["forbidden_periods"],
            )
        )
    return LessonPlanBatchResponse(grade=grade, items=items)


def _to_task_response(task: ScheduleTask) -> ScheduleTaskResponse:
    result: Any = task.result
    if isinstance(task.result, str):
        try:
            result = json.loads(task.result)
        except json.JSONDecodeError:
            result = task.result
    return ScheduleTaskResponse(
        id=task.id,
        status=task.status,
        progress=task.progress,
        message=task.message,
        result=result,
        error=task.error,
        started_at=task.started_at,
        finished_at=task.finished_at,
    )


def _mark_task_failed(task_db: Session, task: ScheduleTask, message: str, *, error: str | None = None, progress: int | None = None) -> None:
    task_db.rollback()
    task.status = "failed"
    task.message = message
    task.error = error or message
    if progress is not None:
        task.progress = max(0, min(99, progress))
    task.finished_at = datetime.now()
    task_db.commit()

def _slot_weekday_period(slot: Any) -> tuple[int, int]:
    if isinstance(slot, dict):
        return int(slot.get("weekday")), int(slot.get("period"))
    if isinstance(slot, (list, tuple)) and len(slot) >= 2:
        return int(slot[0]), int(slot[1])
    raise ValueError("invalid slot shape")


def _run_schedule_task(task_id: int, session_factory: sessionmaker = SessionLocal) -> None:
    task_db = session_factory()
    try:
        task = task_db.query(ScheduleTask).filter(ScheduleTask.id == task_id).first()
        if not task:
            return

        task.status = "running"
        task.progress = 10
        task.message = "正在加载排课数据"
        task.error = None
        task.started_at = datetime.now()
        task.finished_at = None
        task_db.commit()

        classes = (
            task_db.query(Class)
            .filter(Class.school_id == task.school_id, Class.grade == task.grade)
            .order_by(Class.id)
            .all()
        )
        class_ids = [item.id for item in classes]
        if not class_ids:
            _mark_task_failed(task_db, task, "目标年级未找到班级", progress=10)
            return

        periods = (
            task_db.query(SchedulePeriod)
            .filter(SchedulePeriod.is_active == True)
            .order_by(SchedulePeriod.sort_order, SchedulePeriod.id)
            .all()
        )
        if not periods:
            _mark_task_failed(task_db, task, "未配置有效节次", progress=10)
            return

        lesson_plans = (
            task_db.query(LessonPlan)
            .filter(LessonPlan.school_id == task.school_id, LessonPlan.grade == task.grade)
            .all()
        )
        if not lesson_plans:
            _mark_task_failed(task_db, task, "该年级未配置课时计划", progress=10)
            return

        arrangements = (
            task_db.query(TeacherClassSubject)
            .filter(TeacherClassSubject.class_id.in_(class_ids))
            .all()
        )
        if not arrangements:
            _mark_task_failed(task_db, task, "该年级未配置授课安排", progress=10)
            return

        lesson_plan_map = {item.subject_id: _decode_lesson_plan_content(item.content) for item in lesson_plans}
        slots: list[dict[str, int]] = []
        for weekday in range(1, 6):
            for period in periods:
                slots.append({"weekday": weekday, "period": period.id})

        engine_tasks: list[dict[str, Any]] = []
        task_meta: dict[str, dict[str, int]] = {}

        for arrangement in arrangements:
            plan = lesson_plan_map.get(arrangement.subject_id)
            if not plan:
                continue

            weekly_hours = max(0, int(plan.get("weekly_hours", 0)))
            if weekly_hours <= 0:
                continue

            for index in range(weekly_hours):
                engine_task_id = f"{arrangement.class_id}:{arrangement.subject_id}:{index + 1}"
                engine_tasks.append(
                    {
                        "id": engine_task_id,
                        "class_id": arrangement.class_id,
                        "teacher_id": arrangement.teacher_id,
                        "subject_id": arrangement.subject_id,
                        "priority": int(plan.get("priority", 1)),
                        "avoid_consecutive": bool(plan.get("avoid_consecutive", False)),
                        "forbidden_slots": [
                            {"weekday": item[0], "period": item[1]}
                            for item in _normalize_forbidden_periods(plan.get("forbidden_periods", []))
                        ],
                        "candidate_slots": slots,
                    }
                )
                task_meta[engine_task_id] = {
                    "class_id": arrangement.class_id,
                    "teacher_id": arrangement.teacher_id,
                    "subject_id": arrangement.subject_id,
                }

        if not engine_tasks:
            _mark_task_failed(task_db, task, "未生成可排课任务", progress=10)
            return

        task.progress = 60
        task.message = "正在自动排课"
        task_db.commit()

        result = BacktrackingScheduleEngine().solve(tasks=engine_tasks, slots=slots)
        if not result.success:
            _mark_task_failed(task_db, task, result.message or "排课求解失败", progress=60)
            return

        timetable_rows: list[ClassTimetable] = []
        for engine_task_id, slot in result.assignments.items():
            meta = task_meta.get(str(engine_task_id))
            if not meta:
                continue
            weekday, period_id = _slot_weekday_period(slot)
            timetable_rows.append(
                ClassTimetable(
                    class_id=meta["class_id"],
                    teacher_id=meta["teacher_id"],
                    subject_id=meta["subject_id"],
                    weekday=weekday,
                    period_id=period_id,
                )
            )

        if len(timetable_rows) != len(engine_tasks):
            _mark_task_failed(task_db, task, "排课结果不完整", progress=60)
            return

        try:
            with task_db.begin():
                task_db.query(ClassTimetable).filter(ClassTimetable.class_id.in_(class_ids)).delete(synchronize_session=False)
                task_db.add_all(timetable_rows)
        except Exception as exc:
            _mark_task_failed(task_db, task, "写入课表失败", error=str(exc), progress=60)
            return

        task.status = "success"
        task.progress = 100
        task.message = "排课完成"
        task.result = json.dumps({"rows": len(timetable_rows)}, ensure_ascii=False)
        task.error = None
        task.finished_at = datetime.now()
        task_db.commit()
    except Exception as exc:
        task = task_db.query(ScheduleTask).filter(ScheduleTask.id == task_id).first()
        if task:
            _mark_task_failed(task_db, task, "排课过程中出现异常", error=str(exc), progress=60)
    finally:
        task_db.close()


@router.get("/lesson-plan/{grade}", response_model=LessonPlanBatchResponse)
def get_lesson_plan(
    grade: str,
    current_user: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
):
    school_id = _require_school_id(current_user)
    plans = (
        db.query(LessonPlan)
        .filter(LessonPlan.school_id == school_id, LessonPlan.grade == grade)
        .order_by(LessonPlan.subject_id)
        .all()
    )
    return _to_lesson_plan_response(grade, plans)


@router.post("/lesson-plan", response_model=LessonPlanBatchResponse)
def save_lesson_plan(
    req: LessonPlanBatchSaveRequest,
    current_user: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
):
    school_id = _require_school_id(current_user)

    subject_ids = {item.subject_id for item in req.items}
    if subject_ids:
        valid_subject_ids = {
            row[0]
            for row in db.query(Subject.id).filter(Subject.school_id == school_id, Subject.id.in_(subject_ids)).all()
        }
        invalid_subject_ids = sorted(subject_ids - valid_subject_ids)
        if invalid_subject_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"科目不属于当前学校: {invalid_subject_ids}",
            )

    unique_items: dict[int, LessonPlanConfig] = {}
    for item in req.items:
        unique_items[item.subject_id] = item

    db.query(LessonPlan).filter(LessonPlan.school_id == school_id, LessonPlan.grade == req.grade).delete(synchronize_session=False)

    for subject_id in sorted(unique_items.keys()):
        item = unique_items[subject_id]
        db.add(
            LessonPlan(
                school_id=school_id,
                grade=req.grade,
                subject_id=subject_id,
                content=_encode_lesson_plan_content(item),
            )
        )

    db.commit()

    saved = (
        db.query(LessonPlan)
        .filter(LessonPlan.school_id == school_id, LessonPlan.grade == req.grade)
        .order_by(LessonPlan.subject_id)
        .all()
    )
    return _to_lesson_plan_response(req.grade, saved)


@router.get("/teaching-arrangement/{grade}", response_model=TeachingArrangementBatchResponse)
def get_teaching_arrangement(
    grade: str,
    current_user: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
):
    school_id = _require_school_id(current_user)
    class_ids = [
        row[0]
        for row in db.query(Class.id).filter(Class.school_id == school_id, Class.grade == grade).all()
    ]
    if not class_ids:
        return TeachingArrangementBatchResponse(grade=grade, items=[])

    rows = (
        db.query(TeacherClassSubject)
        .filter(TeacherClassSubject.class_id.in_(class_ids))
        .order_by(TeacherClassSubject.class_id, TeacherClassSubject.subject_id)
        .all()
    )
    items = [
        TeachingArrangementItem(
            class_id=row.class_id,
            subject_id=row.subject_id,
            teacher_id=row.teacher_id,
        )
        for row in rows
    ]
    return TeachingArrangementBatchResponse(grade=grade, items=items)


@router.post("/teaching-arrangement", response_model=TeachingArrangementBatchResponse)
def save_teaching_arrangement(
    req: TeachingArrangementBatchSaveRequest,
    current_user: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
):
    school_id = _require_school_id(current_user)

    class_ids_for_grade = {
        row[0]
        for row in db.query(Class.id).filter(Class.school_id == school_id, Class.grade == req.grade).all()
    }

    subject_ids_for_school = {
        row[0]
        for row in db.query(Subject.id).filter(Subject.school_id == school_id).all()
    }

    teacher_ids_for_school = {
        row[0]
        for row in db.query(User.id).filter(User.school_id == school_id, User.role == "teacher").all()
    }

    for item in req.items:
        if item.class_id not in class_ids_for_grade:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"班级不属于当前年级: {item.class_id}")
        if item.subject_id not in subject_ids_for_school:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"科目不属于当前学校: {item.subject_id}")
        if item.teacher_id not in teacher_ids_for_school:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"教师不属于当前学校: {item.teacher_id}")

    unique_items: dict[tuple[int, int], TeachingArrangementItem] = {}
    for item in req.items:
        unique_items[(item.class_id, item.subject_id)] = item

    if class_ids_for_grade:
        db.query(TeacherClassSubject).filter(TeacherClassSubject.class_id.in_(class_ids_for_grade)).delete(synchronize_session=False)

    for key in sorted(unique_items.keys()):
        item = unique_items[key]
        db.add(
            TeacherClassSubject(
                class_id=item.class_id,
                subject_id=item.subject_id,
                teacher_id=item.teacher_id,
            )
        )

    db.commit()

    return TeachingArrangementBatchResponse(grade=req.grade, items=[unique_items[key] for key in sorted(unique_items.keys())])


@router.post("/auto/{grade}", status_code=status.HTTP_202_ACCEPTED, response_model=ScheduleTaskCreateResponse)
def create_auto_schedule_task(
    grade: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
):
    school_id = _require_school_id(current_user)

    active_task = (
        db.query(ScheduleTask)
        .filter(
            ScheduleTask.school_id == school_id,
            ScheduleTask.grade == grade,
            ScheduleTask.status.in_(["pending", "running"]),
        )
        .order_by(ScheduleTask.id.desc())
        .first()
    )
    if active_task:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"当前年级已有进行中的排课任务: {active_task.id}",
        )

    task = ScheduleTask(
        school_id=school_id,
        grade=grade,
        status="pending",
        progress=0,
        message="排队中",
        context=json.dumps({"triggered_by": current_user.id}, ensure_ascii=False),
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    bind = db.get_bind()
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=bind)
    background_tasks.add_task(_run_schedule_task, task.id, session_factory)

    return ScheduleTaskCreateResponse(task_id=task.id, status=task.status)


@router.get("/tasks/{task_id}", response_model=ScheduleTaskResponse)
def get_schedule_task(
    task_id: int,
    current_user: User = Depends(require_school_admin),
    db: Session = Depends(get_db),
):
    school_id = _require_school_id(current_user)
    task = (
        db.query(ScheduleTask)
        .filter(ScheduleTask.id == task_id, ScheduleTask.school_id == school_id)
        .first()
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return _to_task_response(task)









