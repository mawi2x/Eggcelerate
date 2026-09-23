"""Add app-managed users, owner memberships, and revocable sessions.

Revision ID: 0012
Revises: 0011
"""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("length(trim(email)) > 0", name="ck_users_email"),
        sa.CheckConstraint(
            "length(trim(display_name)) > 0", name="ck_users_display_name"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_table(
        "farm_memberships",
        sa.Column("farm_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("role IN ('owner')", name="ck_farm_memberships_role"),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("farm_id", "user_id", name="uq_farm_memberships_pair"),
    )
    op.create_table(
        "auth_sessions",
        sa.Column("session_hash", sa.Text(), nullable=False),
        sa.Column("farm_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("csrf_token", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("length(session_hash) = 64", name="ck_auth_sessions_hash"),
        sa.CheckConstraint(
            "length(csrf_token) >= 32", name="ck_auth_sessions_csrf_token"
        ),
        sa.CheckConstraint("expires_at > created_at", name="ck_auth_sessions_expiry"),
        sa.ForeignKeyConstraint(
            ["farm_id", "user_id"],
            ["farm_memberships.farm_id", "farm_memberships.user_id"],
            ondelete="CASCADE",
            name="fk_auth_sessions_membership",
        ),
        sa.PrimaryKeyConstraint("session_hash"),
    )
    op.create_index(
        "ix_auth_sessions_user_expiry",
        "auth_sessions",
        ["user_id", "expires_at"],
    )


def downgrade():
    op.drop_index("ix_auth_sessions_user_expiry", table_name="auth_sessions")
    op.drop_table("auth_sessions")
    op.drop_table("farm_memberships")
    op.drop_table("users")
