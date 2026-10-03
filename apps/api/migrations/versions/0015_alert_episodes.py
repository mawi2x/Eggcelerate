"""Durable monitoring candidates and alert episode lifecycle.

Revision ID: 0015
Revises: 0014
"""

import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("alerts", sa.Column("device_id", sa.Uuid()))
    op.add_column("alerts", sa.Column("condition_state", sa.Text()))
    op.add_column("alerts", sa.Column("resolved_at", sa.DateTime(timezone=True)))
    op.add_column("alerts", sa.Column("resolution_reason", sa.Text()))
    op.create_check_constraint(
        "ck_alerts_condition_state",
        "alerts",
        "condition_state IS NULL OR condition_state IN ('active', 'resolved')",
    )
    op.create_foreign_key(
        "fk_alerts_farm_device",
        "alerts",
        "devices",
        ["farm_id", "device_id"],
        ["farm_id", "id"],
    )
    op.create_table(
        "alert_monitors",
        sa.Column("farm_id", sa.Uuid(), primary_key=True),
        sa.Column("device_id", sa.Uuid(), primary_key=True),
        sa.Column("condition", sa.Text(), primary_key=True),
        sa.Column("incubator_id", sa.Text(), nullable=False),
        sa.Column("candidate_since", sa.DateTime(timezone=True)),
        sa.Column("active_alert_id", sa.Text()),
        sa.Column("generation", sa.Integer(), nullable=False),
        sa.Column("source_signature", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"]),
        sa.ForeignKeyConstraint(
            ["farm_id", "device_id"],
            ["devices.farm_id", "devices.id"],
            name="fk_monitors_farm_device",
        ),
        sa.ForeignKeyConstraint(
            ["farm_id", "active_alert_id"],
            ["alerts.farm_id", "alerts.public_id"],
            name="fk_monitors_farm_alert",
        ),
        sa.CheckConstraint(
            "condition IN ('temp', 'humidity', 'water', 'offline') AND generation >= 0",
            name="ck_monitors_condition_generation",
        ),
    )


def downgrade():
    op.drop_table("alert_monitors")
    op.drop_constraint("fk_alerts_farm_device", "alerts", type_="foreignkey")
    op.drop_constraint("ck_alerts_condition_state", "alerts", type_="check")
    for column in ("resolution_reason", "resolved_at", "condition_state", "device_id"):
        op.drop_column("alerts", column)
