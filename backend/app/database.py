import json

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import DATABASE_URL

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def _sqlite_table_columns(bind: Engine, table_name: str) -> set[str]:
    with bind.connect() as conn:
        rows = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
    return {row[1] for row in rows}


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
        "schedule_periods",
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

    # Backward compatibility: older phase1 schema used structured columns instead of content/result/error/context.
    if "lesson_plans" in table_names:
        columns = {col["name"] for col in inspector.get_columns("lesson_plans")}
        if "content" not in columns:
            missing_statements.append("ALTER TABLE lesson_plans ADD COLUMN content TEXT")

    if "schedule_tasks" in table_names:
        columns = {col["name"] for col in inspector.get_columns("schedule_tasks")}
        if "context" not in columns:
            missing_statements.append("ALTER TABLE schedule_tasks ADD COLUMN context TEXT")
        if "result" not in columns:
            missing_statements.append("ALTER TABLE schedule_tasks ADD COLUMN result TEXT")
        if "error" not in columns:
            missing_statements.append("ALTER TABLE schedule_tasks ADD COLUMN error TEXT")

    if "schedule_periods" in table_names:
        columns = {col["name"] for col in inspector.get_columns("schedule_periods")}
        if "include_in_auto_schedule" not in columns:
            missing_statements.append(
                "ALTER TABLE schedule_periods ADD COLUMN include_in_auto_schedule BOOLEAN NOT NULL DEFAULT 1"
            )
        if "school_id" not in columns:
            missing_statements.append("ALTER TABLE schedule_periods ADD COLUMN school_id INTEGER")
    if missing_statements:
        with bind.begin() as conn:
            for statement in missing_statements:
                conn.execute(text(statement))

    # Data backfill for legacy schema rows.
    if "lesson_plans" in table_names:
        columns = _sqlite_table_columns(bind, "lesson_plans")
        if {
            "content",
            "weekly_hours",
            "priority",
            "avoid_consecutive",
            "forbidden_periods_json",
        }.issubset(columns):
            with bind.begin() as conn:
                rows = conn.execute(
                    text(
                        "SELECT id, content, weekly_hours, priority, avoid_consecutive, forbidden_periods_json "
                        "FROM lesson_plans"
                    )
                ).mappings().all()
                for row in rows:
                    if row["content"] and str(row["content"]).strip():
                        continue
                    forbidden_periods: list[list[int]] = []
                    raw_forbidden = row["forbidden_periods_json"]
                    if raw_forbidden:
                        try:
                            parsed = json.loads(raw_forbidden)
                            if isinstance(parsed, list):
                                forbidden_periods = parsed
                        except json.JSONDecodeError:
                            forbidden_periods = []

                    payload = json.dumps(
                        {
                            "weekly_hours": int(row["weekly_hours"] or 0),
                            "priority": int(row["priority"] or 1),
                            "avoid_consecutive": bool(row["avoid_consecutive"]),
                            "forbidden_periods": forbidden_periods,
                        },
                        ensure_ascii=False,
                    )
                    conn.execute(
                        text("UPDATE lesson_plans SET content = :content WHERE id = :id"),
                        {"id": row["id"], "content": payload},
                    )

    if "schedule_tasks" in table_names:
        columns = _sqlite_table_columns(bind, "schedule_tasks")
        with bind.begin() as conn:
            if {"result", "result_json"}.issubset(columns):
                conn.execute(
                    text(
                        "UPDATE schedule_tasks SET result = result_json "
                        "WHERE (result IS NULL OR result = '') AND result_json IS NOT NULL"
                    )
                )
            if {"error", "error_json"}.issubset(columns):
                conn.execute(
                    text(
                        "UPDATE schedule_tasks SET error = error_json "
                        "WHERE (error IS NULL OR error = '') AND error_json IS NOT NULL"
                    )
                )
            if {"context", "created_by"}.issubset(columns):
                rows = conn.execute(
                    text(
                        "SELECT id, context, created_by FROM schedule_tasks "
                        "WHERE created_by IS NOT NULL"
                    )
                ).mappings().all()
                for row in rows:
                    if row["context"] and str(row["context"]).strip():
                        continue
                    context_payload = json.dumps({"triggered_by": int(row["created_by"])}, ensure_ascii=False)
                    conn.execute(
                        text("UPDATE schedule_tasks SET context = :context WHERE id = :id"),
                        {"id": row["id"], "context": context_payload},
                    )

    if "schedule_periods" in table_names:
        columns = _sqlite_table_columns(bind, "schedule_periods")
        if "include_in_auto_schedule" in columns:
            with bind.begin() as conn:
                conn.execute(
                    text(
                        "UPDATE schedule_periods SET include_in_auto_schedule = 1 "
                        "WHERE include_in_auto_schedule IS NULL"
                    )
                )
