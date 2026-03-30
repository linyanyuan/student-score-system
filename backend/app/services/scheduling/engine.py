from __future__ import annotations

from dataclasses import dataclass
import time
from typing import Any, Mapping, Sequence

from .constraints import Constraint, DEFAULT_CONSTRAINTS, _slots_equal

Task = Mapping[str, Any]


@dataclass
class EngineResult:
    success: bool
    assignments: dict[str, Any]
    message: str


class BacktrackingScheduleEngine:
    def __init__(
        self,
        constraints: Sequence[Constraint] | None = None,
        *,
        max_seconds: float = 8.0,
        max_steps: int = 300_000,
    ):
        self.constraints: list[Constraint] = list(constraints or DEFAULT_CONSTRAINTS)
        self.max_seconds = max_seconds
        self.max_steps = max_steps
        self._started_at: float = 0.0
        self._deadline_at: float = 0.0
        self._steps: int = 0
        self._aborted_reason: str | None = None

    def solve(self, tasks: Sequence[Task], slots: Sequence[Any]) -> EngineResult:
        self._started_at = time.perf_counter()
        self._deadline_at = self._started_at + max(0.1, float(self.max_seconds))
        self._steps = 0
        self._aborted_reason = None

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

        if self._aborted_reason:
            diagnostics.insert(0, self._aborted_reason)
        if not diagnostics:
            diagnostics.append("未找到可行排课方案")
        unscheduled = [str(task.get("id")) for task in ordered_tasks if str(task.get("id")) not in assignments]
        detail = "; ".join(diagnostics[:4])
        if unscheduled:
            message = f"以下任务无法排课：{', '.join(unscheduled)}。{detail}"
        else:
            message = detail
        return EngineResult(success=False, assignments=assignments.copy(), message=message)

    def _ordered_tasks(self, tasks: Sequence[Task], all_slots: Sequence[Any]) -> list[Task]:
        def sort_key(task: Task) -> tuple[int, int, str]:
            priority = int(task.get("priority", 0) or 0)
            candidates = self._candidate_slots(task, all_slots)
            return (priority, len(candidates), str(task.get("id")))

        return sorted(tasks, key=sort_key)

    def _candidate_slots(self, task: Task, all_slots: Sequence[Any]) -> list[Any]:
        explicit_candidates = task.get("candidate_slots")
        candidates = list(explicit_candidates if explicit_candidates is not None else all_slots)

        forbidden_slots = task.get("forbidden_slots") or task.get("forbidden_periods") or []
        if forbidden_slots:
            candidates = [
                slot
                for slot in candidates
                if all(not _slots_equal(slot, forbidden) for forbidden in forbidden_slots)
            ]

        preferred_session = str(task.get("preferred_session") or "any")
        if preferred_session == "any":
            return candidates

        target = "morning" if preferred_session == "morning_prefer" else "afternoon"
        preferred_slots = [
            slot
            for slot in candidates
            if isinstance(slot, dict) and str(slot.get("session") or "") == target
        ]
        if not preferred_slots:
            return candidates

        if bool(task.get("preferred_strict", False)):
            return preferred_slots

        other_slots = [slot for slot in candidates if slot not in preferred_slots]
        return preferred_slots + other_slots

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
        self._steps += 1
        if self.max_steps > 0 and self._steps > self.max_steps:
            self._aborted_reason = f"排课搜索超出步数上限（{self.max_steps}）"
            return False
        if self.max_seconds > 0 and time.perf_counter() >= self._deadline_at:
            self._aborted_reason = f"排课搜索超时（>{self.max_seconds:.1f}s）"
            return False

        if index >= len(ordered_tasks):
            return True

        task = ordered_tasks[index]
        task_id = str(task.get("id"))
        candidates = self._candidate_slots(task, all_slots)
        if not candidates:
            diagnostics.append(f"任务 {task_id} 没有可用时间槽")
            return False

        for slot in candidates:
            reason = self._first_violation(task, slot, assignments, tasks_by_id)
            if reason:
                if len(diagnostics) < 20:
                    diagnostics.append(f"任务 {task_id} 在时间槽 {slot} 冲突：{reason}")
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
