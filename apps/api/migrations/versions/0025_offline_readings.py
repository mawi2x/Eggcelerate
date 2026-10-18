"""Durable offline replay identities, quarantine and assignment generations."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "offline_assignments",
        sa.Column("generation", sa.Uuid(), primary_key=True),
        sa.Column("public_id", sa.Text(), nullable=False),
        sa.Column("farm_id", sa.Uuid(), nullable=False),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column("incubator_id", sa.Uuid(), nullable=False),
        sa.Column("registry_created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_offline_assignment_device",
        "offline_assignments",
        ["public_id", "created_at"],
    )
    op.create_table(
        "offline_records",
        sa.Column("public_id", sa.Text(), primary_key=True),
        sa.Column("queue", sa.Text(), primary_key=True),
        sa.Column("sequence", sa.Text(), primary_key=True),
        sa.Column("farm_id", sa.Uuid()),
        sa.Column("device_id", sa.Uuid()),
        sa.Column("observed_at", sa.DateTime(timezone=True)),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("digest", sa.Text(), nullable=False),
        sa.Column("record", JSONB(), nullable=False),
        sa.Column("outcome", sa.Text(), nullable=False),
    )
    op.create_index(
        "ix_offline_records_scope",
        "offline_records",
        ["farm_id", "device_id", "observed_at"],
    )
    op.create_table(
        "offline_conflicts",
        sa.Column("public_id", sa.Text(), primary_key=True),
        sa.Column("queue", sa.Text(), primary_key=True),
        sa.Column("sequence", sa.Text(), primary_key=True),
        sa.Column("digest", sa.Text(), primary_key=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("record", JSONB(), nullable=False),
    )
    op.create_table(
        "offline_device_status",
        sa.Column("farm_id", sa.Uuid(), primary_key=True),
        sa.Column("device_id", sa.Uuid(), primary_key=True),
        sa.Column("reported_at", sa.DateTime(timezone=True)),
        sa.Column("report", JSONB()),
        sa.Column("last_replay_at", sa.DateTime(timezone=True)),
    )


def downgrade():
    op.drop_table("offline_device_status")
    op.drop_table("offline_conflicts")
    op.drop_table("offline_records")
    op.drop_table("offline_assignments")
