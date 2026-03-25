from __future__ import annotations

from typing import Any, Mapping, Protocol

Task = Mapping[str, Any]
Assignments = dict[str, Any]
TasksById = Mapping[str, Task]


class Constraint(Protocol):
    def validate(self, task: Task, slot: Any, assignments: Assignments, tasks_by_id: TasksById) -> str | None:
        ...


def slot_key(slot: Any) -> Any:
    if isinstance(slot, dict):
        return (slot.get("weekday"), slot.get("period"))
    if isinstance(slot, (tuple, list)) and len(slot) >= 2:
        return (slot[0], slot[1])
    return slot


def _slots_equal(left: Any, right: Any) -> bool:
    return slot_key(left) == slot_key(right)


def _is_consecutive(left: Any, right: Any) -> bool:
    lk = slot_key(left)
    rk = slot_key(right)
    if not (isinstance(lk, tuple) and isinstance(rk, tuple) and len(lk) == 2 and len(rk) == 2):
        return False

    day_left, period_left = lk
    day_right, period_right = rk
    if day_left != day_right:
        return False

    if not isinstance(period_left, int) or not isinstance(period_right, int):
        return False

    return abs(period_left - period_right) == 1


class ClassSlotConflictConstraint:
    def validate(self, task: Task, slot: Any, assignments: Assignments, tasks_by_id: TasksById) -> str | None:
        class_id = task.get("class_id")
        if class_id is None:
            return None

        for other_task_id, other_slot in assignments.items():
            other_task = tasks_by_id.get(other_task_id)
            if not other_task:
                continue
            if other_task.get("class_id") == class_id and _slots_equal(other_slot, slot):
                return f"class slot conflict with task {other_task_id}"
        return None


class TeacherSlotConflictConstraint:
    def validate(self, task: Task, slot: Any, assignments: Assignments, tasks_by_id: TasksById) -> str | None:
        teacher_id = task.get("teacher_id")
        if teacher_id is None:
            return None

        for other_task_id, other_slot in assignments.items():
            other_task = tasks_by_id.get(other_task_id)
            if not other_task:
                continue
            if other_task.get("teacher_id") == teacher_id and _slots_equal(other_slot, slot):
                return f"teacher slot conflict with task {other_task_id}"
        return None


class AvoidConsecutiveConstraint:
    def validate(self, task: Task, slot: Any, assignments: Assignments, tasks_by_id: TasksById) -> str | None:
        current_avoids_consecutive = task.get("avoid_consecutive", False)

        teacher_id = task.get("teacher_id")
        class_id = task.get("class_id")

        for other_task_id, other_slot in assignments.items():
            other_task = tasks_by_id.get(other_task_id)
            if not other_task:
                continue

            if not (current_avoids_consecutive or other_task.get("avoid_consecutive", False)):
                continue

            shares_teacher = teacher_id is not None and other_task.get("teacher_id") == teacher_id
            shares_class = class_id is not None and other_task.get("class_id") == class_id
            if (shares_teacher or shares_class) and _is_consecutive(slot, other_slot):
                return f"consecutive slot conflict with task {other_task_id}"
        return None


class ForbiddenPeriodsConstraint:
    def validate(self, task: Task, slot: Any, assignments: Assignments, tasks_by_id: TasksById) -> str | None:
        forbidden_slots = task.get("forbidden_slots") or task.get("forbidden_periods") or []
        for forbidden in forbidden_slots:
            if _slots_equal(forbidden, slot):
                return "slot is forbidden for this task"
        return None


DEFAULT_CONSTRAINTS = [
    ClassSlotConflictConstraint(),
    TeacherSlotConflictConstraint(),
    AvoidConsecutiveConstraint(),
    ForbiddenPeriodsConstraint(),
]

