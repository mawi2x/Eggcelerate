"""Durable real-hardware tray command and schedule state."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("climate_tests", sa.Column("tray", JSONB()))


def downgrade():
    op.drop_column("climate_tests", "tray")
