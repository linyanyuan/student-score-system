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
from app.models.score import Score
from app.models.student import Student
from app.models.subject import Subject
from app.models.total_rank import TotalRank
from app.models.user import User
from app.routers.accounts import _validate_student_binding
from app.routers.auth import _to_user_response
from app.routers.scores import _resolve_student_scope_id, list_scores
from app.schemas.auth import UserResponse


class StudentAccountBindingTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.SessionLocal()

        self.school = School(name="Test School", location="Test City", school_level="middle")
        self.db.add(self.school)
        self.db.flush()

        self.classroom = Class(name="Class 1", grade="Grade 7", school_id=self.school.id)
        self.other_classroom = Class(name="Class 2", grade="Grade 7", school_id=self.school.id)
        self.db.add_all([self.classroom, self.other_classroom])
        self.db.flush()

        self.student = Student(
            student_no="S1001",
            name="Test Student",
            gender="M",
            class_id=self.classroom.id,
        )
        self.other_student = Student(
            student_no="S1002",
            name="Other Student",
            gender="F",
            class_id=self.other_classroom.id,
        )
        self.db.add_all([self.student, self.other_student])
        self.db.flush()

        self.exam = Exam(
            name="Midterm",
            exam_date=date(2026, 3, 1),
            grade="Grade 7",
            school_id=self.school.id,
        )
        self.subject = Subject(
            name="Math",
            code="math",
            grades="Grade 7",
            school_id=self.school.id,
        )
        self.db.add_all([self.exam, self.subject])
        self.db.flush()

        self.db.add_all(
            [
                Score(student_id=self.student.id, exam_id=self.exam.id, subject_id=self.subject.id, score=98),
                Score(student_id=self.other_student.id, exam_id=self.exam.id, subject_id=self.subject.id, score=72),
                TotalRank(
                    student_id=self.student.id,
                    exam_id=self.exam.id,
                    total_score=98,
                    rank_class=1,
                    rank_grade=1,
                ),
                TotalRank(
                    student_id=self.other_student.id,
                    exam_id=self.exam.id,
                    total_score=72,
                    rank_class=1,
                    rank_grade=2,
                ),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_user_response_validates_student_binding_fields_from_mapping(self):
        user = UserResponse.model_validate(
            {
                "id": 1,
                "username": "student_user",
                "role": "student",
                "school_id": 10,
                "student_id": 101,
                "student_name": "Test Student",
                "student_no": "S1001",
                "created_at": "2026-03-24T12:30:00",
            }
        )

        payload = user.model_dump()
        self.assertEqual(payload["student_id"], 101)
        self.assertEqual(payload["student_name"], "Test Student")
        self.assertEqual(payload["student_no"], "S1001")

    def test_user_response_validates_student_binding_fields_from_object(self):
        source = SimpleNamespace(
            id=2,
            username="bound_student",
            role="student",
            school_id=None,
            student_id=202,
            student_name="Bound Name",
            student_no="S2002",
            created_at="2026-03-24T09:00:00",
        )

        user = UserResponse.model_validate(source)
        self.assertEqual(user.student_id, 202)
        self.assertEqual(user.student_name, "Bound Name")
        self.assertEqual(user.student_no, "S2002")

    def test_resolve_student_scope_id_uses_bound_student_for_student_role(self):
        user = SimpleNamespace(role="student", student_id=12)
        self.assertEqual(_resolve_student_scope_id(user, requested_student_id=99), 12)

    def test_resolve_student_scope_id_rejects_unbound_student(self):
        user = SimpleNamespace(role="student", student_id=None)
        with self.assertRaisesRegex(ValueError, "not bound"):
            _resolve_student_scope_id(user, requested_student_id=None)

    def test_list_scores_uses_bound_student_without_explicit_student_id(self):
        current_user = SimpleNamespace(
            id=9001,
            role="student",
            student_id=self.student.id,
            school_id=self.school.id,
        )

        response = list_scores(
            exam_id=self.exam.id,
            student_no=None,
            student_name=None,
            page=1,
            page_size=20,
            current_user=current_user,
            db=self.db,
        )

        self.assertEqual(response.total, 1)
        self.assertEqual(len(response.items), 1)
        self.assertEqual(response.items[0].student_id, self.student.id)
        self.assertEqual(response.items[0].student_no, self.student.student_no)

    def test_list_scores_rejects_unbound_student_account(self):
        current_user = SimpleNamespace(
            id=9002,
            role="student",
            student_id=None,
            school_id=self.school.id,
        )

        with self.assertRaises(HTTPException) as ctx:
            list_scores(
                exam_id=self.exam.id,
                student_no=None,
                student_name=None,
                page=1,
                page_size=20,
                current_user=current_user,
                db=self.db,
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("not bound", ctx.exception.detail)

    def test_validate_student_binding_rejects_non_student_binding(self):
        with self.assertRaises(HTTPException) as ctx:
            _validate_student_binding(
                role="teacher",
                student_id=self.student.id,
                existing_user_id=None,
                db=self.db,
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("only student accounts", ctx.exception.detail)

    def test_validate_student_binding_rejects_duplicate_student_binding(self):
        existing_user = User(
            username="bound_student",
            password_hash="hashed",
            role="student",
            school_id=self.school.id,
            student_id=self.student.id,
        )
        self.db.add(existing_user)
        self.db.commit()

        with self.assertRaises(HTTPException) as ctx:
            _validate_student_binding(
                role="student",
                student_id=self.student.id,
                existing_user_id=None,
                db=self.db,
            )

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already bound", ctx.exception.detail)

    def test_to_user_response_includes_bound_student_fields(self):
        user = User(
            username="student_user",
            password_hash="hashed",
            role="student",
            school_id=self.school.id,
            student_id=self.student.id,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        payload = _to_user_response(user, self.db)

        self.assertEqual(payload.student_id, self.student.id)
        self.assertEqual(payload.student_name, self.student.name)
        self.assertEqual(payload.student_no, self.student.student_no)


if __name__ == "__main__":
    unittest.main()
