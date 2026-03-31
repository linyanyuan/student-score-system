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


def _slot_order_value(slot: Any) -> tuple[int, int]:
    key = slot_key(slot)
    if isinstance(key, tuple) and len(key) == 2:
        try:
            return int(key[0]), int(key[1])
        except (TypeError, ValueError):
            return (10**9, 10**9)
    return (10**9, 10**9)


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
                return f"班级时间冲突，任务 {other_task_id}"
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
                return f"教师时间冲突，任务 {other_task_id}"
        return None


class AvoidConsecutiveConstraint:
    def validate(self, task: Task, slot: Any, assignments: Assignments, tasks_by_id: TasksById) -> str | None:
        current_avoids_consecutive = task.get("avoid_consecutive", False)

        class_id = task.get("class_id")
        subject_id = task.get("subject_id")

        for other_task_id, other_slot in assignments.items():
            other_task = tasks_by_id.get(other_task_id)
            if not other_task:
                continue

            if not (current_avoids_consecutive or other_task.get("avoid_consecutive", False)):
                continue

            # 连堂约束只限制“同班同科”连续节次。
            # 教师跨班连续上课在业务上是允许的，不应算冲突。
            same_class = class_id is not None and other_task.get("class_id") == class_id
            same_subject = subject_id is not None and other_task.get("subject_id") == subject_id
            if same_class and same_subject and _is_consecutive(slot, other_slot):
                return f"同班同科连堂冲突，任务 {other_task_id}"
        return None


class ForbiddenPeriodsConstraint:
    def validate(self, task: Task, slot: Any, assignments: Assignments, tasks_by_id: TasksById) -> str | None:
        forbidden_slots = task.get("forbidden_slots") or task.get("forbidden_periods") or []
        for forbidden in forbidden_slots:
            if _slots_equal(forbidden, slot):
                return "命中禁排时段"
        return None


class SameCourseOrderingConstraint:
    """
    Symmetry breaking: for identical split tasks of the same course group,
    require sequence N to be scheduled after sequence N-1.
    This does not change solution space, only removes equivalent permutations.
    """

    def validate(self, task: Task, slot: Any, assignments: Assignments, tasks_by_id: TasksById) -> str | None:
        group_key = task.get("group_key")
        sequence_raw = task.get("sequence")
        if not group_key:
            return None
        try:
            sequence = int(sequence_raw or 0)
        except (TypeError, ValueError):
            return None
        if sequence <= 1:
            return None

        prev_task_id = f"{group_key}:{sequence - 1}"
        prev_slot = assignments.get(prev_task_id)
        if prev_slot is None:
            return None

        if _slot_order_value(slot) <= _slot_order_value(prev_slot):
            return f"同课程任务顺序冲突，需晚于 {prev_task_id}"
        return None


class DailySubjectLimitConstraint:
    def validate(self, task: Task, slot: Any, assignments: Assignments, tasks_by_id: TasksById) -> str | None:
        class_id = task.get("class_id")
        subject_id = task.get("subject_id")
        if class_id is None or subject_id is None:
            return None

        max_per_day_raw = task.get("daily_max_hours")
        try:
            max_per_day = int(max_per_day_raw)
        except (TypeError, ValueError):
            return None
        if max_per_day <= 0:
            return None

        slot_day = slot_key(slot)[0] if isinstance(slot_key(slot), tuple) else None
        if slot_day is None:
            return None

        same_day_count = 0
        for other_task_id, other_slot in assignments.items():
            other_task = tasks_by_id.get(other_task_id)
            if not other_task:
                continue
            if other_task.get("class_id") != class_id or other_task.get("subject_id") != subject_id:
                continue
            other_day = slot_key(other_slot)[0] if isinstance(slot_key(other_slot), tuple) else None
            if other_day == slot_day:
                same_day_count += 1

        if same_day_count + 1 > max_per_day:
            return f"同班同科单日超上限（>{max_per_day}节）"
        return None


class DailySubjectMinimumFeasibilityConstraint:
    def validate(self, task: Task, slot: Any, assignments: Assignments, tasks_by_id: TasksById) -> str | None:
        class_id = task.get("class_id")
        subject_id = task.get("subject_id")
        if class_id is None or subject_id is None:
            return None

        min_per_day_raw = task.get("daily_min_hours")
        try:
            min_per_day = int(min_per_day_raw)
        except (TypeError, ValueError):
            return None
        if min_per_day <= 0:
            return None

        total_same_subject_tasks = 0
        for candidate in tasks_by_id.values():
            if candidate.get("class_id") == class_id and candidate.get("subject_id") == subject_id:
                total_same_subject_tasks += 1

        day_counts: dict[int, int] = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        assigned_same_subject_tasks = 0
        for other_task_id, other_slot in assignments.items():
            other_task = tasks_by_id.get(other_task_id)
            if not other_task:
                continue
            if other_task.get("class_id") != class_id or other_task.get("subject_id") != subject_id:
                continue
            assigned_same_subject_tasks += 1
            other_key = slot_key(other_slot)
            if isinstance(other_key, tuple) and len(other_key) == 2:
                try:
                    day = int(other_key[0])
                except (TypeError, ValueError):
                    continue
                if day in day_counts:
                    day_counts[day] += 1

        slot_k = slot_key(slot)
        if isinstance(slot_k, tuple) and len(slot_k) == 2:
            try:
                slot_day = int(slot_k[0])
            except (TypeError, ValueError):
                slot_day = None
            if slot_day in day_counts:
                day_counts[slot_day] += 1

        assigned_after = assigned_same_subject_tasks + 1
        remaining_after = total_same_subject_tasks - assigned_after

        needed = 0
        for day in range(1, 6):
            if day_counts[day] < min_per_day:
                needed += (min_per_day - day_counts[day])

        if needed > remaining_after:
            return f"同班同科单日最小课时不可满足（需{needed}，余{remaining_after}）"
        return None


DEFAULT_CONSTRAINTS = [
    SameCourseOrderingConstraint(),
    ClassSlotConflictConstraint(),
    TeacherSlotConflictConstraint(),
    AvoidConsecutiveConstraint(),
    ForbiddenPeriodsConstraint(),
    DailySubjectMinimumFeasibilityConstraint(),
    DailySubjectLimitConstraint(),
]


