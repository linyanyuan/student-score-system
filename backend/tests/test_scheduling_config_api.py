import os
import tempfile
import unittest
from datetime import datetime

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.dependencies import get_db, require_school_admin
from app.main import app
from app.models.class_ import Class
from app.models.school import School
from app.models.schedule_period import SchedulePeriod
from app.models.subject import Subject
from app.models.user import User


class SchedulingConfigApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        self.tmp.close()
        self.engine = create_engine(f"sqlite:///{self.tmp.name}", connect_args={"check_same_thread": False})
        self.SessionTesting = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

        self.db = self.SessionTesting()
        self.school = School(name='测试学校', location='测试', school_level='middle')
        self.db.add(self.school)
        self.db.commit()
        self.db.refresh(self.school)

        self.admin = User(username='school_admin_case', password_hash='x', role='school_admin', school_id=self.school.id)
        self.teacher = User(username='teacher_case', password_hash='x', role='teacher', school_id=self.school.id)
        self.db.add_all([self.admin, self.teacher])
        self.db.commit()
        self.db.refresh(self.admin)
        self.db.refresh(self.teacher)

        self.class_obj = Class(name='1班', grade='八年级', school_id=self.school.id)
        self.subject = Subject(name='数学', code='MATH', grades='八年级', school_id=self.school.id)
        self.period = SchedulePeriod(name='第1节', start_time='08:00', end_time='08:45', sort_order=1, is_active=True, include_in_auto_schedule=True)
        self.db.add_all([self.class_obj, self.subject, self.period])
        self.db.commit()
        self.db.refresh(self.class_obj)
        self.db.refresh(self.subject)

        def override_get_db():
            db = self.SessionTesting()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[require_school_admin] = lambda: self.admin
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        self.engine.dispose()
        os.unlink(self.tmp.name)

    def test_save_teacher_constraints_returns_saved_rows(self):
        response = self.client.post(
            '/api/schedule/teacher-constraints',
            json={
                'grade': '八年级',
                'items': [
                    {
                        'teacher_id': self.teacher.id,
                        'daily_max_hours': 4,
                        'forbidden_periods': [[1, 1]],
                        'preferred_periods': [[2, 1]],
                    }
                ],
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['items'][0]['teacher_id'], self.teacher.id)


    def test_save_lesson_plan_supports_legacy_not_null_columns(self):
        with self.engine.begin() as conn:
            conn.exec_driver_sql('DROP TABLE lesson_plans')
            conn.exec_driver_sql(
                "CREATE TABLE lesson_plans ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                "school_id INTEGER NOT NULL, "
                "grade VARCHAR(20) NOT NULL, "
                "subject_id INTEGER NOT NULL, "
                "weekly_hours INTEGER NOT NULL, "
                "priority INTEGER NOT NULL DEFAULT 1, "
                "avoid_consecutive BOOLEAN NOT NULL DEFAULT 0, "
                "forbidden_periods_json TEXT NULL, "
                "content TEXT NULL, "
                "created_at DATETIME NOT NULL, "
                "updated_at DATETIME NOT NULL, "
                "CONSTRAINT uq_lesson_plan_school_grade_subject UNIQUE (school_id, grade, subject_id)"
                ")"
            )

        response = self.client.post(
            '/api/schedule/lesson-plan',
            json={
                'grade': '???',
                'items': [
                    {
                        'subject_id': self.subject.id,
                        'weekly_hours': 3,
                        'daily_max_hours': 1,
                        'preferred_session': 'any',
                        'forbidden_periods': [[1, 1]],
                    }
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['items'][0]['weekly_hours'], 3)

        with self.engine.connect() as conn:
            row = conn.exec_driver_sql(
                'SELECT weekly_hours, priority, avoid_consecutive, forbidden_periods_json, content FROM lesson_plans'
            ).mappings().one()

        self.assertEqual(row['weekly_hours'], 3)
        self.assertEqual(row['priority'], 1)
        self.assertEqual(row['avoid_consecutive'], 0)
        self.assertEqual(row['forbidden_periods_json'], '[[1, 1]]')
        self.assertIn('"weekly_hours": 3', row['content'])
