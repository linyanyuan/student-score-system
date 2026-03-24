import os
import tempfile
import unittest

from sqlalchemy import create_engine, text

from app.database import ensure_sqlite_user_schema_compat


class DBSchemaCompatTests(unittest.TestCase):
    def test_ensure_schema_adds_missing_school_id_column(self):
        fd, db_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        engine = None
        try:
            engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
            with engine.begin() as conn:
                conn.execute(
                    text(
                        """
                        CREATE TABLE users (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            username VARCHAR(50) NOT NULL UNIQUE,
                            password_hash VARCHAR(200) NOT NULL,
                            role VARCHAR(20) NOT NULL,
                            created_at DATETIME NOT NULL,
                            is_active BOOLEAN NOT NULL
                        )
                        """
                    )
                )

                cols_before = {
                    row[1]
                    for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()
                }
                self.assertNotIn("school_id", cols_before)

            ensure_sqlite_user_schema_compat(engine)

            with engine.connect() as conn:
                cols_after = {
                    row[1]
                    for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()
                }
                self.assertIn("school_id", cols_after)
        finally:
            if engine is not None:
                engine.dispose()
            if os.path.exists(db_path):
                os.remove(db_path)

    def test_ensure_schema_adds_missing_student_id_column(self):
        fd, db_path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        engine = None
        try:
            engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
            with engine.begin() as conn:
                conn.execute(
                    text(
                        """
                        CREATE TABLE users (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            username VARCHAR(50) NOT NULL UNIQUE,
                            password_hash VARCHAR(200) NOT NULL,
                            role VARCHAR(20) NOT NULL,
                            school_id INTEGER NULL,
                            created_at DATETIME NOT NULL,
                            is_active BOOLEAN NOT NULL
                        )
                        """
                    )
                )

                cols_before = {
                    row[1]
                    for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()
                }
                self.assertNotIn("student_id", cols_before)

            ensure_sqlite_user_schema_compat(engine)

            with engine.connect() as conn:
                cols_after = {
                    row[1]
                    for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()
                }
                self.assertIn("student_id", cols_after)
        finally:
            if engine is not None:
                engine.dispose()
            if os.path.exists(db_path):
                os.remove(db_path)


if __name__ == "__main__":
    unittest.main()
