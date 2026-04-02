import os
import tempfile
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.dependencies import get_db, require_school_admin
from app.main import app
from app.models.class_ import Class
from app.models.lesson_plan import LessonPlan
from app.models.school import School
from app.models.schedule_period import SchedulePeriod
from app.models.subject import Subject
from app.models.teacher_class_subject import TeacherClassSubject
from app.models.user import User


class SchedulingDraftApiTests(unittest.TestCase):
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

        self.admin = User(username='school_admin_draft', password_hash='x', role='school_admin', school_id=self.school.id)
        self.teacher = User(username='teacher_draft', password_hash='x', role='teacher', school_id=self.school.id)
        self.db.add_all([self.admin, self.teacher])
        self.db.commit()
        self.db.refresh(self.admin)
        self.db.refresh(self.teacher)

        self.class_obj = Class(name='1班', grade='八年级', school_id=self.school.id)
        self.subject = Subject(name='数学', code='MATH', grades='八年级', school_id=self.school.id)
        self.db.add_all([self.class_obj, self.subject])
        self.db.commit()
        self.db.refresh(self.class_obj)
        self.db.refresh(self.subject)

        self.db.add_all([
            SchedulePeriod(name='第1节', start_time='08:00', end_time='08:45', school_id=self.school.id, sort_order=1, is_active=True, include_in_auto_schedule=True),
            SchedulePeriod(name='第2节', start_time='08:55', end_time='09:40', school_id=self.school.id, sort_order=2, is_active=True, include_in_auto_schedule=True),
        ])
        self.db.commit()

        self.db.add(TeacherClassSubject(school_id=self.school.id, class_id=self.class_obj.id, subject_id=self.subject.id, teacher_id=self.teacher.id))
        self.db.add(LessonPlan(school_id=self.school.id, grade='八年级', subject_id=self.subject.id, content='{"weekly_hours": 1, "preferred_session": "morning_prefer"}'))
        self.db.commit()

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

    def test_solve_draft_returns_pending_task(self):
        response = self.client.post('/api/schedule/drafts/八年级/solve')
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()['status'], 'pending')
