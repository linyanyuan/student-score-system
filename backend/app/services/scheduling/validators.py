from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.services.scheduling.compiler import CompiledProblem


def _diag(code: str, message: str, *, blocking: bool = True, entity: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "code": code,
        "message": message,
        "blocking": blocking,
        "entity": entity or {},
    }


def validate_raw_config(raw_config: dict[str, Any]) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []
    classes = raw_config.get("classes") or []
    slots = raw_config.get("slots") or []
    arrangements = raw_config.get("arrangements") or []
    lesson_plans = raw_config.get("lesson_plans") or []

    if not classes:
        diagnostics.append(_diag("no_classes", "当前年级没有班级数据"))
    if not slots:
        diagnostics.append(_diag("no_slots", "当前没有可参与自动排课的节次配置"))
    if not arrangements:
        diagnostics.append(_diag("no_arrangements", "当前年级没有授课安排"))

    base_plan_subject_ids = {int(item.get("subject_id") or 0) for item in lesson_plans if int(item.get("class_id") or 0) == 0}
    sorted_base_plan_subject_ids = sorted(subject_id for subject_id in base_plan_subject_ids if subject_id)
    class_name_by_id = {int(item.get("id") or 0): str(item.get("name") or "").strip() for item in classes}
    arrangements_by_class: dict[int, set[int]] = defaultdict(set)
    subject_names: dict[int, str] = {}
    for arrangement in arrangements:
        class_id = int(arrangement.get("class_id") or 0)
        subject_id = int(arrangement.get("subject_id") or 0)
        subject_name = str(arrangement.get("subject_name") or "").strip()
        if class_id and subject_id:
            arrangements_by_class[class_id].add(subject_id)
        if subject_id and subject_name:
            subject_names.setdefault(subject_id, subject_name)
        if subject_id and subject_id not in base_plan_subject_ids:
            subject_label = f"{subject_name} (ID {subject_id})" if subject_name else str(subject_id)
            diagnostics.append(
                _diag(
                    "missing_lesson_plan",
                    f"科目 {subject_label} 未纳入本次课时计划，本次不会自动排课",
                    blocking=False,
                    entity={
                        "subject_id": subject_id,
                        "subject_name": subject_name,
                        "base_plan_subject_ids": sorted_base_plan_subject_ids,
                    },
                )
            )

    for plan in lesson_plans:
        if int(plan.get("class_id") or 0) != 0:
            continue
        subject_id = int(plan.get("subject_id") or 0)
        weekly_hours = int(plan.get("weekly_hours") or 0)
        if not subject_id or weekly_hours <= 0:
            continue
        subject_name = str(plan.get("subject_name") or "").strip() or subject_names.get(subject_id, "")
        subject_label = f"{subject_name} (ID {subject_id})" if subject_name else str(subject_id)
        for class_item in classes:
            class_id = int(class_item.get("id") or 0)
            if not class_id or subject_id in arrangements_by_class.get(class_id, set()):
                continue
            class_name = class_name_by_id.get(class_id, "")
            class_label = f"{class_name} (ID {class_id})" if class_name else str(class_id)
            diagnostics.append(
                _diag(
                    "missing_teaching_arrangement",
                    f"班级 {class_label} 未配置科目 {subject_label} 的任课安排，本次少排 {weekly_hours} 节",
                    blocking=True,
                    entity={
                        "class_id": class_id,
                        "class_name": class_name,
                        "subject_id": subject_id,
                        "subject_name": subject_name,
                        "weekly_hours": weekly_hours,
                    },
                )
            )

    total_hours = 0
    for item in lesson_plans:
        if int(item.get("class_id") or 0) != 0:
            continue
        total_hours += int(item.get("weekly_hours") or 0)
    total_capacity = len(slots)
    if classes and total_capacity and total_hours * len(classes) > total_capacity * len(classes):
        diagnostics.append(_diag("grade_capacity_exceeded", "年级总课时超过可用排课容量"))
    return diagnostics


def validate_compiled_problem(problem: CompiledProblem) -> list[dict[str, Any]]:
    diagnostics: list[dict[str, Any]] = []
    for lesson in problem.lessons:
        if not lesson.candidate_slots:
            diagnostics.append(
                _diag(
                    "no_candidate_slots",
                    f"课时 {lesson.lesson_id} 没有可用时段",
                    entity={"lesson_id": lesson.lesson_id},
                )
            )

    lessons_by_class: dict[int, list[Any]] = defaultdict(list)
    lessons_by_teacher: dict[int, list[Any]] = defaultdict(list)
    for lesson in problem.lessons:
        lessons_by_class[lesson.class_id].append(lesson)
        lessons_by_teacher[lesson.teacher_id].append(lesson)

    for class_id, lessons in lessons_by_class.items():
        available_slots = {slot.key for lesson in lessons for slot in lesson.candidate_slots}
        if len(lessons) > len(available_slots):
            diagnostics.append(
                _diag(
                    "class_capacity_exceeded",
                    f"班级 {class_id} 需要排 {len(lessons)} 节课，但可用课位只有 {len(available_slots)} 个",
                    entity={"class_id": class_id, "required_lessons": len(lessons), "available_slots": len(available_slots)},
                )
            )

    for teacher_id, lessons in lessons_by_teacher.items():
        available_slots = {slot.key for lesson in lessons for slot in lesson.candidate_slots}
        if len(lessons) > len(available_slots):
            diagnostics.append(
                _diag(
                    "teacher_capacity_exceeded",
                    f"教师 {teacher_id} 需要排 {len(lessons)} 节课，但可用课位只有 {len(available_slots)} 个",
                    entity={"teacher_id": teacher_id, "required_lessons": len(lessons), "available_slots": len(available_slots)},
                )
            )
        daily_limit = int(problem.teacher_daily_limits.get(teacher_id) or 0)
        if daily_limit > 0:
            available_weekdays = {slot.weekday for lesson in lessons for slot in lesson.candidate_slots}
            daily_capacity = len(available_weekdays) * daily_limit
            if len(lessons) > daily_capacity:
                diagnostics.append(
                    _diag(
                        "teacher_daily_capacity_exceeded",
                        f"教师 {teacher_id} 需要排 {len(lessons)} 节课，但按每日上限只能排 {daily_capacity} 节",
                        entity={
                            "teacher_id": teacher_id,
                            "required_lessons": len(lessons),
                            "daily_limit": daily_limit,
                            "available_weekdays": sorted(available_weekdays),
                            "daily_capacity": daily_capacity,
                        },
                    )
                )

    lessons_by_class_subject: dict[tuple[int, int], list[Any]] = defaultdict(list)
    for lesson in problem.lessons:
        lessons_by_class_subject[(lesson.class_id, lesson.subject_id)].append(lesson)

    for (class_id, subject_id), lessons in lessons_by_class_subject.items():
        daily_max_hours = min(int(lesson.daily_max_hours or 99) for lesson in lessons)
        if daily_max_hours <= 0 or daily_max_hours >= 99:
            continue
        available_weekdays = {slot.weekday for lesson in lessons for slot in lesson.candidate_slots}
        daily_capacity = len(available_weekdays) * daily_max_hours
        if len(lessons) > daily_capacity:
            diagnostics.append(
                _diag(
                    "subject_daily_capacity_exceeded",
                    f"班级 {class_id} 科目 {subject_id} 需要排 {len(lessons)} 节课，但按单日上限只能排 {daily_capacity} 节",
                    entity={
                        "class_id": class_id,
                        "subject_id": subject_id,
                        "required_lessons": len(lessons),
                        "daily_max_hours": daily_max_hours,
                        "available_weekdays": sorted(available_weekdays),
                        "daily_capacity": daily_capacity,
                    },
                )
            )

    locked_by_class_slot: dict[tuple[int, int, int], list[dict[str, int]]] = defaultdict(list)
    locked_by_teacher_slot: dict[tuple[int, int, int], list[dict[str, int]]] = defaultdict(list)
    for item in problem.locked_assignments:
        class_slot = (int(item["class_id"]), int(item["weekday"]), int(item["period_id"]))
        teacher_slot = (int(item["teacher_id"]), int(item["weekday"]), int(item["period_id"]))
        locked_by_class_slot[class_slot].append(item)
        locked_by_teacher_slot[teacher_slot].append(item)

    for (class_id, weekday, period_id), items in locked_by_class_slot.items():
        if len(items) > 1:
            diagnostics.append(
                _diag(
                    "locked_class_slot_conflict",
                    f"班级 {class_id} 在星期 {weekday} 第 {period_id} 节有 {len(items)} 个锁定课位",
                    entity={"class_id": class_id, "weekday": weekday, "period_id": period_id, "locked_count": len(items)},
                )
            )

    for (teacher_id, weekday, period_id), items in locked_by_teacher_slot.items():
        if len(items) > 1:
            diagnostics.append(
                _diag(
                    "locked_teacher_slot_conflict",
                    f"教师 {teacher_id} 在星期 {weekday} 第 {period_id} 节有 {len(items)} 个锁定课位",
                    entity={"teacher_id": teacher_id, "weekday": weekday, "period_id": period_id, "locked_count": len(items)},
                )
            )
    return diagnostics


def build_publish_checks(diagnostics: list[dict[str, Any]], score: int | None) -> list[dict[str, Any]]:
    checks = list(diagnostics)
    if score is not None and score < 60:
        checks.append(_diag("low_score", "草案得分较低，建议人工复核后再发布", blocking=False))
    return checks
