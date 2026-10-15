"""Persist farm sensor reporting interval preferences."""

import sqlalchemy as sa
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "farm_preferences",
        sa.Column(
            "sampling_interval_seconds",
            sa.Integer(),
            nullable=False,
            server_default="15",
        ),
    )
    op.create_check_constraint(
        "ck_preferences_sampling_interval",
        "farm_preferences",
        "sampling_interval_seconds IN (5, 10, 15, 30)",
    )


def downgrade():
    op.drop_constraint(
        "ck_preferences_sampling_interval", "farm_preferences", type_="check"
    )
    op.drop_column("farm_preferences", "sampling_interval_seconds")
