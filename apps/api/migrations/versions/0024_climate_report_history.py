"""Retain received control reports with their environmental context."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "climate_report_history",
        sa.Column("farm_id", sa.Uuid(), primary_key=True),
        sa.Column("device_id", sa.Uuid(), primary_key=True),
        sa.Column("boot_id", sa.Text(), primary_key=True),
        sa.Column("seq", sa.Integer(), primary_key=True),
        sa.Column("incubator_id", sa.Text(), nullable=False),
        sa.Column("booted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("temperature_c", sa.Double()),
        sa.Column("humidity_pct", sa.Double()),
        sa.Column("report", JSONB(), nullable=False),
        sa.ForeignKeyConstraint(
            ["farm_id", "incubator_id"],
            ["incubators.farm_id", "incubators.public_id"],
            ondelete="CASCADE",
            name="fk_climate_history_incubator",
        ),
        sa.CheckConstraint("seq >= 0", name="ck_climate_history_seq"),
    )
    op.create_index(
        "ix_climate_history_chamber_received",
        "climate_report_history",
        ["farm_id", "incubator_id", "received_at"],
    )


def downgrade():
    op.drop_table("climate_report_history")
