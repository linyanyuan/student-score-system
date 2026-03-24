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
    if "users" not in inspector.get_table_names():
        return

    user_columns = {col["name"] for col in inspector.get_columns("users")}
    if "student_id" in user_columns:
        return

    with bind.begin() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN student_id INTEGER"))
