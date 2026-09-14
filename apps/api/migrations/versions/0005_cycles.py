"""Cycle identity, runtime, single terminal outcome and action replay."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "cycles",
        sa.Column("farm_id", sa.Uuid, sa.ForeignKey("farms.id"), primary_key=True),
        sa.Column("id", sa.Text, primary_key=True),
        sa.Column("incubator_id", sa.Text, nullable=False),
        sa.Column("status", sa.Text, nullable=False),
        sa.Column("started_on", sa.Text, nullable=False),
        sa.ForeignKeyConstraint(
            ["farm_id", "incubator_id"],
            ["incubators.farm_id", "incubators.public_id"],
            name="fk_cycles_farm_incubator",
        ),
        sa.UniqueConstraint(
            "farm_id", "incubator_id", "id", name="uq_cycles_farm_incubator_id"
        ),
        sa.CheckConstraint(
            "status IN ('active', 'completed', 'stopped', 'reset')",
            name="ck_cycles_status",
        ),
    )
    op.create_index(
        "uq_cycles_active_chamber",
        "cycles",
        ["farm_id", "incubator_id"],
        unique=True,
        postgresql_where=sa.text("status = 'active'"),
    )

    op.create_table(
        "incubator_runtime",
        sa.Column("farm_id", sa.Uuid, sa.ForeignKey("farms.id"), primary_key=True),
        sa.Column("incubator_id", sa.Text, primary_key=True),
        sa.Column("cycle_id", sa.Text),
        sa.Column("day_of_incubation", sa.Integer, nullable=False),
        sa.Column("total_eggs_loaded", sa.Integer),
        sa.Column("fertile_eggs", sa.Integer),
        sa.Column("cycle_phase", sa.Text, nullable=False),
        sa.Column("last_turned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_turn_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["farm_id", "incubator_id"],
            ["incubators.farm_id", "incubators.public_id"],
            name="fk_runtime_farm_incubator",
        ),
        sa.ForeignKeyConstraint(
            ["farm_id", "incubator_id", "cycle_id"],
            ["cycles.farm_id", "cycles.incubator_id", "cycles.id"],
            name="fk_runtime_farm_cycle",
        ),
        sa.CheckConstraint(
            "day_of_incubation >= 0 AND (total_eggs_loaded IS NULL OR total_eggs_loaded >= 0)",
            name="ck_runtime_counts",
        ),
        sa.CheckConstraint(
            "fertile_eggs IS NULL OR (fertile_eggs >= 0 AND fertile_eggs <= total_eggs_loaded)",
            name="ck_runtime_fertile",
        ),
    )

    op.create_table(
        "cycle_history",
        sa.Column("farm_id", sa.Uuid, sa.ForeignKey("farms.id"), primary_key=True),
        sa.Column("cycle_id", sa.Text, primary_key=True),
        sa.Column("public_id", sa.Text, nullable=False),
        sa.Column("kind", sa.Text, nullable=False),
        sa.Column("incubator_id", sa.Text, nullable=False),
        sa.Column("chamber_name", sa.Text, nullable=False),
        sa.Column("mode_id", sa.Text, nullable=False),
        sa.Column("mode_name", sa.Text, nullable=False),
        sa.Column("started_on", sa.Text),
        sa.Column("ended_on", sa.Text),
        sa.Column("stopped_at", sa.DateTime(timezone=True)),
        sa.Column("day_stopped", sa.Integer),
        sa.Column("total_eggs", sa.Integer, nullable=False),
        sa.Column("fertile_eggs", sa.Integer),
        sa.Column("hatched_eggs", sa.Integer),
        sa.Column("position", sa.Integer, nullable=False),
        sa.ForeignKeyConstraint(
            ["farm_id", "incubator_id", "cycle_id"],
            ["cycles.farm_id", "cycles.incubator_id", "cycles.id"],
            name="fk_history_farm_cycle",
        ),
        sa.UniqueConstraint("farm_id", "public_id", name="uq_history_farm_public_id"),
        sa.CheckConstraint(
            "total_eggs >= 0 AND (fertile_eggs IS NULL OR (fertile_eggs >= 0 AND fertile_eggs <= total_eggs))",
            name="ck_history_counts",
        ),
        sa.CheckConstraint(
            "(kind = 'completed' AND started_on IS NOT NULL AND ended_on IS NOT NULL AND hatched_eggs IS NOT NULL AND hatched_eggs >= 0 AND hatched_eggs <= coalesce(fertile_eggs, total_eggs) AND stopped_at IS NULL AND day_stopped IS NULL) OR (kind = 'stopped' AND stopped_at IS NOT NULL AND day_stopped IS NOT NULL AND day_stopped >= 0 AND hatched_eggs IS NULL AND started_on IS NULL AND ended_on IS NULL)",
            name="ck_history_outcome",
        ),
    )

    op.create_table(
        "cycle_idempotency",
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
    op.drop_table("cycle_idempotency")
    op.drop_table("cycle_history")
    op.drop_table("incubator_runtime")
    op.drop_index("uq_cycles_active_chamber", table_name="cycles")
    op.drop_table("cycles")
