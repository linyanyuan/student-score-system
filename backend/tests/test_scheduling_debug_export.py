import unittest
from pathlib import Path

from app.services.scheduling.debug_export import build_scheduling_debug_package


class SchedulingDebugExportTests(unittest.TestCase):
    def test_build_debug_package_includes_raw_config_diagnostics_and_summary(self):
        raw_config = {
            "grade": "G8",
            "classes": [{"id": 1, "name": "Class 1"}],
            "slots": [{"weekday": 1, "period_id": 1}],
            "arrangements": [
                {"class_id": 1, "subject_id": 10, "teacher_id": 20, "subject_name": "Math"},
            ],
            "lesson_plans": [
                {"class_id": 0, "subject_id": 10, "weekly_hours": 1, "daily_max_hours": 1},
            ],
            "teacher_constraints": [],
            "locks": [],
        }

        package = build_scheduling_debug_package(
            raw_config,
            grade="G8",
            exported_at="2026-05-16T12:00:00+00:00",
            include_solver=False,
        )

        self.assertEqual(package["version"], 1)
        self.assertEqual(package["grade"], "G8")
        self.assertEqual(package["exported_at"], "2026-05-16T12:00:00+00:00")
        self.assertEqual(package["raw_config"], raw_config)
        self.assertEqual(package["raw_diagnostics"], [])
        self.assertEqual(package["compiled_summary"]["class_count"], 1)
        self.assertEqual(package["compiled_summary"]["slot_count"], 1)
        self.assertEqual(package["compiled_summary"]["lesson_count"], 1)
        self.assertEqual(package["compiled_summary"]["lessons_by_class"], {"1": 1})
        self.assertEqual(package["compiled_summary"]["lessons_by_teacher"], {"20": 1})
        self.assertEqual(package["compiled_diagnostics"], [])
        self.assertEqual(package["solver_diagnostics"], [{"code": "solver_not_run", "message": "导出时未运行求解器", "blocking": False, "entity": {}}])

    def test_build_debug_package_keeps_non_blocking_missing_lesson_plan_notice(self):
        raw_config = {
            "grade": "G8",
            "classes": [{"id": 1, "name": "Class 1"}],
            "slots": [{"weekday": 1, "period_id": 1}],
            "arrangements": [
                {"class_id": 1, "subject_id": 10, "teacher_id": 20, "subject_name": "Math"},
                {"class_id": 1, "subject_id": 11, "teacher_id": 21, "subject_name": "Music"},
            ],
            "lesson_plans": [
                {"class_id": 0, "subject_id": 10, "weekly_hours": 1},
            ],
            "teacher_constraints": [],
            "locks": [],
        }

        package = build_scheduling_debug_package(raw_config, grade="G8", include_solver=False)

        self.assertTrue(any(item["code"] == "missing_lesson_plan" for item in package["raw_diagnostics"]))
        self.assertFalse(next(item for item in package["raw_diagnostics"] if item["code"] == "missing_lesson_plan")["blocking"])

    def test_scheduling_router_exposes_debug_config_download_route(self):
        source = Path("app/routers/scheduling.py").read_text(encoding="utf-8")

        self.assertIn('@router.get("/debug-config/{grade}/export")', source)
        self.assertIn("build_scheduling_debug_package", source)
        self.assertIn("Content-Disposition", source)
        self.assertIn("application/json", source)

    def test_replay_script_uses_exported_raw_config_pipeline(self):
        source = Path("scripts/replay_schedule_debug_package.py").read_text(encoding="utf-8")

        self.assertIn("validate_raw_config(raw_config)", source)
        self.assertIn("compile_problem(raw_config)", source)
        self.assertIn("validate_compiled_problem(compiled)", source)
        self.assertIn("solve_schedule(compiled", source)


if __name__ == "__main__":
    unittest.main()
