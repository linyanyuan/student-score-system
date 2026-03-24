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


def upgrade() -> None:
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
    op.drop_constraint("uq_users_student_id", "users", type_="unique")
    op.drop_constraint("fk_users_student_id_students", "users", type_="foreignkey")
    op.drop_column("users", "student_id")
