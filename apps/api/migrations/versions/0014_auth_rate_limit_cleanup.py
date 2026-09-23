"""Index login throttle windows for opportunistic expired-row cleanup.

Revision ID: 0014
Revises: 0013
"""

from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        "ix_auth_rate_limits_window",
        "auth_rate_limits",
        ["window_started_at"],
    )


def downgrade():
    op.drop_index("ix_auth_rate_limits_window", table_name="auth_rate_limits")
