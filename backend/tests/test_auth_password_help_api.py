import os
import tempfile
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.dependencies import get_db
from app.main import app
from app.models.school import School
from app.models.user import User


class AuthPasswordHelpApiTests(unittest.TestCase):
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
        self.school = School(
            name="Password Help School",
            location="A",
            school_level="middle",
        )
        self.other_school = School(
            name="Other Password Help School",
            location="B",
            school_level="middle",
        )
        self.db.add_all([self.school, self.other_school])
        self.db.flush()

        self.school_admin = User(
            username="password_admin",
            password_hash="secret-hash",
            role="school_admin",
            school_id=self.school.id,
        )
        self.teacher = User(
            username="password_teacher",
            password_hash="teacher-hash",
            role="teacher",
            school_id=self.school.id,
        )
        self.student = User(
            username="password_student",
            password_hash="student-hash",
            role="student",
            school_id=self.school.id,
        )
        self.other_admin = User(
            username="password_other_admin",
            password_hash="other-hash",
            role="school_admin",
            school_id=self.other_school.id,
        )
        self.db.add_all([
            self.school_admin,
            self.teacher,
            self.student,
            self.other_admin,
        ])
        self.db.commit()

        def override_get_db():
            db = self.SessionTesting()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        self.engine.dispose()
        os.unlink(self.tmp.name)

    def test_school_admin_gets_own_account_help_without_hash(self):
        response = self.client.get(
            "/api/auth/password-help",
            params={"username": "password_admin"},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["kind"], "school_admin_self")
        self.assertEqual(data["account"]["username"], "password_admin")
        self.assertIn("password_hint", data["account"])
        self.assertNotIn("password_hash", str(data))
        self.assertNotIn("secret-hash", str(data))

    def test_teacher_gets_only_current_school_admins(self):
        response = self.client.get(
            "/api/auth/password-help",
            params={"username": "password_teacher"},
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["kind"], "school_admin_contacts")
        usernames = [item["username"] for item in data["admins"]]
        self.assertEqual(usernames, ["password_admin"])
        self.assertNotIn("password_other_admin", usernames)
        self.assertNotIn("password_hash", str(data))


if __name__ == "__main__":
    unittest.main()
