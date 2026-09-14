"""Durable alerts, dismissal tombstones and atomic action replay."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "alerts",
        sa.Column("farm_id", sa.Uuid, sa.ForeignKey("farms.id"), primary_key=True),
        sa.Column("public_id", sa.Text, primary_key=True),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("incubator_id", sa.Text),
        sa.Column("unit_name", sa.Text),
        sa.Column("severity", sa.Text, nullable=False),
        sa.Column("code", sa.Text, nullable=False),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True)),
        sa.Column("dismissed", sa.Boolean, nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(
            ["farm_id", "incubator_id"],
            ["incubators.farm_id", "incubators.public_id"],
            name="fk_alerts_farm_incubator",
        ),
        sa.CheckConstraint(
            "severity IN ('critical', 'warning', 'info')", name="ck_alerts_severity"
        ),
    )
    op.create_table(
        "alert_idempotency",
        sa.Column("farm_id", sa.Uuid, sa.ForeignKey("farms.id"), primary_key=True),
        sa.Column("scope", sa.Text, primary_key=True),
        sa.Column("key", sa.Text, primary_key=True),
        sa.Column("fingerprint", sa.Text, nullable=False),
        sa.Column("response", JSONB, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade():
    op.drop_table("alert_idempotency")
    op.drop_table("alerts")
