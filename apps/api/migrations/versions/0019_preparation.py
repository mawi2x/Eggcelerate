"""Persist the preparation stage before a cycle starts."""

import sqlalchemy as sa
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "incubator_runtime",
        sa.Column("preparation_started_at", sa.DateTime(timezone=True)),
    )


def downgrade():
    op.drop_column("incubator_runtime", "preparation_started_at")
