"""add school notice tables

Revision ID: 20260514_school_notice
Revises: c9f0a4d1b2e3
Create Date: 2026-05-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20260514_school_notice'
down_revision: Union[str, None] = 'c9f0a4d1b2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'school_notices',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('school_id', sa.Integer(), sa.ForeignKey('schools.id'), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='draft'),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
    )
    op.create_table(
        'school_notice_audiences',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('notice_id', sa.Integer(), sa.ForeignKey('school_notices.id'), nullable=False),
        sa.Column('audience_type', sa.String(length=30), nullable=False),
        sa.Column('target_id', sa.Integer(), nullable=True),
        sa.Column('target_label', sa.String(length=100), nullable=True),
    )
    op.create_table(
        'school_notice_recipients',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('notice_id', sa.Integer(), sa.ForeignKey('school_notices.id'), nullable=False),
        sa.Column('teacher_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default=sa.text('0')),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('notice_id', 'teacher_id', name='uq_school_notice_recipient'),
    )


def downgrade() -> None:
    op.drop_table('school_notice_recipients')
    op.drop_table('school_notice_audiences')
    op.drop_table('school_notices')
