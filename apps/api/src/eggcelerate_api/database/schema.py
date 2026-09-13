"""Relational metadata for durable dashboard configuration; migrations own DDL."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Computed,
    DateTime,
    Double,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    MetaData,
    Table,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB

metadata = MetaData()
farms = Table(
    "farms",
    metadata,
    Column("id", Uuid, primary_key=True),
    Column("name", Text, nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
)
modes = Table(
    "modes",
    metadata,
    Column("id", Uuid, primary_key=True),
    Column("farm_id", Uuid, ForeignKey("farms.id"), nullable=False),
    Column("public_id", Text, nullable=False),
    Column("position", Integer, nullable=False),
    Column("name", Text, nullable=False),
    Column("built_in", Boolean, nullable=False),
    Column("temp_min", Double, nullable=False),
    Column("temp_max", Double, nullable=False),
    Column("humidity_min", Double, nullable=False),
    Column("humidity_max", Double, nullable=False),
    Column("incubation_days", Integer, nullable=False),
    Column("turn_interval_min", Integer, nullable=False),
    Column("temp_hysteresis_c", Double, nullable=False),
    Column("humidity_hysteresis_pct", Double, nullable=False),
    # Preserve optional public DTO metadata without inventing transport values.
    Column("version", Integer),
    Column("created_at", Text),
    Column("updated_at", Text),
    UniqueConstraint("farm_id", "public_id", name="uq_modes_farm_public_id"),
    UniqueConstraint("farm_id", "id", name="uq_modes_farm_id"),
    CheckConstraint("incubation_days BETWEEN 7 AND 45", name="ck_modes_days"),
    CheckConstraint("turn_interval_min BETWEEN 60 AND 1440", name="ck_modes_interval"),
    CheckConstraint("temp_min < temp_max", name="ck_modes_temp_order"),
    CheckConstraint("humidity_min < humidity_max", name="ck_modes_humidity_order"),
)
mode_idempotency = Table(
    "mode_idempotency",
    metadata,
    Column("farm_id", Uuid, ForeignKey("farms.id"), primary_key=True),
    Column("scope", Text, primary_key=True),
    Column("key", Text, primary_key=True),
    Column("fingerprint", Text, nullable=False),
    Column("response", JSONB, nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
)

devices = Table(
    "devices",
    metadata,
    Column("id", Uuid, primary_key=True),
    Column("farm_id", Uuid, ForeignKey("farms.id"), nullable=False),
    Column("public_id", Text, nullable=False),
    Column("identity_key", Text, Computed("upper(public_id)", persisted=True)),
    Column("paired", Boolean, nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    UniqueConstraint("farm_id", "identity_key", name="uq_devices_farm_identity"),
    UniqueConstraint("farm_id", "id", name="uq_devices_farm_id"),
)
incubators = Table(
    "incubators",
    metadata,
    Column("id", Uuid, primary_key=True),
    Column("farm_id", Uuid, ForeignKey("farms.id"), nullable=False),
    Column("public_id", Text, nullable=False),
    Column("position", Integer, nullable=False),
    Column("name", Text, nullable=False),
    Column("mode_id", Uuid, nullable=False),
    Column("device_id", Uuid, nullable=False),
    Column("turn_interval_min", Integer, nullable=False),
    Column("auto_turn", Boolean, nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    ForeignKeyConstraint(
        ["farm_id", "mode_id"],
        ["modes.farm_id", "modes.id"],
        name="fk_incubators_farm_mode",
    ),
    ForeignKeyConstraint(
        ["farm_id", "device_id"],
        ["devices.farm_id", "devices.id"],
        name="fk_incubators_farm_device",
    ),
    UniqueConstraint("farm_id", "public_id", name="uq_incubators_farm_public_id"),
    UniqueConstraint("farm_id", "device_id", name="uq_incubators_farm_device"),
    CheckConstraint("turn_interval_min >= 1", name="ck_incubators_interval"),
    CheckConstraint("length(trim(name)) > 0", name="ck_incubators_name"),
)
incubator_idempotency = Table(
    "incubator_idempotency",
    metadata,
    Column("farm_id", Uuid, ForeignKey("farms.id"), primary_key=True),
    Column("scope", Text, primary_key=True),
    Column("key", Text, primary_key=True),
    Column("fingerprint", Text, nullable=False),
    Column("response", JSONB, nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
)

farm_preferences = Table(
    "farm_preferences",
    metadata,
    Column("farm_id", Uuid, ForeignKey("farms.id"), primary_key=True),
    Column("farm_name", Text, nullable=False),
    Column("account_holder", Text, nullable=False),
    Column("display_name", Text, nullable=False),
    Column("temperature_unit", Text, nullable=False),
    Column("time_zone", Text, nullable=False),
    Column("notification_enabled", JSONB, nullable=False),
    Column("notification_sms", Boolean, nullable=False),
    Column("notification_email", Boolean, nullable=False),
    Column("notification_phone", Text, nullable=False),
    Column("notification_email_address", Text, nullable=False),
    CheckConstraint("length(trim(farm_name)) > 0", name="ck_preferences_farm_name"),
    CheckConstraint(
        "length(trim(account_holder)) > 0", name="ck_preferences_account_holder"
    ),
    CheckConstraint(
        "temperature_unit IN ('c', 'f')", name="ck_preferences_temperature_unit"
    ),
    CheckConstraint(
        "time_zone IN ('gmt8', 'gmt0', 'est', 'pst')", name="ck_preferences_time_zone"
    ),
    CheckConstraint(
        "jsonb_typeof(notification_enabled) = 'object'",
        name="ck_preferences_notification_enabled",
    ),
)

preferences_idempotency = Table(
    "preferences_idempotency",
    metadata,
    Column("farm_id", Uuid, ForeignKey("farms.id"), primary_key=True),
    Column("scope", Text, primary_key=True),
    Column("key", Text, primary_key=True),
    Column("fingerprint", Text, nullable=False),
    Column("response", JSONB, nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
)
