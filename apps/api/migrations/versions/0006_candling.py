"""Cycle-owned candling journals, photo references and atomic replay."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "candling_entries",
        sa.Column("farm_id", sa.Uuid, primary_key=True),
        sa.Column("cycle_id", sa.Text, primary_key=True),
        sa.Column("public_id", sa.Text, primary_key=True),
        sa.Column("day", sa.Integer, nullable=False),
        sa.Column("label", sa.Text, nullable=False),
        sa.Column("observed_on", sa.Text, nullable=False),
        sa.Column("fertile_eggs", sa.Integer, nullable=False),
        sa.Column("clear_eggs", sa.Integer, nullable=False),
        sa.Column("uncertain_eggs", sa.Integer, nullable=False),
        sa.Column("developing_eggs", sa.Integer),
        sa.Column("stopped_developing_eggs", sa.Integer),
        sa.Column("note", sa.Text, nullable=False),
        sa.Column("checks", JSONB, nullable=False),
        sa.Column("checkpoint_type", sa.Text, nullable=False),
        sa.Column("deleted", sa.Boolean, nullable=False, server_default="false"),
        sa.ForeignKeyConstraint(
            ["farm_id", "cycle_id"],
            ["cycles.farm_id", "cycles.id"],
            name="fk_candling_cycle",
        ),
        sa.UniqueConstraint("farm_id", "cycle_id", "day", name="uq_candling_cycle_day"),
        sa.CheckConstraint(
            "day > 0 AND fertile_eggs >= 0 AND clear_eggs >= 0 AND uncertain_eggs >= 0 AND (developing_eggs IS NULL OR developing_eggs >= 0) AND (stopped_developing_eggs IS NULL OR stopped_developing_eggs >= 0)",
            name="ck_candling_counts",
        ),
        sa.CheckConstraint(
            "checkpoint_type IN ('first', 'later')", name="ck_candling_checkpoint"
        ),
        sa.CheckConstraint("jsonb_typeof(checks) = 'array'", name="ck_candling_checks"),
    )
    op.create_table(
        "candling_photos",
        sa.Column("farm_id", sa.Uuid, primary_key=True),
        sa.Column("cycle_id", sa.Text, primary_key=True),
        sa.Column("entry_id", sa.Text, primary_key=True),
        sa.Column("position", sa.Integer, primary_key=True),
        sa.Column("photo_key", sa.Text, nullable=False),
        sa.ForeignKeyConstraint(
            ["farm_id", "cycle_id", "entry_id"],
            [
                "candling_entries.farm_id",
                "candling_entries.cycle_id",
                "candling_entries.public_id",
            ],
            name="fk_candling_photo_entry",
        ),
        sa.CheckConstraint(
            "position >= 0 AND length(photo_key) > 0", name="ck_candling_photo"
        ),
    )
    op.create_table(
        "candling_idempotency",
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
    op.drop_table("candling_idempotency")
    op.drop_table("candling_photos")
    op.drop_table("candling_entries")
