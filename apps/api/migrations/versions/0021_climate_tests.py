"""Authenticated climate requests and device reports (original schema snapshot)."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "climate_tests",
        sa.Column("farm_id", sa.Uuid(), primary_key=True),
        sa.Column("incubator_id", sa.Text(), primary_key=True),
        sa.Column("request", JSONB()),
        sa.Column("report", JSONB()),
        sa.Column("reported_at", sa.DateTime(timezone=True)),
        sa.Column("boot_id", sa.Text()),
        sa.Column("booted_at", sa.DateTime(timezone=True)),
        sa.Column("seq", sa.Integer()),
        sa.Column("device_id", sa.Uuid()),
        sa.ForeignKeyConstraint(
            ["farm_id", "incubator_id"],
            ["incubators.farm_id", "incubators.public_id"],
            ondelete="CASCADE",
            name="fk_climate_test_incubator",
        ),
    )


def downgrade():
    op.drop_table("climate_tests")
