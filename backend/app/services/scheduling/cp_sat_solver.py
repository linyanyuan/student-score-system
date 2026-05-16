from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.services.scheduling.compiler import CompiledProblem
from app.services.scheduling.scoring import SolverWeights, lesson_slot_penalty

try:
    from ortools.sat.python import cp_model
except Exception as exc:  # pragma: no cover
    cp_model = None
    ORTOOLS_IMPORT_ERROR = exc
else:  # pragma: no cover
    ORTOOLS_IMPORT_ERROR = None


@dataclass
class SolverResult:
    success: bool
    assignment_map: dict[str, tuple[int, int]] = field(default_factory=dict)
    score: int = 0
    diagnostics: list[dict[str, Any]] = field(default_factory=list)


def solve_schedule(problem: CompiledProblem, *, max_time_seconds: float = 10.0) -> SolverResult:
    if cp_model is None:
        raise RuntimeError(f"OR-Tools 未安装，无法执行 CP-SAT 求解: {ORTOOLS_IMPORT_ERROR}")

    model = cp_model.CpModel()
    weights = SolverWeights()
    lesson_slot_vars: dict[tuple[str, tuple[int, int]], Any] = {}

    for lesson in problem.lessons:
        if not lesson.candidate_slots:
            return SolverResult(
                success=False,
                diagnostics=[{"code": "no_candidate_slots", "lesson_id": lesson.lesson_id}],
            )
        vars_for_lesson = []
        for slot in lesson.candidate_slots:
            var = model.NewBoolVar(f"lesson_{lesson.lesson_id}_{slot.weekday}_{slot.period_id}")
            lesson_slot_vars[(lesson.lesson_id, slot.key)] = var
            vars_for_lesson.append(var)
        model.AddExactlyOne(vars_for_lesson)

    for slot in problem.slots:
        class_groups: dict[int, list[Any]] = {}
        teacher_groups: dict[int, list[Any]] = {}
        for lesson in problem.lessons:
            var = lesson_slot_vars.get((lesson.lesson_id, slot.key))
            if var is None:
                continue
            class_groups.setdefault(lesson.class_id, []).append(var)
            teacher_groups.setdefault(lesson.teacher_id, []).append(var)
        for vars_for_class in class_groups.values():
            model.Add(sum(vars_for_class) <= 1)
        for vars_for_teacher in teacher_groups.values():
            model.Add(sum(vars_for_teacher) <= 1)

    for teacher_id, daily_limit in problem.teacher_daily_limits.items():
        if daily_limit <= 0:
            continue
        for weekday in range(1, 6):
            vars_for_day = []
            for lesson in problem.lessons:
                if lesson.teacher_id != teacher_id:
                    continue
                for slot in lesson.candidate_slots:
                    if slot.weekday != weekday:
                        continue
                    vars_for_day.append(lesson_slot_vars[(lesson.lesson_id, slot.key)])
            if vars_for_day:
                model.Add(sum(vars_for_day) <= daily_limit)

    subject_groups: dict[tuple[int, int], list[Any]] = {}
    for lesson in problem.lessons:
        if lesson.daily_max_hours <= 0 or lesson.daily_max_hours >= 99:
            continue
        subject_groups.setdefault((lesson.class_id, lesson.subject_id), []).append(lesson)

    for (class_id, subject_id), lessons in subject_groups.items():
        daily_max_hours = min(lesson.daily_max_hours for lesson in lessons)
        for weekday in range(1, 6):
            vars_for_day = []
            for lesson in lessons:
                for slot in lesson.candidate_slots:
                    if slot.weekday != weekday:
                        continue
                    vars_for_day.append(lesson_slot_vars[(lesson.lesson_id, slot.key)])
            if vars_for_day:
                model.Add(sum(vars_for_day) <= daily_max_hours)

    objective_terms = []
    for lesson in problem.lessons:
        for slot in lesson.candidate_slots:
            penalty = lesson_slot_penalty(lesson, slot, weights)
            if penalty > 0:
                objective_terms.append(penalty * lesson_slot_vars[(lesson.lesson_id, slot.key)])

    if objective_terms:
        model.Minimize(sum(objective_terms))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = max_time_seconds
    status = solver.Solve(model)
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return SolverResult(
            success=False,
            diagnostics=[{"code": "solver_infeasible", "grade": problem.grade}],
        )

    assignment_map: dict[str, tuple[int, int]] = {}
    for lesson in problem.lessons:
        for slot in lesson.candidate_slots:
            if solver.Value(lesson_slot_vars[(lesson.lesson_id, slot.key)]):
                assignment_map[lesson.lesson_id] = slot.key
                break

    objective_value = int(solver.ObjectiveValue()) if objective_terms else 0
    return SolverResult(
        success=True,
        assignment_map=assignment_map,
        score=max(0, 100 - objective_value),
        diagnostics=[],
    )
