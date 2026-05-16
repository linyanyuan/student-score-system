from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.services.scheduling.compiler import CompiledProblem, compile_problem
from app.services.scheduling.cp_sat_solver import solve_schedule
from app.services.scheduling.validators import validate_compiled_problem, validate_raw_config


def _diag(code: str, message: str, *, blocking: bool = False, entity: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"code": code, "message": message, "blocking": blocking, "entity": entity or {}}


def build_compiled_summary(raw_config: dict[str, Any], compiled: CompiledProblem) -> dict[str, Any]:
    lessons_by_class: dict[str, int] = {}
    lessons_by_teacher: dict[str, int] = {}
    for lesson in compiled.lessons:
        class_key = str(lesson.class_id)
        teacher_key = str(lesson.teacher_id)
        lessons_by_class[class_key] = lessons_by_class.get(class_key, 0) + 1
        lessons_by_teacher[teacher_key] = lessons_by_teacher.get(teacher_key, 0) + 1

    return {
        "class_count": len(raw_config.get("classes") or []),
        "slot_count": len(compiled.slots),
        "lesson_count": len(compiled.lessons),
        "arrangement_count": len(raw_config.get("arrangements") or []),
        "lesson_plan_count": len(raw_config.get("lesson_plans") or []),
        "teacher_constraint_count": len(raw_config.get("teacher_constraints") or []),
        "lock_count": len(raw_config.get("locks") or []),
        "lessons_by_class": dict(sorted(lessons_by_class.items())),
        "lessons_by_teacher": dict(sorted(lessons_by_teacher.items())),
    }


def build_scheduling_debug_package(
    raw_config: dict[str, Any],
    *,
    grade: str,
    exported_at: str | None = None,
    include_solver: bool = True,
    solver_max_time_seconds: float = 2.0,
) -> dict[str, Any]:
    raw_diagnostics = validate_raw_config(raw_config)
    compiled_summary: dict[str, Any] | None = None
    compiled_diagnostics: list[dict[str, Any]] = []
    solver_diagnostics: list[dict[str, Any]] = []

    try:
        compiled = compile_problem(raw_config)
        compiled_summary = build_compiled_summary(raw_config, compiled)
        compiled_diagnostics = validate_compiled_problem(compiled)
    except Exception as exc:
        compiled = None
        compiled_diagnostics = [_diag("compile_error", f"编译排课模型失败: {exc}", blocking=True)]

    has_blocking = any(item.get("blocking", True) for item in [*raw_diagnostics, *compiled_diagnostics])
    if not include_solver:
        solver_diagnostics = [_diag("solver_not_run", "导出时未运行求解器")]
    elif compiled is None:
        solver_diagnostics = [_diag("solver_skipped", "排课模型编译失败，未运行求解器")]
    elif has_blocking:
        solver_diagnostics = [_diag("solver_skipped", "存在阻塞性校验问题，未运行求解器")]
    else:
        try:
            result = solve_schedule(compiled, max_time_seconds=solver_max_time_seconds)
            solver_diagnostics = result.diagnostics if not result.success else []
            if result.success:
                solver_diagnostics = [
                    _diag(
                        "solver_success",
                        "求解器在导出时找到可行解",
                        entity={"score": result.score, "assignment_count": len(result.assignment_map)},
                    )
                ]
        except Exception as exc:
            solver_diagnostics = [_diag("solver_unavailable", f"导出时运行求解器失败: {exc}")]

    return {
        "version": 1,
        "grade": grade,
        "exported_at": exported_at or datetime.now(timezone.utc).isoformat(),
        "raw_config": raw_config,
        "raw_diagnostics": raw_diagnostics,
        "compiled_summary": compiled_summary,
        "compiled_diagnostics": compiled_diagnostics,
        "solver_diagnostics": solver_diagnostics,
    }
