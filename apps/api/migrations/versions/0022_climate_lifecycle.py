"""Persist preparation/incubation climate intent; retain prior device reports."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("climate_tests", sa.Column("intent", JSONB()))


def downgrade():
    op.drop_column("climate_tests", "intent")
