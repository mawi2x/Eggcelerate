"""Persist farm preferences and atomic save receipts."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "farm_preferences",
        sa.Column("farm_id", sa.Uuid, sa.ForeignKey("farms.id"), primary_key=True),
        sa.Column("farm_name", sa.Text, nullable=False),
        sa.Column("account_holder", sa.Text, nullable=False),
        sa.Column("display_name", sa.Text, nullable=False),
        sa.Column("temperature_unit", sa.Text, nullable=False),
        sa.Column("time_zone", sa.Text, nullable=False),
        sa.Column("notification_enabled", JSONB, nullable=False),
        sa.Column("notification_sms", sa.Boolean, nullable=False),
        sa.Column("notification_email", sa.Boolean, nullable=False),
        sa.Column("notification_phone", sa.Text, nullable=False),
        sa.Column("notification_email_address", sa.Text, nullable=False),
        sa.CheckConstraint(
            "length(trim(farm_name)) > 0", name="ck_preferences_farm_name"
        ),
        sa.CheckConstraint(
            "length(trim(account_holder)) > 0", name="ck_preferences_account_holder"
        ),
        sa.CheckConstraint(
            "temperature_unit IN ('c', 'f')", name="ck_preferences_temperature_unit"
        ),
        sa.CheckConstraint(
            "time_zone IN ('gmt8', 'gmt0', 'est', 'pst')",
            name="ck_preferences_time_zone",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(notification_enabled) = 'object'",
            name="ck_preferences_notification_enabled",
        ),
    )
    op.create_table(
        "preferences_idempotency",
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
    op.drop_table("preferences_idempotency")
    op.drop_table("farm_preferences")
