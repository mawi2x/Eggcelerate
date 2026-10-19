"""Bounded equipment benchmarks, separate from egg incubation cycles."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "benchmark_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("farm_id", sa.Uuid(), nullable=False),
        sa.Column("incubator_id", sa.Text(), nullable=False),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column("chamber_name", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("boot_id", sa.Text(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("conditions", JSONB(), nullable=False),
        sa.Column("settings", JSONB(), nullable=False),
        sa.Column("result", JSONB()),
        sa.Column("reason", sa.Text()),
        sa.CheckConstraint("kind IN ('htm','ltm','lhm')", name="ck_benchmark_kind"),
        sa.CheckConstraint(
            "ended_at IS NULL OR ended_at >= started_at", name="ck_benchmark_dates"
        ),
    )
    op.create_index(
        "ix_benchmark_farm_started", "benchmark_runs", ["farm_id", "started_at"]
    )
    op.create_index(
        "uq_benchmark_open_chamber",
        "benchmark_runs",
        ["farm_id", "incubator_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
    )


def downgrade():
    op.drop_table("benchmark_runs")
