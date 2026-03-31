from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


SlotKey = tuple[int, int]


@dataclass
class CompiledSlot:
    key: SlotKey
    weekday: int
    period_id: int
    session: str = "any"
    period_order: int = 0


@dataclass
class CompiledLesson:
    lesson_id: str
    class_id: int
    subject_id: int
    teacher_id: int
    subject_name: str = ""
    preferred_session: str = "any"
    daily_max_hours: int = 99
    candidate_slots: list[CompiledSlot] = field(default_factory=list)


@dataclass
class CompiledProblem:
    grade: str
    lessons: list[CompiledLesson]
    slots: list[CompiledSlot]
    locked_assignments: list[dict[str, int]]
    teacher_daily_limits: dict[int, int]
    teacher_forbidden_slots: dict[int, set[SlotKey]]


def _normalize_slot(raw: dict[str, Any]) -> CompiledSlot:
    weekday = int(raw.get("weekday"))
    period_id = int(raw.get("period_id") or raw.get("id"))
    period_order = int(raw.get("period_order") or raw.get("sort_order") or period_id)
    session = str(raw.get("session") or "any")
    return CompiledSlot(
        key=(weekday, period_id),
        weekday=weekday,
        period_id=period_id,
        session=session,
        period_order=period_order,
    )


def _build_slots(raw_config: dict[str, Any]) -> list[CompiledSlot]:
    raw_slots = raw_config.get("slots")
    if isinstance(raw_slots, list) and raw_slots:
        return [_normalize_slot(item) for item in raw_slots]

    periods = raw_config.get("periods") or []
    if periods and isinstance(periods[0], dict) and periods[0].get("weekday") is not None:
        return [_normalize_slot(item) for item in periods]

    slots: list[CompiledSlot] = []
    for weekday in range(1, 6):
        for item in periods:
            raw_item = dict(item)
            raw_item["weekday"] = weekday
            raw_item["period_id"] = raw_item.get("period_id") or raw_item.get("id")
            slots.append(_normalize_slot(raw_item))
    return slots


def _normalize_forbidden(values: list[list[int]] | None) -> set[SlotKey]:
    result: set[SlotKey] = set()
    for item in values or []:
        if not isinstance(item, (list, tuple)) or len(item) != 2:
            continue
        try:
            result.add((int(item[0]), int(item[1])))
        except (TypeError, ValueError):
            continue
    return result


def compile_problem(raw_config: dict[str, Any]) -> CompiledProblem:
    arrangements = raw_config.get("arrangements") or []
    lesson_plans = raw_config.get("lesson_plans") or []
    teacher_constraints = raw_config.get("teacher_constraints") or []
    locks = raw_config.get("locks") or []
    slots = _build_slots(raw_config)
    slot_map = {slot.key: slot for slot in slots}

    teacher_daily_limits: dict[int, int] = {}
    teacher_forbidden_slots: dict[int, set[SlotKey]] = {}
    for item in teacher_constraints:
        teacher_id = int(item.get("teacher_id"))
        teacher_daily_limits[teacher_id] = int(item.get("daily_max_hours") or 0)
        teacher_forbidden_slots[teacher_id] = _normalize_forbidden(item.get("forbidden_periods") or item.get("forbidden_slots") or [])

    plan_map: dict[tuple[int, int], dict[str, Any]] = {}
    for plan in lesson_plans:
        class_id = int(plan.get("class_id") or 0)
        subject_id = int(plan.get("subject_id") or 0)
        if subject_id:
            plan_map[(class_id, subject_id)] = dict(plan)

    locks_by_group: dict[tuple[int, int, int], list[dict[str, int]]] = {}
    for lock in locks:
        group_key = (int(lock.get("class_id")), int(lock.get("subject_id")), int(lock.get("teacher_id")))
        locks_by_group.setdefault(group_key, []).append(
            {
                "class_id": int(lock.get("class_id")),
                "subject_id": int(lock.get("subject_id")),
                "teacher_id": int(lock.get("teacher_id")),
                "weekday": int(lock.get("weekday")),
                "period_id": int(lock.get("period_id")),
            }
        )
    for items in locks_by_group.values():
        items.sort(key=lambda item: (item["weekday"], item["period_id"]))

    lessons: list[CompiledLesson] = []
    for arrangement in arrangements:
        class_id = int(arrangement.get("class_id"))
        subject_id = int(arrangement.get("subject_id"))
        teacher_id = int(arrangement.get("teacher_id"))
        plan = plan_map.get((class_id, subject_id)) or plan_map.get((0, subject_id)) or {}
        weekly_hours = int(plan.get("weekly_hours") or arrangement.get("weekly_hours") or 0)
        if weekly_hours <= 0:
            continue
        preferred_session = str(plan.get("preferred_session") or arrangement.get("preferred_session") or "any")
        daily_max_hours = int(plan.get("daily_max_hours") or arrangement.get("daily_max_hours") or 99)
        forbidden_slots = _normalize_forbidden(plan.get("forbidden_periods") or arrangement.get("forbidden_periods") or [])
        lock_group = list(locks_by_group.get((class_id, subject_id, teacher_id), []))

        for index in range(weekly_hours):
            lesson_id = f"{class_id}:{subject_id}:{teacher_id}:{index + 1}"
            lock = lock_group[index] if index < len(lock_group) else None
            if lock:
                candidate_slots = [slot_map[(lock["weekday"], lock["period_id"])] ] if (lock["weekday"], lock["period_id"]) in slot_map else []
            else:
                candidate_slots = [
                    slot
                    for slot in slots
                    if slot.key not in forbidden_slots
                    and slot.key not in teacher_forbidden_slots.get(teacher_id, set())
                ]
            lessons.append(
                CompiledLesson(
                    lesson_id=lesson_id,
                    class_id=class_id,
                    subject_id=subject_id,
                    teacher_id=teacher_id,
                    subject_name=str(arrangement.get("subject_name") or plan.get("subject_name") or ""),
                    preferred_session=preferred_session,
                    daily_max_hours=daily_max_hours,
                    candidate_slots=candidate_slots,
                )
            )

    return CompiledProblem(
        grade=str(raw_config.get("grade") or ""),
        lessons=lessons,
        slots=slots,
        locked_assignments=[item for values in locks_by_group.values() for item in values],
        teacher_daily_limits=teacher_daily_limits,
        teacher_forbidden_slots=teacher_forbidden_slots,
    )
