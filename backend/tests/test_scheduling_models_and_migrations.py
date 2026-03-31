import unittest

from app.main import app  # noqa: F401
from sqlalchemy import inspect

from app.database import engine


class SchedulingPersistenceTests(unittest.TestCase):
    def test_cp_sat_schedule_tables_exist(self):
        inspector = inspect(engine)
        names = set(inspector.get_table_names())
        self.assertIn("lesson_plan_overrides", names)
        self.assertIn("teacher_time_constraints", names)
        self.assertIn("timetable_locks", names)
        self.assertIn("schedule_drafts", names)
        self.assertIn("schedule_draft_items", names)
