import os
import tempfile
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.dependencies import get_current_user, get_db
from app.main import app
from app.models.school import School
from app.models.user import User


class AuthTeachersApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
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
        self.school = School(name='Teacher Api School', location='A', school_level='middle')
        self.db.add(self.school)
        self.db.flush()

        self.school_admin = User(
            username='teachers_school_admin',
            password_hash='x',
            role='school_admin',
            school_id=self.school.id,
        )
        self.teacher_a = User(
            username='teacher_a',
            password_hash='x',
            role='teacher',
            school_id=self.school.id,
        )
        self.teacher_b = User(
            username='teacher_b',
            password_hash='x',
            role='teacher',
            school_id=self.school.id,
        )
        self.teacher_other = User(
            username='teacher_other',
            password_hash='x',
            role='teacher',
            school_id=self.school.id + 1,
        )
        self.db.add_all([
            self.school_admin,
            self.teacher_a,
            self.teacher_b,
            self.teacher_other,
        ])
        self.db.commit()

        def override_get_db():
            db = self.SessionTesting()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: self.school_admin
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        self.engine.dispose()
        os.unlink(self.tmp.name)

    def test_school_admin_can_list_only_teachers_in_own_school(self):
        response = self.client.get('/api/auth/teachers')

        self.assertEqual(response.status_code, 200)
        usernames = [item['username'] for item in response.json()]
        self.assertEqual(usernames, ['teacher_a', 'teacher_b'])


if __name__ == '__main__':
    unittest.main()
