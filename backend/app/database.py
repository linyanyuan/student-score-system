from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def ensure_sqlite_user_schema_compat(bind: Engine) -> None:
    if bind.dialect.name != "sqlite":
        return

    inspector = inspect(bind)
    table_names = set(inspector.get_table_names())
    school_scoped_tables = {
        "users",
        "classes",
        "subjects",
        "custom_field_definitions",
        "exams",
    }

    missing_statements: list[str] = []

    for table_name in sorted(table_names & school_scoped_tables):
        columns = {col["name"] for col in inspector.get_columns(table_name)}
        if "school_id" not in columns:
            missing_statements.append(f"ALTER TABLE {table_name} ADD COLUMN school_id INTEGER")
        if table_name == "users" and "student_id" not in columns:
            missing_statements.append("ALTER TABLE users ADD COLUMN student_id INTEGER")
        if table_name == "subjects" and "grades" not in columns:
            missing_statements.append("ALTER TABLE subjects ADD COLUMN grades VARCHAR(200)")

    if not missing_statements:
        return

    with bind.begin() as conn:
        for statement in missing_statements:
            conn.execute(text(statement))
