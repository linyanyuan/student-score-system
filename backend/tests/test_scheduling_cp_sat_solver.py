import unittest


class CompilerTests(unittest.TestCase):
    def test_compile_problem_includes_locked_slot_and_teacher_limits(self):
        from app.services.scheduling.compiler import compile_problem

        raw_config = {
            "grade": "八年级",
            "classes": [{"id": 101, "name": "1班"}],
            "periods": [{"id": 1, "weekday": 1}, {"id": 2, "weekday": 2}],
            "arrangements": [
                {
                    "class_id": 101,
                    "subject_id": 201,
                    "teacher_id": 301,
                    "weekly_hours": 1,
                }
            ],
            "lesson_plans": [
                {
                    "class_id": 101,
                    "subject_id": 201,
                    "weekly_hours": 1,
                }
            ],
            "teacher_constraints": [
                {
                    "teacher_id": 301,
                    "daily_max_hours": 4,
                    "forbidden_periods": [[1, 1]],
                }
            ],
            "locks": [
                {
                    "class_id": 101,
                    "subject_id": 201,
                    "teacher_id": 301,
                    "weekday": 2,
                    "period_id": 2,
                }
            ],
        }

        compiled = compile_problem(raw_config)
        self.assertEqual(compiled.locked_assignments[0]["weekday"], 2)
        self.assertEqual(compiled.teacher_daily_limits[301], 4)


class CpSatSolverTests(unittest.TestCase):
    def test_solver_enforces_subject_daily_max_by_class_and_subject(self):
        from app.services.scheduling.compiler import compile_problem
        from app.services.scheduling.cp_sat_solver import solve_schedule

        raw_config = {
            "grade": "八年级",
            "classes": [{"id": 101, "name": "1班"}],
            "periods": [
                {"id": 1, "weekday": 1, "session": "morning"},
                {"id": 2, "weekday": 1, "session": "morning"},
                {"id": 3, "weekday": 2, "session": "morning"},
            ],
            "arrangements": [
                {
                    "class_id": 101,
                    "subject_id": 201,
                    "teacher_id": 301,
                    "weekly_hours": 2,
                    "subject_name": "美术",
                }
            ],
            "lesson_plans": [
                {
                    "class_id": 101,
                    "subject_id": 201,
                    "weekly_hours": 2,
                    "daily_max_hours": 1,
                }
            ],
            "teacher_constraints": [],
            "locks": [],
        }

        result = solve_schedule(compile_problem(raw_config))

        self.assertTrue(result.success)
        weekdays = [slot[0] for slot in result.assignment_map.values()]
        self.assertEqual(len(weekdays), 2)
        self.assertEqual(len(set(weekdays)), 2)

    def test_solver_keeps_locked_lessons_and_returns_score(self):
        from app.services.scheduling.compiler import compile_problem
        from app.services.scheduling.cp_sat_solver import solve_schedule

        raw_config = {
            "grade": "八年级",
            "classes": [{"id": 101, "name": "1班"}],
            "periods": [
                {"id": 1, "weekday": 1, "session": "morning"},
                {"id": 2, "weekday": 2, "session": "morning"},
            ],
            "arrangements": [
                {
                    "class_id": 101,
                    "subject_id": 201,
                    "teacher_id": 301,
                    "weekly_hours": 1,
                    "subject_name": "数学",
                }
            ],
            "lesson_plans": [
                {
                    "class_id": 101,
                    "subject_id": 201,
                    "weekly_hours": 1,
                    "preferred_session": "morning_prefer",
                }
            ],
            "teacher_constraints": [
                {
                    "teacher_id": 301,
                    "daily_max_hours": 4,
                    "forbidden_periods": [],
                }
            ],
            "locks": [
                {
                    "class_id": 101,
                    "subject_id": 201,
                    "teacher_id": 301,
                    "weekday": 2,
                    "period_id": 2,
                }
            ],
        }

        compiled = compile_problem(raw_config)
        result = solve_schedule(compiled)
        self.assertTrue(result.success)
        self.assertEqual(result.assignment_map["101:201:301:1"], (2, 2))
        self.assertGreaterEqual(result.score, 0)
