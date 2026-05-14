import os
import tempfile
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.dependencies import get_current_user, get_db
from app.main import app
from app.models.class_ import Class
from app.models.school import School
from app.models.student import Student
from app.models.teacher_class import TeacherClass
from app.models.user import User


class SchoolNoticesApiTests(unittest.TestCase):
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

        self.school = School(name='Notice School', location='A', school_level='middle')
        self.db.add(self.school)
        self.db.flush()
        self.admin = User(username='notice_admin', password_hash='x', role='school_admin', school_id=self.school.id)
        self.teacher_a = User(username='notice_teacher_a', password_hash='x', role='teacher', school_id=self.school.id)
        self.teacher_b = User(username='notice_teacher_b', password_hash='x', role='teacher', school_id=self.school.id)
        self.teacher_c = User(username='notice_teacher_c', password_hash='x', role='teacher', school_id=self.school.id)
        self.class_a = Class(name='八1班', grade='八年级', school_id=self.school.id)
        self.class_b = Class(name='七1班', grade='七年级', school_id=self.school.id)
        self.db.add_all([self.class_a, self.class_b])
        self.db.flush()
        self.student_a = Student(student_no='S1', name='学生一', gender='F', class_id=self.class_a.id)
        self.db.add(self.student_a)
        self.db.flush()
        self.student_user = User(
            username='notice_student_a',
            password_hash='x',
            role='student',
            school_id=self.school.id,
            student_id=self.student_a.id,
        )
        self.db.add_all([self.admin, self.teacher_a, self.teacher_b, self.teacher_c, self.student_user])
        self.db.flush()
        self.db.add_all([
            TeacherClass(teacher_id=self.teacher_a.id, class_id=self.class_a.id),
            TeacherClass(teacher_id=self.teacher_b.id, class_id=self.class_a.id),
            TeacherClass(teacher_id=self.teacher_c.id, class_id=self.class_b.id),
        ])
        self.db.commit()

        def override_get_db():
            db = self.SessionTesting()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = lambda: self.admin
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.close()
        self.engine.dispose()
        os.unlink(self.tmp.name)

    def test_school_admin_can_create_and_send_notice_by_class_and_teacher(self):
        create_resp = self.client.post('/api/school-notices/', json={
            'title': '教研通知',
            'content': '请按时参加。',
            'audiences': [
                {'audience_type': 'class', 'target_id': self.class_a.id, 'target_label': '八1班'},
                {'audience_type': 'teacher', 'target_id': self.teacher_c.id, 'target_label': 'notice_teacher_c'},
            ],
        })

        self.assertEqual(create_resp.status_code, 201)
        notice_id = create_resp.json()['id']

        send_resp = self.client.post(f'/api/school-notices/{notice_id}/send')

        self.assertEqual(send_resp.status_code, 200)
        self.assertEqual(send_resp.json()['status'], 'sent')
        self.assertEqual(send_resp.json()['recipient_count'], 4)

    def test_teacher_inbox_returns_only_own_notices_and_can_mark_read(self):
        create_resp = self.client.post('/api/school-notices/', json={
            'title': '成绩录入',
            'content': '今晚前完成。',
            'audiences': [
                {'audience_type': 'teacher', 'target_id': self.teacher_a.id, 'target_label': 'notice_teacher_a'},
            ],
        })
        notice_id = create_resp.json()['id']
        self.client.post(f'/api/school-notices/{notice_id}/send')

        app.dependency_overrides[get_current_user] = lambda: self.teacher_a
        inbox_resp = self.client.get('/api/school-notices/inbox')

        self.assertEqual(inbox_resp.status_code, 200)
        self.assertEqual(len(inbox_resp.json()), 1)
        recipient_id = inbox_resp.json()[0]['id']
        self.assertFalse(inbox_resp.json()[0]['is_read'])

        read_resp = self.client.patch(f'/api/school-notices/inbox/{recipient_id}/read')

        self.assertEqual(read_resp.status_code, 200)
        self.assertTrue(read_resp.json()['is_read'])

        app.dependency_overrides[get_current_user] = lambda: self.teacher_b
        other_inbox = self.client.get('/api/school-notices/inbox')
        self.assertEqual(other_inbox.status_code, 200)
        self.assertEqual(other_inbox.json(), [])

    def test_student_receives_class_notice_in_inbox(self):
        create_resp = self.client.post('/api/school-notices/', json={
            'title': '班级通知',
            'content': '明天带材料。',
            'audiences': [
                {'audience_type': 'class', 'target_id': self.class_a.id, 'target_label': '八1班'},
            ],
        })
        notice_id = create_resp.json()['id']
        self.client.post(f'/api/school-notices/{notice_id}/send')

        app.dependency_overrides[get_current_user] = lambda: self.student_user
        inbox_resp = self.client.get('/api/school-notices/inbox')

        self.assertEqual(inbox_resp.status_code, 200)
        self.assertEqual(len(inbox_resp.json()), 1)
        self.assertEqual(inbox_resp.json()[0]['title'], '班级通知')
        self.assertFalse(inbox_resp.json()[0]['is_read'])
