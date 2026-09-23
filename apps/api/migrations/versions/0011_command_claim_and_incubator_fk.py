"""Index and relational guard for durable device-command claims.

Revision ID: 0011
Revises: 0010
"""

from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(
        "ix_device_commands_claim",
        "device_commands",
        ["farm_id", "status", "next_attempt_at"],
    )
    op.create_foreign_key(
        "fk_device_command_incubator",
        "device_commands",
        "incubators",
        ["farm_id", "incubator_id"],
        ["farm_id", "public_id"],
        ondelete="RESTRICT",
    )


def downgrade():
    op.drop_constraint(
        "fk_device_command_incubator", "device_commands", type_="foreignkey"
    )
    op.drop_index("ix_device_commands_claim", table_name="device_commands")
