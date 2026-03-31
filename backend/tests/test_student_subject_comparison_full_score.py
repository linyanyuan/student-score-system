from datetime import date
from types import SimpleNamespace
import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.class_ import Class
from app.models.exam import Exam
from app.models.school import School
from app.models.score import Score
from app.models.score_full_score_config import ScoreFullScoreConfig
from app.models.student import Student
from app.models.subject import Subject
from app.routers.analysis import student_subject_comparison


class StudentSubjectComparisonFullScoreTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.SessionLocal()

        school = School(name="Test School", location="Test", school_level="middle")
        self.db.add(school)
        self.db.flush()

        cls = Class(name="Class 1", grade="G7", school_id=school.id)
        self.db.add(cls)
        self.db.flush()

        self.student = Student(student_no="S1001", name="Alice", gender="F", class_id=cls.id)
        self.db.add(self.student)
        self.db.flush()

        exam = Exam(name="Midterm", exam_date=date(2026, 3, 1), grade="G7", school_id=school.id)
        self.db.add(exam)
        self.db.flush()
        self.exam_id = exam.id

        chinese = Subject(name="语文", code="yw", school_id=school.id)
        physics = Subject(name="物理", code="wl", school_id=school.id)
        self.db.add_all([chinese, physics])
        self.db.flush()

        self.db.add_all(
            [
                Score(student_id=self.student.id, exam_id=self.exam_id, subject_id=chinese.id, score=88),
                Score(student_id=self.student.id, exam_id=self.exam_id, subject_id=physics.id, score=52),
            ]
        )
        self.db.add(
            ScoreFullScoreConfig(
                school_id=school.id,
                chinese_full_score=110.0,
                math_full_score=120.0,
                english_full_score=120.0,
                other_full_score=70.0,
            )
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_subject_comparison_contains_subject_full_score(self):
        current_user = SimpleNamespace(
            role="student",
            username="alice",
            student_id=self.student.id,
            school_id=None,
        )

        result = student_subject_comparison(
            student_id=self.student.id,
            exam_id=self.exam_id,
            current_user=current_user,
            db=self.db,
        )

        by_subject = {item["subject_name"]: item for item in result}
        self.assertEqual(by_subject["语文"]["subject_full_score"], 110.0)
        self.assertEqual(by_subject["物理"]["subject_full_score"], 70.0)


if __name__ == "__main__":
    unittest.main()
