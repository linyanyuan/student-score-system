import os
import tempfile
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.dependencies import get_current_user, get_db, require_school_admin
from app.main import app
from app.models.class_ import Class
from app.models.class_timetable import ClassTimetable
from app.models.school import School
from app.models.schedule_period import SchedulePeriod
from app.models.subject import Subject
from app.models.user import User


class SchedulePeriodsApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
        self.tmp.close()
        self.engine = create_engine(f"sqlite:///{self.tmp.name}", connect_args={"check_same_thread": False})
        self.SessionTesting = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)

        self.db = self.SessionTesting()
        self.school_a = School(name="School A", location="A", school_level="middle")
        self.school_b = School(name="School B", location="B", school_level="middle")
        self.middle_school = School(name="Middle School", location="M", school_level="middle")
        self.high_school = School(name="High School", location="H", school_level="high")
        self.db.add_all([self.school_a, self.school_b, self.middle_school, self.high_school])
        self.db.commit()
        self.db.refresh(self.school_a)
        self.db.refresh(self.school_b)
        self.db.refresh(self.middle_school)
        self.db.refresh(self.high_school)

        self.admin_a = User(username="period_admin_a", password_hash="x", role="school_admin", school_id=self.school_a.id)
        self.admin_b = User(username="period_admin_b", password_hash="x", role="school_admin", school_id=self.school_b.id)
        self.middle_admin = User(username="period_admin_middle", password_hash="x", role="school_admin", school_id=self.middle_school.id)
        self.high_admin = User(username="period_admin_high", password_hash="x", role="school_admin", school_id=self.high_school.id)
        self.teacher_a = User(username="period_teacher_a", password_hash="x", role="teacher", school_id=self.school_a.id)
        self.db.add_all([self.admin_a, self.admin_b, self.middle_admin, self.high_admin, self.teacher_a])
        self.db.commit()
        self.db.refresh(self.admin_a)
        self.db.refresh(self.admin_b)
        self.db.refresh(self.middle_admin)
        self.db.refresh(self.high_admin)
        self.db.refresh(self.teacher_a)

        self.class_a = Class(name="Class 1", grade="Grade 7", school_id=self.school_a.id)
        self.subject_a = Subject(name="Math", code="MATH", grades="Grade 7", school_id=self.school_a.id)
        self.db.add_all([self.class_a, self.subject_a])
        self.db.commit()
        self.db.refresh(self.class_a)
        self.db.refresh(self.subject_a)

        self.db.add_all(
            [
                SchedulePeriod(
                    name="School A Period 1",
                    start_time="08:00",
                    end_time="08:45",
                    school_id=self.school_a.id,
                    sort_order=1,
                    is_active=True,
                    include_in_auto_schedule=True,
                ),
                SchedulePeriod(
                    name="School B Period 1",
                    start_time="09:00",
                    end_time="09:45",
                    school_id=self.school_b.id,
                    sort_order=1,
                    is_active=True,
                    include_in_auto_schedule=True,
                ),
            ]
        )
        self.db.commit()

        def override_get_db():
            db = self.SessionTesting()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: self.admin_a
        app.dependency_overrides[require_school_admin] = lambda: self.admin_a
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        self.engine.dispose()
        os.unlink(self.tmp.name)

    def _use_admin(self, user):
        app.dependency_overrides[get_current_user] = lambda: user
        app.dependency_overrides[require_school_admin] = lambda: user

    def test_get_schedule_periods_returns_only_current_school_periods(self):
        response = self.client.get("/api/schedule-periods/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["name"] for item in response.json()], ["School A Period 1"])

    def test_create_schedule_period_assigns_current_school(self):
        response = self.client.post(
            "/api/schedule-periods/",
            json={
                "name": "School A Period 2",
                "start_time": "08:55",
                "end_time": "09:40",
                "sort_order": 2,
                "include_in_auto_schedule": True,
            },
        )

        self.assertEqual(response.status_code, 201)
        school_id = (
            self.db.query(SchedulePeriod.school_id)
            .filter(SchedulePeriod.name == "School A Period 2")
            .scalar()
        )
        self.assertEqual(school_id, self.school_a.id)

    def test_update_schedule_period_rejects_cross_school_period(self):
        period_id = (
            self.db.query(SchedulePeriod.id)
            .filter(SchedulePeriod.name == "School B Period 1")
            .scalar()
        )

        response = self.client.put(
            f"/api/schedule-periods/{period_id}",
            json={"name": "Should Not Update"},
        )

        self.assertEqual(response.status_code, 404)

    def test_delete_schedule_period_rejects_period_used_by_published_timetable(self):
        period = self.db.query(SchedulePeriod).filter(SchedulePeriod.name == "School A Period 1").first()
        self.db.add(
            ClassTimetable(
                school_id=self.school_a.id,
                class_id=self.class_a.id,
                teacher_id=self.teacher_a.id,
                subject_id=self.subject_a.id,
                period_id=period.id,
                weekday=1,
            )
        )
        self.db.commit()

        response = self.client.delete(f"/api/schedule-periods/{period.id}")

        self.assertEqual(response.status_code, 400)
        self.assertIn("已被使用", response.json()["detail"])

    def test_generate_default_template_for_middle_school(self):
        self._use_admin(self.middle_admin)
        response = self.client.post("/api/schedule-periods/default-template")

        self.assertEqual(response.status_code, 201)
        items = response.json()
        self.assertEqual(len(items), 8)
        self.assertEqual(items[0]["name"], "第1节")
        self.assertEqual(items[0]["start_time"], "08:10")
        self.assertEqual(items[0]["end_time"], "08:55")
        self.assertEqual(items[4]["start_time"], "13:40")
        self.assertEqual(items[-1]["end_time"], "17:20")

    def test_generate_default_template_for_high_school(self):
        self._use_admin(self.high_admin)
        response = self.client.post("/api/schedule-periods/default-template")

        self.assertEqual(response.status_code, 201)
        items = response.json()
        self.assertEqual(len(items), 14)
        self.assertEqual(items[0]["name"], "早自习")
        self.assertEqual(items[0]["start_time"], "07:00")
        self.assertEqual(items[1]["start_time"], "08:00")
        self.assertEqual(items[2]["end_time"], "09:30")
        self.assertEqual(items[3]["start_time"], "09:50")
        self.assertEqual(items[9]["end_time"], "17:30")
        self.assertEqual(items[10]["start_time"], "17:50")
        self.assertEqual(items[-1]["end_time"], "21:00")

    def test_generate_default_template_rejects_school_with_existing_periods(self):
        response = self.client.post("/api/schedule-periods/default-template")

        self.assertEqual(response.status_code, 400)
        self.assertIn("已有节次", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
