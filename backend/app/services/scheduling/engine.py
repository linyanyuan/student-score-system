from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable, Mapping, Sequence

from .constraints import Constraint, DEFAULT_CONSTRAINTS, _slots_equal

Task = Mapping[str, Any]


@dataclass
class EngineResult:
    success: bool
    assignments: dict[str, Any]
    message: str


class BacktrackingScheduleEngine:
    def __init__(self, constraints: Sequence[Constraint] | None = None):
        self.constraints: list[Constraint] = list(constraints or DEFAULT_CONSTRAINTS)

    def solve(self, tasks: Sequence[Task], slots: Sequence[Any]) -> EngineResult:
        normalized_tasks = [dict(task) for task in tasks]
        tasks_by_id = {str(task.get("id")): task for task in normalized_tasks}
        ordered_tasks = self._ordered_tasks(normalized_tasks, slots)

        assignments: dict[str, Any] = {}
        diagnostics: list[str] = []

        success = self._backtrack(
            ordered_tasks=ordered_tasks,
            all_slots=slots,
            tasks_by_id=tasks_by_id,
            assignments=assignments,
            index=0,
            diagnostics=diagnostics,
        )
        if success:
            return EngineResult(success=True, assignments=assignments.copy(), message="")

        if not diagnostics:
            diagnostics.append("no feasible assignment found")
        unscheduled = [str(task.get("id")) for task in ordered_tasks if str(task.get("id")) not in assignments]
        detail = "; ".join(diagnostics[:4])
        if unscheduled:
            message = f"Unable to schedule tasks: {', '.join(unscheduled)}. {detail}"
        else:
            message = detail
        return EngineResult(success=False, assignments=assignments.copy(), message=message)

    def _ordered_tasks(self, tasks: Sequence[Task], all_slots: Sequence[Any]) -> list[Task]:
        def sort_key(task: Task) -> tuple[int, int, str]:
            priority = int(task.get("priority", 0) or 0)
            candidates = self._candidate_slots(task, all_slots)
            return (-priority, len(candidates), str(task.get("id")))

        return sorted(tasks, key=sort_key)

    def _candidate_slots(self, task: Task, all_slots: Sequence[Any]) -> list[Any]:
        explicit_candidates = task.get("candidate_slots")
        candidates = list(explicit_candidates if explicit_candidates is not None else all_slots)

        forbidden_slots = task.get("forbidden_slots") or task.get("forbidden_periods") or []
        if not forbidden_slots:
            return candidates

        return [
            slot
            for slot in candidates
            if all(not _slots_equal(slot, forbidden) for forbidden in forbidden_slots)
        ]

    def _first_violation(
        self,
        task: Task,
        slot: Any,
        assignments: dict[str, Any],
        tasks_by_id: Mapping[str, Task],
    ) -> str | None:
        for constraint in self.constraints:
            reason = constraint.validate(task, slot, assignments, tasks_by_id)
            if reason:
                return reason
        return None

    def _backtrack(
        self,
        ordered_tasks: Sequence[Task],
        all_slots: Sequence[Any],
        tasks_by_id: Mapping[str, Task],
        assignments: dict[str, Any],
        index: int,
        diagnostics: list[str],
    ) -> bool:
        if index >= len(ordered_tasks):
            return True

        task = ordered_tasks[index]
        task_id = str(task.get("id"))
        candidates = self._candidate_slots(task, all_slots)
        if not candidates:
            diagnostics.append(f"task {task_id} has no candidate slots")
            return False

        for slot in candidates:
            reason = self._first_violation(task, slot, assignments, tasks_by_id)
            if reason:
                if len(diagnostics) < 20:
                    diagnostics.append(f"task {task_id} at slot {slot}: {reason}")
                continue

            assignments[task_id] = slot
            if self._backtrack(
                ordered_tasks=ordered_tasks,
                all_slots=all_slots,
                tasks_by_id=tasks_by_id,
                assignments=assignments,
                index=index + 1,
                diagnostics=diagnostics,
            ):
                return True
            assignments.pop(task_id, None)

        return False
