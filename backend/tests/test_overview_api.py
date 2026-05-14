import os
import tempfile
import unittest
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.dependencies import get_current_user, get_db
from app.main import app
from app.models.class_ import Class
from app.models.exam import Exam
from app.models.school import School
from app.models.school_notice import SchoolNotice
from app.models.school_notice_recipient import SchoolNoticeRecipient
from app.models.student import Student
from app.models.teacher_class import TeacherClass
from app.models.total_rank import TotalRank
from app.models.user import User


class OverviewApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
        self.tmp.close()
        self.engine = create_engine(
            f"sqlite:///{self.tmp.name}",
            connect_args={"check_same_thread": False},
        )
        self.SessionTesting = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine,
        )
        Base.metadata.create_all(bind=self.engine)

        self.db = self.SessionTesting()
        self.school = School(name="Overview School", location="A", school_level="middle")
        self.db.add(self.school)
        self.db.flush()

        self.admin = User(
            username="overview_admin",
            password_hash="x",
            role="school_admin",
            school_id=self.school.id,
        )
        self.teacher = User(
            username="overview_teacher",
            password_hash="x",
            role="teacher",
            school_id=self.school.id,
        )
        self.student_user = User(
            username="overview_student",
            password_hash="x",
            role="student",
            school_id=self.school.id,
        )
        self.db.add_all([self.admin, self.teacher, self.student_user])
        self.db.flush()

        self.class_a = Class(name="八1班", grade="八年级", school_id=self.school.id)
        self.class_b = Class(name="八2班", grade="八年级", school_id=self.school.id)
        self.class_c = Class(name="九1班", grade="九年级", school_id=self.school.id)
        self.db.add_all([self.class_a, self.class_b, self.class_c])
        self.db.flush()
        self.db.add_all(
            [
                TeacherClass(teacher_id=self.teacher.id, class_id=self.class_a.id),
                TeacherClass(teacher_id=self.teacher.id, class_id=self.class_b.id),
            ]
        )
        self.db.flush()

        students = [
            Student(student_no="A1", name="A1", gender="M", class_id=self.class_a.id),
            Student(student_no="A2", name="A2", gender="F", class_id=self.class_a.id),
            Student(student_no="B1", name="B1", gender="M", class_id=self.class_b.id),
            Student(student_no="C1", name="C1", gender="F", class_id=self.class_c.id),
        ]
        self.db.add_all(students)
        self.db.flush()
        self.student_user.student_id = students[0].id
        self.exam_old = Exam(
            name="期中",
            exam_date=date(2026, 4, 1),
            grade="八年级",
            school_id=self.school.id,
        )
        self.exam_latest = Exam(
            name="期末",
            exam_date=date(2026, 5, 1),
            grade="八年级",
            school_id=self.school.id,
        )
        self.db.add_all([self.exam_old, self.exam_latest])
        self.db.flush()
        self.db.add_all(
            [
                TotalRank(student_id=students[0].id, exam_id=self.exam_latest.id, total_score=100, rank_class=1, rank_grade=1),
                TotalRank(student_id=students[1].id, exam_id=self.exam_latest.id, total_score=80, rank_class=2, rank_grade=2),
                TotalRank(student_id=students[2].id, exam_id=self.exam_latest.id, total_score=70, rank_class=1, rank_grade=3),
                TotalRank(student_id=students[3].id, exam_id=self.exam_latest.id, total_score=90, rank_class=1, rank_grade=1),
            ]
        )
        self.notice_a = SchoolNotice(
            school_id=self.school.id,
            title="通知一",
            content="内容一",
            created_by=self.admin.id,
            status="sent",
        )
        self.notice_b = SchoolNotice(
            school_id=self.school.id,
            title="通知二",
            content="内容二",
            created_by=self.admin.id,
            status="draft",
        )
        self.db.add_all([self.notice_a, self.notice_b])
        self.db.flush()
        self.db.add_all(
            [
                SchoolNoticeRecipient(
                    notice_id=self.notice_a.id,
                    teacher_id=self.teacher.id,
                    is_read=False,
                ),
                SchoolNoticeRecipient(
                    notice_id=self.notice_b.id,
                    teacher_id=self.teacher.id,
                    is_read=True,
                ),
                SchoolNoticeRecipient(
                    notice_id=self.notice_a.id,
                    teacher_id=self.student_user.id,
                    is_read=False,
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
        app.dependency_overrides[get_current_user] = lambda: self.teacher
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        self.engine.dispose()
        os.unlink(self.tmp.name)

    def test_teacher_overview_returns_bound_classes_and_latest_exam_average(self):
        response = self.client.get("/api/overview/my")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["role"], "teacher")
        self.assertEqual(data["class_count"], 2)
        self.assertEqual(data["student_count"], 3)
        self.assertEqual(data["notice_count"], 1)
        self.assertEqual(data["latest_exam"], {"id": self.exam_latest.id, "name": "期末"})
        self.assertEqual(
            data["class_summaries"],
            [
                {
                    "class_id": self.class_a.id,
                    "class_name": "八1班",
                    "grade": "八年级",
                    "student_count": 2,
                    "average_score": 90.0,
                },
                {
                    "class_id": self.class_b.id,
                    "class_name": "八2班",
                    "grade": "八年级",
                    "student_count": 1,
                    "average_score": 70.0,
                },
            ],
        )
        self.assertEqual(data["grade_summaries"], [])

    def test_school_admin_overview_returns_school_grades(self):
        app.dependency_overrides[get_current_user] = lambda: self.admin

        response = self.client.get("/api/overview/my")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["role"], "school_admin")
        self.assertEqual(data["class_count"], 3)
        self.assertEqual(data["student_count"], 4)
        self.assertEqual(data["notice_count"], 2)
        self.assertEqual(data["class_summaries"], [])
        self.assertEqual(
            data["grade_summaries"],
            [
                {"grade": "九年级", "average_score": 90.0},
                {"grade": "八年级", "average_score": 83.33},
            ],
        )

    def test_student_overview_returns_own_class_and_unread_notices(self):
        app.dependency_overrides[get_current_user] = lambda: self.student_user

        response = self.client.get("/api/overview/my")

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["role"], "student")
        self.assertEqual(data["class_count"], 1)
        self.assertEqual(data["student_count"], 2)
        self.assertEqual(data["notice_count"], 1)


if __name__ == "__main__":
    unittest.main()
