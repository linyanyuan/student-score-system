import unittest

from app.schemas.auth import UserResponse


class StudentAccountBindingTests(unittest.TestCase):
    def test_user_response_exposes_student_binding_fields(self):
        fields = UserResponse.model_fields
        self.assertIn("student_id", fields)
        self.assertIn("student_name", fields)
        self.assertIn("student_no", fields)


if __name__ == "__main__":
    unittest.main()
