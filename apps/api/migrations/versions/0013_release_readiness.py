"""Add login throttling and operator-provisioned global device routing.

Revision ID: 0013
Revises: 0012
"""

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "auth_rate_limits",
        sa.Column("bucket_hash", sa.Text(), nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.CheckConstraint("length(bucket_hash) = 64", name="ck_auth_rate_limit_hash"),
        sa.CheckConstraint("attempts >= 1", name="ck_auth_rate_limit_attempts"),
        sa.PrimaryKeyConstraint("bucket_hash"),
    )
    op.create_table(
        "device_registry",
        sa.Column("identity_key", sa.Text(), nullable=False),
        sa.Column("public_id", sa.Text(), nullable=False),
        sa.Column("farm_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "identity_key = upper(public_id)", name="ck_device_registry_identity"
        ),
        sa.CheckConstraint(
            "length(public_id) BETWEEN 1 AND 128", name="ck_device_registry_public_id"
        ),
        sa.ForeignKeyConstraint(["farm_id"], ["farms.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("identity_key"),
        sa.UniqueConstraint(
            "farm_id", "identity_key", name="uq_device_registry_farm_identity"
        ),
    )
    op.create_index("ix_device_registry_farm", "device_registry", ["farm_id"])


def downgrade():
    op.drop_index("ix_device_registry_farm", table_name="device_registry")
    op.drop_table("device_registry")
    op.drop_table("auth_rate_limits")
