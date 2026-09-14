"""Device telemetry hypertable; no synthetic data or retention policy."""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "telemetry_samples",
        sa.Column("farm_id", sa.Uuid, primary_key=True),
        sa.Column("device_id", sa.Uuid, primary_key=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), primary_key=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("temperature_c", sa.Double, nullable=False),
        sa.Column("humidity_pct", sa.Double, nullable=False),
        sa.Column("water_ok", sa.Boolean, nullable=False),
        sa.ForeignKeyConstraint(
            ["farm_id", "device_id"],
            ["devices.farm_id", "devices.id"],
            name="fk_telemetry_device",
        ),
        sa.CheckConstraint(
            "temperature_c > '-Infinity'::float8 AND temperature_c < 'Infinity'::float8",
            name="ck_telemetry_temperature",
        ),
        sa.CheckConstraint(
            "humidity_pct >= 0 AND humidity_pct <= 100", name="ck_telemetry_humidity"
        ),
    )
    op.execute(
        "SELECT create_hypertable('telemetry_samples', by_range('observed_at', INTERVAL '7 days'), create_default_indexes => FALSE)"
    )


def downgrade():
    op.drop_table("telemetry_samples")
