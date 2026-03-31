import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.class_ import Class
from app.models.school import School
from app.models.student import Student
from app.models.user import User
from app.routers.accounts import CreateAccountRequest, create_account, list_accounts
from app.schemas.auth import RoleEnum


class AccountManagementSchoolAdminTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.SessionLocal()

        self.school_a = School(name="School A", location="City A", school_level="middle")
        self.school_b = School(name="School B", location="City B", school_level="middle")
        self.db.add_all([self.school_a, self.school_b])
        self.db.flush()

        self.class_a = Class(name="Class A", grade="Grade 7", school_id=self.school_a.id)
        self.class_b = Class(name="Class B", grade="Grade 7", school_id=self.school_b.id)
        self.db.add_all([self.class_a, self.class_b])
        self.db.flush()

        self.student_a = Student(student_no="S1001", name="Student A", gender="M", class_id=self.class_a.id)
        self.student_b = Student(student_no="S2001", name="Student B", gender="F", class_id=self.class_b.id)
        self.db.add_all([self.student_a, self.student_b])
        self.db.flush()

        self.super_admin = User(
            username="root",
            password_hash="hashed",
            role="admin",
            school_id=None,
        )
        self.school_admin_a = User(
            username="school-admin-a",
            password_hash="hashed",
            role="school_admin",
            school_id=self.school_a.id,
        )
        self.teacher_a = User(
            username="teacher-a",
            password_hash="hashed",
            role="teacher",
            school_id=self.school_a.id,
        )
        self.teacher_b = User(
            username="teacher-b",
            password_hash="hashed",
            role="teacher",
            school_id=self.school_b.id,
        )
        self.db.add_all([self.super_admin, self.school_admin_a, self.teacher_a, self.teacher_b])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_school_admin_can_create_teacher_without_explicit_school_id(self):
        req = CreateAccountRequest(
            username="teacher-new",
            password="secret12",
            role=RoleEnum.teacher,
            school_id=None,
            student_id=None,
        )

        payload = create_account(req, self.school_admin_a, self.db)

        self.assertEqual(payload.role, "teacher")
        self.assertEqual(payload.school_id, self.school_a.id)

    def test_school_admin_create_rejects_school_admin_role(self):
        req = CreateAccountRequest(
            username="new-school-admin",
            password="secret12",
            role=RoleEnum.school_admin,
            school_id=self.school_a.id,
            student_id=None,
        )

        with self.assertRaises(HTTPException) as ctx:
            create_account(req, self.school_admin_a, self.db)

        self.assertIn(ctx.exception.status_code, (400, 403))

    def test_school_admin_list_only_sees_own_school_teacher_and_student_accounts(self):
        items = list_accounts(self.school_admin_a, self.db, None)
        usernames = {item.username for item in items}

        self.assertIn("teacher-a", usernames)
        self.assertNotIn("teacher-b", usernames)
        self.assertNotIn("school-admin-a", usernames)
        self.assertNotIn("root", usernames)

    def test_school_admin_alias_role_is_treated_as_school_admin_scope(self):
        alias_school_admin = User(
            username="school-admin-alias",
            password_hash="hashed",
            role="学校管理员",
            school_id=self.school_a.id,
        )

        items = list_accounts(alias_school_admin, self.db, None)
        usernames = {item.username for item in items}

        self.assertIn("teacher-a", usernames)
        self.assertNotIn("teacher-b", usernames)
        self.assertNotIn("school-admin-a", usernames)


if __name__ == "__main__":
    unittest.main()
