"""Store resized profile photos in farm preferences.

Revision ID: 0016
Revises: 0015
"""

import sqlalchemy as sa
from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("farm_preferences", sa.Column("profile_photo", sa.Text()))


def downgrade():
    op.drop_column("farm_preferences", "profile_photo")
