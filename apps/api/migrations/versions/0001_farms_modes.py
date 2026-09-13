"""Farms, modes and atomic mode replay records.

Revision ID: 0001
Revises: none
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb")
    op.create_table(
        "farms",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_table(
        "modes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("farm_id", sa.Uuid(), sa.ForeignKey("farms.id"), nullable=False),
        sa.Column("public_id", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("built_in", sa.Boolean(), nullable=False),
        sa.Column("temp_min", sa.Double(), nullable=False),
        sa.Column("temp_max", sa.Double(), nullable=False),
        sa.Column("humidity_min", sa.Double(), nullable=False),
        sa.Column("humidity_max", sa.Double(), nullable=False),
        sa.Column("incubation_days", sa.Integer(), nullable=False),
        sa.Column("turn_interval_min", sa.Integer(), nullable=False),
        sa.Column("temp_hysteresis_c", sa.Double(), nullable=False),
        sa.Column("humidity_hysteresis_pct", sa.Double(), nullable=False),
        sa.Column("version", sa.Integer()),
        sa.Column("created_at", sa.Text()),
        sa.Column("updated_at", sa.Text()),
        sa.UniqueConstraint("farm_id", "public_id", name="uq_modes_farm_public_id"),
        sa.CheckConstraint("incubation_days BETWEEN 7 AND 45", name="ck_modes_days"),
        sa.CheckConstraint(
            "turn_interval_min BETWEEN 60 AND 1440", name="ck_modes_interval"
        ),
        sa.CheckConstraint("temp_min < temp_max", name="ck_modes_temp_order"),
        sa.CheckConstraint(
            "humidity_min < humidity_max", name="ck_modes_humidity_order"
        ),
    )
    op.create_table(
        "mode_idempotency",
        sa.Column("farm_id", sa.Uuid(), sa.ForeignKey("farms.id"), primary_key=True),
        sa.Column("scope", sa.Text(), primary_key=True),
        sa.Column("key", sa.Text(), primary_key=True),
        sa.Column("fingerprint", sa.Text(), nullable=False),
        sa.Column("response", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade():
    op.drop_table("mode_idempotency")
    op.drop_table("modes")
    op.drop_table("farms")
    # Extension ownership is database-wide; never drop other slices' data.
