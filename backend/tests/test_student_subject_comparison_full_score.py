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
from app.models.total_rank import TotalRank
from app.routers.analysis import classes_rank, student_score_comparison, student_subject_comparison


class StudentSubjectComparisonFullScoreTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.SessionLocal()

        school = School(name="Test School", location="Test", school_level="middle")
        self.db.add(school)
        self.db.flush()

        class_1 = Class(name="Class 1", grade="G7", school_id=school.id)
        class_2 = Class(name="Class 2", grade="G7", school_id=school.id)
        class_3 = Class(name="Class 3", grade="G8", school_id=school.id)
        self.db.add_all([class_1, class_2, class_3])
        self.db.flush()

        self.student = Student(student_no="S1001", name="Alice", gender="F", class_id=class_1.id)
        self.classmate = Student(student_no="S1002", name="Betty", gender="F", class_id=class_1.id)
        self.same_grade_peer = Student(student_no="S2001", name="Cindy", gender="F", class_id=class_2.id)
        self.other_grade_peer = Student(student_no="S3001", name="Daisy", gender="F", class_id=class_3.id)
        self.db.add_all([self.student, self.classmate, self.same_grade_peer, self.other_grade_peer])
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
                Score(student_id=self.classmate.id, exam_id=self.exam_id, subject_id=chinese.id, score=92),
                Score(student_id=self.classmate.id, exam_id=self.exam_id, subject_id=physics.id, score=60),
                Score(student_id=self.same_grade_peer.id, exam_id=self.exam_id, subject_id=chinese.id, score=76),
                Score(student_id=self.same_grade_peer.id, exam_id=self.exam_id, subject_id=physics.id, score=58),
            ]
        )
        self.db.add_all(
            [
                TotalRank(student_id=self.student.id, exam_id=self.exam_id, total_score=140, rank_class=2, rank_grade=2),
                TotalRank(student_id=self.classmate.id, exam_id=self.exam_id, total_score=152, rank_class=1, rank_grade=1),
                TotalRank(student_id=self.same_grade_peer.id, exam_id=self.exam_id, total_score=134, rank_class=1, rank_grade=3),
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

    def build_student_user(self):
        return SimpleNamespace(
            role="student",
            username="alice",
            student_id=self.student.id,
            school_id=None,
        )

    def test_subject_comparison_contains_subject_full_score(self):
        result = student_subject_comparison(
            student_id=self.student.id,
            exam_id=self.exam_id,
            current_user=self.build_student_user(),
            db=self.db,
        )

        by_subject = {item["subject_name"]: item for item in result}
        self.assertEqual(by_subject["语文"]["subject_full_score"], 110.0)
        self.assertEqual(by_subject["物理"]["subject_full_score"], 70.0)

    def test_score_comparison_includes_total_class_grade_and_highest_scores(self):
        result = student_score_comparison(
            student_id=self.student.id,
            exam_id=self.exam_id,
            current_user=self.build_student_user(),
            db=self.db,
        )

        by_dimension = {item["dimension_name"]: item for item in result}

        self.assertEqual(by_dimension["总分"]["student_score"], 140)
        self.assertEqual(by_dimension["总分"]["class_avg"], 146.0)
        self.assertEqual(by_dimension["总分"]["grade_avg"], 142.0)
        self.assertEqual(by_dimension["总分"]["highest_score"], 152.0)

        self.assertEqual(by_dimension["语文"]["student_score"], 88)
        self.assertEqual(by_dimension["语文"]["class_avg"], 90.0)
        self.assertEqual(by_dimension["语文"]["grade_avg"], 85.33)
        self.assertEqual(by_dimension["语文"]["highest_score"], 92.0)

        self.assertEqual(by_dimension["物理"]["student_score"], 52)
        self.assertEqual(by_dimension["物理"]["class_avg"], 56.0)
        self.assertEqual(by_dimension["物理"]["grade_avg"], 56.67)
        self.assertEqual(by_dimension["物理"]["highest_score"], 60.0)

    def test_classes_rank_includes_grade_average_for_each_class_row(self):
        current_user = SimpleNamespace(
            role="admin",
            username="admin",
            student_id=None,
            school_id=None,
        )

        result = classes_rank(
            exam_id=self.exam_id,
            subject_id=None,
            current_user=current_user,
            db=self.db,
        )

        by_class = {item["class_name"]: item for item in result}
        self.assertEqual(by_class["Class 1"]["avg_score"], 146.0)
        self.assertEqual(by_class["Class 1"]["grade_avg"], 142.0)
        self.assertEqual(by_class["Class 1"]["grade"], "G7")
        self.assertEqual(by_class["Class 2"]["avg_score"], 134.0)
        self.assertEqual(by_class["Class 2"]["grade_avg"], 142.0)
        self.assertEqual(by_class["Class 2"]["grade"], "G7")


if __name__ == "__main__":
    unittest.main()
