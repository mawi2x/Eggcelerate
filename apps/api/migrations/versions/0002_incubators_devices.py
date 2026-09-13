"""Durable chamber configuration and device assignments; cycles remain deferred."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_unique_constraint("uq_modes_farm_id", "modes", ["farm_id", "id"])
    op.create_table(
        "devices",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("farm_id", sa.Uuid(), sa.ForeignKey("farms.id"), nullable=False),
        sa.Column("public_id", sa.Text(), nullable=False),
        sa.Column(
            "identity_key", sa.Text(), sa.Computed("upper(public_id)", persisted=True)
        ),
        sa.Column("paired", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("farm_id", "identity_key", name="uq_devices_farm_identity"),
        sa.UniqueConstraint("farm_id", "id", name="uq_devices_farm_id"),
    )
    op.create_table(
        "incubators",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("farm_id", sa.Uuid(), sa.ForeignKey("farms.id"), nullable=False),
        sa.Column("public_id", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("mode_id", sa.Uuid(), nullable=False),
        sa.Column("device_id", sa.Uuid(), nullable=False),
        sa.Column("turn_interval_min", sa.Integer(), nullable=False),
        sa.Column("auto_turn", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["farm_id", "mode_id"],
            ["modes.farm_id", "modes.id"],
            name="fk_incubators_farm_mode",
        ),
        sa.ForeignKeyConstraint(
            ["farm_id", "device_id"],
            ["devices.farm_id", "devices.id"],
            name="fk_incubators_farm_device",
        ),
        sa.UniqueConstraint(
            "farm_id", "public_id", name="uq_incubators_farm_public_id"
        ),
        sa.UniqueConstraint("farm_id", "device_id", name="uq_incubators_farm_device"),
        sa.CheckConstraint("turn_interval_min >= 1", name="ck_incubators_interval"),
        sa.CheckConstraint("length(trim(name)) > 0", name="ck_incubators_name"),
    )
    op.create_table(
        "incubator_idempotency",
        sa.Column("farm_id", sa.Uuid(), sa.ForeignKey("farms.id"), primary_key=True),
        sa.Column("scope", sa.Text(), primary_key=True),
        sa.Column("key", sa.Text(), primary_key=True),
        sa.Column("fingerprint", sa.Text(), nullable=False),
        sa.Column("response", postgresql.JSONB(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade():
    op.drop_table("incubator_idempotency")
    op.drop_table("incubators")
    op.drop_table("devices")
    op.drop_constraint("uq_modes_farm_id", "modes", type_="unique")
