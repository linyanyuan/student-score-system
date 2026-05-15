import unittest

from app.services.scheduling.validators import validate_raw_config


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


if __name__ == "__main__":
    unittest.main()
