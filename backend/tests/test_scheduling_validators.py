import unittest

from app.services.scheduling.compiler import CompiledLesson, CompiledProblem, CompiledSlot
from app.services.scheduling.validators import validate_raw_config
from app.services.scheduling.validators import validate_compiled_problem


class SchedulingValidatorTests(unittest.TestCase):
    def test_missing_lesson_plan_is_non_blocking_skipped_subject_notice(self):
        diagnostics = validate_raw_config(
            {
                "classes": [{"id": 1, "name": "Class 1"}],
                "slots": [{"weekday": 1, "period_id": 1}],
                "arrangements": [
                    {"class_id": 1, "subject_id": 16, "teacher_id": 8, "subject_name": "Dao Fa"},
                ],
                "lesson_plans": [
                    {"class_id": 0, "subject_id": 2, "weekly_hours": 5},
                ],
            }
        )

        self.assertEqual(diagnostics[0]["code"], "missing_lesson_plan")
        self.assertEqual(
            diagnostics[0]["message"],
            "科目 Dao Fa (ID 16) 未配置年级基础课时规则，本次不会自动排课",
        )
        self.assertFalse(diagnostics[0]["blocking"])
        self.assertEqual(diagnostics[0]["entity"]["subject_id"], 16)
        self.assertEqual(diagnostics[0]["entity"]["subject_name"], "Dao Fa")
        self.assertEqual(diagnostics[0]["entity"]["base_plan_subject_ids"], [2])

    def test_compiled_validation_reports_class_capacity_shortage(self):
        slots = [CompiledSlot(key=(1, 1), weekday=1, period_id=1)]
        problem = CompiledProblem(
            grade="G8",
            lessons=[
                CompiledLesson("l1", class_id=1, subject_id=1, teacher_id=1, candidate_slots=slots),
                CompiledLesson("l2", class_id=1, subject_id=2, teacher_id=2, candidate_slots=slots),
            ],
            slots=slots,
            locked_assignments=[],
            teacher_daily_limits={},
            teacher_forbidden_slots={},
        )

        diagnostics = validate_compiled_problem(problem)

        self.assertEqual(diagnostics[0]["code"], "class_capacity_exceeded")
        self.assertEqual(diagnostics[0]["entity"]["class_id"], 1)

    def test_compiled_validation_reports_teacher_capacity_shortage(self):
        slot = CompiledSlot(key=(1, 1), weekday=1, period_id=1)
        problem = CompiledProblem(
            grade="G8",
            lessons=[
                CompiledLesson("l1", class_id=1, subject_id=1, teacher_id=9, candidate_slots=[slot]),
                CompiledLesson("l2", class_id=2, subject_id=1, teacher_id=9, candidate_slots=[slot]),
            ],
            slots=[slot],
            locked_assignments=[],
            teacher_daily_limits={},
            teacher_forbidden_slots={},
        )

        diagnostics = validate_compiled_problem(problem)

        self.assertTrue(any(item["code"] == "teacher_capacity_exceeded" for item in diagnostics))

    def test_compiled_validation_reports_locked_slot_conflicts(self):
        slot = CompiledSlot(key=(1, 1), weekday=1, period_id=1)
        problem = CompiledProblem(
            grade="G8",
            lessons=[
                CompiledLesson("l1", class_id=1, subject_id=1, teacher_id=1, candidate_slots=[slot]),
                CompiledLesson("l2", class_id=1, subject_id=2, teacher_id=2, candidate_slots=[slot]),
            ],
            slots=[slot],
            locked_assignments=[
                {"class_id": 1, "subject_id": 1, "teacher_id": 1, "weekday": 1, "period_id": 1},
                {"class_id": 1, "subject_id": 2, "teacher_id": 2, "weekday": 1, "period_id": 1},
            ],
            teacher_daily_limits={},
            teacher_forbidden_slots={},
        )

        diagnostics = validate_compiled_problem(problem)

        self.assertTrue(any(item["code"] == "locked_class_slot_conflict" for item in diagnostics))

    def test_compiled_validation_reports_teacher_daily_limit_capacity_shortage(self):
        slots = [
            CompiledSlot(key=(1, 1), weekday=1, period_id=1),
            CompiledSlot(key=(2, 1), weekday=2, period_id=1),
        ]
        problem = CompiledProblem(
            grade="G8",
            lessons=[
                CompiledLesson("l1", class_id=1, subject_id=1, teacher_id=9, candidate_slots=slots),
                CompiledLesson("l2", class_id=2, subject_id=1, teacher_id=9, candidate_slots=slots),
                CompiledLesson("l3", class_id=3, subject_id=1, teacher_id=9, candidate_slots=slots),
            ],
            slots=slots,
            locked_assignments=[],
            teacher_daily_limits={9: 1},
            teacher_forbidden_slots={},
        )

        diagnostics = validate_compiled_problem(problem)

        self.assertTrue(any(item["code"] == "teacher_daily_capacity_exceeded" for item in diagnostics))

    def test_compiled_validation_reports_subject_daily_limit_capacity_shortage(self):
        slots = [
            CompiledSlot(key=(1, 1), weekday=1, period_id=1),
            CompiledSlot(key=(2, 1), weekday=2, period_id=1),
        ]
        problem = CompiledProblem(
            grade="G8",
            lessons=[
                CompiledLesson("l1", class_id=1, subject_id=1, teacher_id=1, daily_max_hours=1, candidate_slots=slots),
                CompiledLesson("l2", class_id=1, subject_id=1, teacher_id=1, daily_max_hours=1, candidate_slots=slots),
                CompiledLesson("l3", class_id=1, subject_id=1, teacher_id=1, daily_max_hours=1, candidate_slots=slots),
            ],
            slots=slots,
            locked_assignments=[],
            teacher_daily_limits={},
            teacher_forbidden_slots={},
        )

        diagnostics = validate_compiled_problem(problem)

        self.assertTrue(any(item["code"] == "subject_daily_capacity_exceeded" for item in diagnostics))


if __name__ == "__main__":
    unittest.main()
