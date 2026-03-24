"""add student_id to users

Revision ID: 6d8cd6e82967
Revises: bbd1cd412b77
Create Date: 2026-03-24 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6d8cd6e82967"
down_revision: Union[str, None] = "bbd1cd412b77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _users_table_before_student_binding() -> sa.Table:
    metadata = sa.MetaData()
    users = sa.Table(
        "users",
        metadata,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("password_hash", sa.String(length=200), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    sa.Index("ix_users_username", users.c.username, unique=True)
    return users


def _users_table_after_student_binding() -> sa.Table:
    metadata = sa.MetaData()
    users = sa.Table(
        "users",
        metadata,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("password_hash", sa.String(length=200), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("student_id", sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["students.id"],
            name="fk_users_student_id_students",
        ),
        sa.UniqueConstraint("student_id", name="uq_users_student_id"),
    )
    sa.Index("ix_users_username", users.c.username, unique=True)
    return users


def upgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        with op.batch_alter_table(
            "users",
            recreate="always",
            copy_from=_users_table_before_student_binding(),
        ) as batch_op:
            batch_op.add_column(sa.Column("student_id", sa.Integer(), nullable=True))
            batch_op.create_foreign_key(
                "fk_users_student_id_students",
                "students",
                ["student_id"],
                ["id"],
            )
            batch_op.create_unique_constraint("uq_users_student_id", ["student_id"])
        return

    op.add_column("users", sa.Column("student_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_users_student_id_students",
        "users",
        "students",
        ["student_id"],
        ["id"],
    )
    op.create_unique_constraint("uq_users_student_id", "users", ["student_id"])


def downgrade() -> None:
    if op.get_context().dialect.name == "sqlite":
        with op.batch_alter_table(
            "users",
            recreate="always",
            copy_from=_users_table_after_student_binding(),
        ) as batch_op:
            batch_op.drop_constraint("uq_users_student_id", type_="unique")
            batch_op.drop_constraint("fk_users_student_id_students", type_="foreignkey")
            batch_op.drop_column("student_id")
        return

    op.drop_constraint("uq_users_student_id", "users", type_="unique")
    op.drop_constraint("fk_users_student_id_students", "users", type_="foreignkey")
    op.drop_column("users", "student_id")
