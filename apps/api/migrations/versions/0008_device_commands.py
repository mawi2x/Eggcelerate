"""Durable simulator dispatch and acknowledgement state.

Revision ID: 0008
Revises: 0007
"""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "device_commands",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("farm_id", sa.Uuid(), sa.ForeignKey("farms.id"), nullable=False),
        sa.Column("incubator_id", sa.Text(), nullable=False),
        sa.Column("device_id", sa.Text(), nullable=False),
        sa.Column("request_key", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("turn_interval_min", sa.Integer(), nullable=False),
        sa.Column("executed_at", sa.DateTime(timezone=True)),
        sa.Column("ack_received_at", sa.DateTime(timezone=True)),
        sa.Column("error_code", sa.Text()),
        sa.UniqueConstraint(
            "farm_id", "incubator_id", "request_key", name="uq_device_command_request"
        ),
        sa.CheckConstraint(
            "status IN ('pending','dispatched','acked','rejected','timed_out')",
            name="ck_device_command_status",
        ),
    )


def downgrade():
    op.drop_table("device_commands")
