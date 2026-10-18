"""Automatic preparation-through-incubation history with immutable snapshots."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "incubation_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("farm_id", sa.Uuid(), nullable=False),
        sa.Column("incubator_id", sa.Text(), nullable=False),
        sa.Column("chamber_name", sa.Text(), nullable=False),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column("mode", JSONB(), nullable=False),
        sa.Column("cycle_id", sa.Text()),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("prepared_at", sa.DateTime(timezone=True)),
        sa.Column("incubation_at", sa.DateTime(timezone=True)),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("total_eggs", sa.Integer()),
        sa.Column("approximate", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("end_reason", sa.Text()),
        sa.UniqueConstraint("farm_id", "cycle_id", name="uq_run_cycle"),
        sa.CheckConstraint(
            "status IN ('preparing','incubating','completed','stopped','cancelled')",
            name="ck_run_status",
        ),
        sa.CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at", name="ck_run_dates"
        ),
        sa.CheckConstraint(
            "(status IN ('preparing','incubating') AND ended_at IS NULL) OR (status NOT IN ('preparing','incubating') AND ended_at IS NOT NULL)",
            name="ck_run_terminal",
        ),
    )
    op.create_index("ix_run_farm_started", "incubation_runs", ["farm_id", "started_at"])
    op.create_index(
        "uq_run_open_chamber",
        "incubation_runs",
        ["farm_id", "incubator_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
    )


def downgrade():
    op.drop_table("incubation_runs")
