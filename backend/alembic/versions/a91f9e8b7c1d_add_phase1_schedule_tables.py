"""add phase1 schedule tables

Revision ID: a91f9e8b7c1d
Revises: 6d8cd6e82967
Create Date: 2026-03-25 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a91f9e8b7c1d"
down_revision: Union[str, None] = "6d8cd6e82967"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "teacher_class_subjects",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("class_id", "subject_id", name="uq_teacher_class_subject"),
    )

    op.create_table(
        "lesson_plans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("grade", sa.String(length=20), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("school_id", "grade", "subject_id", name="uq_lesson_plan_school_grade_subject"),
    )

    op.create_table(
        "class_timetables",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("class_id", sa.Integer(), nullable=False),
        sa.Column("teacher_id", sa.Integer(), nullable=False),
        sa.Column("subject_id", sa.Integer(), nullable=False),
        sa.Column("period_id", sa.Integer(), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["class_id"], ["classes.id"]),
        sa.ForeignKeyConstraint(["teacher_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["subject_id"], ["subjects.id"]),
        sa.ForeignKeyConstraint(["period_id"], ["schedule_periods.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("class_id", "weekday", "period_id", name="uq_class_timetable_slot"),
        sa.UniqueConstraint("teacher_id", "weekday", "period_id", name="uq_teacher_timetable_slot"),
    )

    op.create_table(
        "schedule_tasks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("school_id", sa.Integer(), nullable=False),
        sa.Column("grade", sa.String(length=20), nullable=False),
        sa.Column("context", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("progress", sa.Integer(), nullable=False),
        sa.Column("message", sa.String(length=500), nullable=True),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("schedule_tasks")
    op.drop_table("class_timetables")
    op.drop_table("lesson_plans")
    op.drop_table("teacher_class_subjects")

