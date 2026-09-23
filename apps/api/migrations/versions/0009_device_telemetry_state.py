"""Durable latest device telemetry and boot-aware ordering.

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "device_telemetry_state",
        sa.Column("farm_id", sa.Uuid(), nullable=False),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column("incubator_id", sa.Text(), nullable=False),
        sa.Column("boot_id", sa.Text(), nullable=False),
        sa.Column("booted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("temperature_c", sa.Double(), nullable=False),
        sa.Column("humidity_pct", sa.Double(), nullable=False),
        sa.Column("water_ok", sa.Boolean(), nullable=False),
        sa.Column("battery_pct", sa.Double(), nullable=False),
        sa.Column("power_source", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("farm_id", "device_id"),
        sa.ForeignKeyConstraint(
            ["farm_id", "device_id"],
            ["devices.farm_id", "devices.id"],
            name="fk_telemetry_state_device",
        ),
        sa.ForeignKeyConstraint(
            ["farm_id", "incubator_id"],
            ["incubators.farm_id", "incubators.public_id"],
            name="fk_telemetry_state_incubator",
        ),
        sa.UniqueConstraint(
            "farm_id", "incubator_id", name="uq_telemetry_state_incubator"
        ),
        sa.CheckConstraint("seq >= 0", name="ck_telemetry_state_seq"),
        sa.CheckConstraint(
            "humidity_pct >= 0 AND humidity_pct <= 100",
            name="ck_telemetry_state_humidity",
        ),
        sa.CheckConstraint(
            "battery_pct >= 0 AND battery_pct <= 100",
            name="ck_telemetry_state_battery",
        ),
        sa.CheckConstraint(
            "power_source IN ('grid', 'battery')",
            name="ck_telemetry_state_power",
        ),
    )


def downgrade():
    op.drop_table("device_telemetry_state")
