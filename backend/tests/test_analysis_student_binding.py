import unittest
from datetime import date
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.class_ import Class
from app.models.exam import Exam
from app.models.school import School
from app.models.student import Student
from app.models.teacher_class import TeacherClass
from app.models.total_rank import TotalRank
from app.models.user import User
from app.routers.analysis import _check_class_permission, _check_student_permission, classes_rank
from app.routers.classes import list_classes
from app.routers.students import list_students


class AnalysisStudentBindingTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.SessionLocal()

        school = School(name="Test School", location="Test", school_level="middle")
        self.db.add(school)
        self.db.flush()

        self.class_a = Class(name="Class A", grade="G7", school_id=school.id)
        self.class_b = Class(name="Class B", grade="G7", school_id=school.id)
        self.class_c = Class(name="Class C", grade="G8", school_id=school.id)
        self.db.add_all([self.class_a, self.class_b, self.class_c])
        self.db.flush()

        self.teacher = User(username="teacher_a", password_hash="x", role="teacher", school_id=school.id)
        self.db.add(self.teacher)
        self.db.flush()
        self.db.add(TeacherClass(teacher_id=self.teacher.id, class_id=self.class_a.id))

        self.exam = Exam(name="G7 Midterm", exam_date=date(2026, 5, 1), grade="G7", school_id=school.id)
        self.db.add(self.exam)
        self.db.flush()

        self.bound_student = Student(
            student_no="S1001",
            name="Bound",
            gender="M",
            class_id=self.class_a.id,
        )
        self.other_student = Student(
            student_no="S1002",
            name="Other",
            gender="F",
            class_id=self.class_b.id,
        )
        self.cross_grade_student = Student(
            student_no="S1003",
            name="Cross",
            gender="F",
            class_id=self.class_c.id,
        )
        self.db.add_all([self.bound_student, self.other_student, self.cross_grade_student])
        self.db.flush()
        self.db.add_all(
            [
                TotalRank(student_id=self.bound_student.id, exam_id=self.exam.id, total_score=520, rank_class=1, rank_grade=1),
                TotalRank(student_id=self.other_student.id, exam_id=self.exam.id, total_score=480, rank_class=1, rank_grade=2),
                TotalRank(student_id=self.cross_grade_student.id, exam_id=self.exam.id, total_score=470, rank_class=1, rank_grade=1),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_check_student_permission_allows_bound_student_id_even_if_username_differs(self):
        current_user = SimpleNamespace(role="student", username="xiyu", student_id=self.bound_student.id)
        _check_student_permission(self.bound_student, current_user, self.db)

    def test_check_student_permission_rejects_other_student(self):
        current_user = SimpleNamespace(role="student", username="xiyu", student_id=self.bound_student.id)
        with self.assertRaises(HTTPException) as ctx:
            _check_student_permission(self.other_student, current_user, self.db)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_check_class_permission_allows_bound_student_class(self):
        current_user = SimpleNamespace(role="student", username="xiyu", student_id=self.bound_student.id)
        _check_class_permission(self.class_a.id, exam_id=1, current_user=current_user, db=self.db)

    def test_check_class_permission_rejects_other_class(self):
        current_user = SimpleNamespace(role="student", username="xiyu", student_id=self.bound_student.id)
        with self.assertRaises(HTTPException) as ctx:
            _check_class_permission(self.class_b.id, exam_id=1, current_user=current_user, db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_list_classes_for_student_returns_only_bound_class(self):
        current_user = SimpleNamespace(role="student", username="xiyu", student_id=self.bound_student.id, school_id=1)
        classes = list_classes(current_user=current_user, db=self.db)
        self.assertEqual(len(classes), 1)
        self.assertEqual(classes[0].id, self.class_a.id)

    def test_check_class_permission_rejects_unbound_teacher_class(self):
        current_user = SimpleNamespace(role="teacher", id=self.teacher.id, school_id=1)
        _check_class_permission(self.class_b.id, exam_id=self.exam.id, current_user=current_user, db=self.db)

    def test_check_class_permission_rejects_teacher_cross_grade_class(self):
        current_user = SimpleNamespace(role="teacher", id=self.teacher.id, school_id=1)
        with self.assertRaises(HTTPException) as ctx:
            _check_class_permission(self.class_c.id, exam_id=self.exam.id, current_user=current_user, db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_check_student_permission_allows_teacher_same_grade_student(self):
        current_user = SimpleNamespace(role="teacher", id=self.teacher.id, school_id=1)
        _check_student_permission(self.other_student, current_user, self.db)

    def test_check_student_permission_rejects_teacher_cross_grade_student(self):
        current_user = SimpleNamespace(role="teacher", id=self.teacher.id, school_id=1)
        with self.assertRaises(HTTPException) as ctx:
            _check_student_permission(self.cross_grade_student, current_user, self.db)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_classes_rank_for_teacher_returns_only_bound_classes(self):
        current_user = SimpleNamespace(role="teacher", id=self.teacher.id, school_id=1)
        rows = classes_rank(exam_id=self.exam.id, subject_id=None, current_user=current_user, db=self.db)
        self.assertEqual({row["class_id"] for row in rows}, {self.class_a.id, self.class_b.id})

    def test_list_classes_scope_analysis_for_teacher_returns_grade_classes(self):
        current_user = SimpleNamespace(role="teacher", id=self.teacher.id, school_id=1)
        rows = list_classes(current_user=current_user, db=self.db, scope="analysis")
        self.assertEqual({row.id for row in rows}, {self.class_a.id, self.class_b.id})

    def test_list_students_scope_analysis_for_teacher_returns_grade_students(self):
        current_user = SimpleNamespace(role="teacher", id=self.teacher.id, school_id=1)
        page = list_students(current_user=current_user, db=self.db, page=1, page_size=20, scope="analysis")
        self.assertEqual({row.id for row in page.items}, {self.bound_student.id, self.other_student.id})


if __name__ == "__main__":
    unittest.main()
