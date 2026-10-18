from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.services.scheduling.compiler import compile_problem
from app.services.scheduling.cp_sat_solver import solve_schedule
from app.services.scheduling.debug_export import build_compiled_summary
from app.services.scheduling.validators import validate_compiled_problem, validate_raw_config


def main() -> int:
    parser = argparse.ArgumentParser(description="Replay a scheduling debug package locally.")
    parser.add_argument("debug_package", help="Path to schedule-debug-*.json")
    parser.add_argument("--max-time", type=float, default=10.0, help="CP-SAT max solve time in seconds")
    args = parser.parse_args()

    payload = json.loads(Path(args.debug_package).read_text(encoding="utf-8"))
    raw_config = payload.get("raw_config") or payload

    raw_diagnostics = validate_raw_config(raw_config)
    compiled = compile_problem(raw_config)
    compiled_diagnostics = validate_compiled_problem(compiled)

    print(json.dumps({
        "grade": raw_config.get("grade") or payload.get("grade"),
        "raw_diagnostics": raw_diagnostics,
        "compiled_summary": build_compiled_summary(raw_config, compiled),
        "compiled_diagnostics": compiled_diagnostics,
    }, ensure_ascii=False, indent=2))

    blocking = [item for item in [*raw_diagnostics, *compiled_diagnostics] if item.get("blocking", True)]
    if blocking:
        return 2

    result = solve_schedule(compiled, max_time_seconds=args.max_time)
    print(json.dumps({
        "solver_success": result.success,
        "solver_score": result.score,
        "assignment_count": len(result.assignment_map),
        "solver_diagnostics": result.diagnostics,
    }, ensure_ascii=False, indent=2))
    return 0 if result.success else 3


if __name__ == "__main__":
    raise SystemExit(main())
