"""Store commissioned fixed pairing code digests.

Revision ID: 0017
Revises: 0016
"""

import sqlalchemy as sa
from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("device_registry", sa.Column("pairing_code_hash", sa.Text()))
    op.create_unique_constraint(
        "uq_device_registry_pairing_code", "device_registry", ["pairing_code_hash"]
    )


def downgrade():
    op.drop_constraint(
        "uq_device_registry_pairing_code", "device_registry", type_="unique"
    )
    op.drop_column("device_registry", "pairing_code_hash")
