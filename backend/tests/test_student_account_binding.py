import unittest
from types import SimpleNamespace

from app.schemas.auth import UserResponse


class StudentAccountBindingTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
