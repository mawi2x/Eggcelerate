"""Persist the boot identity used for each durable device-command dispatch.

Revision ID: 0010
Revises: 0009
"""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("device_commands", sa.Column("dispatch_boot_id", sa.Text()))
    op.add_column(
        "device_commands",
        sa.Column("dispatch_booted_at", sa.DateTime(timezone=True)),
    )
    op.add_column("device_commands", sa.Column("dispatch_seq", sa.Integer()))
    op.create_check_constraint(
        "ck_device_command_dispatch_identity",
        "device_commands",
        "(dispatch_boot_id IS NULL AND dispatch_booted_at IS NULL AND dispatch_seq IS NULL) "
        "OR (dispatch_boot_id IS NOT NULL AND dispatch_booted_at IS NOT NULL "
        "AND dispatch_seq IS NOT NULL AND dispatch_seq >= 0)",
    )


def downgrade():
    op.drop_constraint(
        "ck_device_command_dispatch_identity", "device_commands", type_="check"
    )
    op.drop_column("device_commands", "dispatch_seq")
    op.drop_column("device_commands", "dispatch_booted_at")
    op.drop_column("device_commands", "dispatch_boot_id")
