import unittest
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.class_ import Class
from app.models.school import School
from app.models.student import Student
from app.routers.analysis import _check_class_permission, _check_student_permission
from app.routers.classes import list_classes


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
        self.db.add_all([self.class_a, self.class_b])
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
        self.db.add_all([self.bound_student, self.other_student])
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


if __name__ == "__main__":
    unittest.main()
