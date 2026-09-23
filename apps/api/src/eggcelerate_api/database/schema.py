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
    Index,
    Integer,
    MetaData,
    PrimaryKeyConstraint,
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
users = Table(
    "users",
    metadata,
    Column("id", Uuid, primary_key=True),
    Column("email", Text, nullable=False, unique=True),
    Column("password_hash", Text, nullable=False),
    Column("display_name", Text, nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    Column("disabled_at", DateTime(timezone=True)),
    CheckConstraint("length(trim(email)) > 0", name="ck_users_email"),
    CheckConstraint("length(trim(display_name)) > 0", name="ck_users_display_name"),
)
farm_memberships = Table(
    "farm_memberships",
    metadata,
    Column("farm_id", Uuid, ForeignKey("farms.id", ondelete="CASCADE")),
    Column("user_id", Uuid, ForeignKey("users.id", ondelete="CASCADE")),
    Column("role", Text, nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    CheckConstraint("role IN ('owner')", name="ck_farm_memberships_role"),
    PrimaryKeyConstraint("farm_id", "user_id", name="uq_farm_memberships_pair"),
)
auth_sessions = Table(
    "auth_sessions",
    metadata,
    Column("session_hash", Text, primary_key=True),
    Column("farm_id", Uuid, nullable=False),
    Column("user_id", Uuid, nullable=False),
    Column("csrf_token", Text, nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("revoked_at", DateTime(timezone=True)),
    ForeignKeyConstraint(
        ["farm_id", "user_id"],
        ["farm_memberships.farm_id", "farm_memberships.user_id"],
        ondelete="CASCADE",
        name="fk_auth_sessions_membership",
    ),
    CheckConstraint("length(session_hash) = 64", name="ck_auth_sessions_hash"),
    CheckConstraint("length(csrf_token) >= 32", name="ck_auth_sessions_csrf_token"),
    CheckConstraint("expires_at > created_at", name="ck_auth_sessions_expiry"),
)
Index(
    "ix_auth_sessions_user_expiry", auth_sessions.c.user_id, auth_sessions.c.expires_at
)
auth_rate_limits = Table(
    "auth_rate_limits",
    metadata,
    Column("bucket_hash", Text, primary_key=True),
    Column("window_started_at", DateTime(timezone=True), nullable=False),
    Column("attempts", Integer, nullable=False),
    CheckConstraint("length(bucket_hash) = 64", name="ck_auth_rate_limit_hash"),
    CheckConstraint("attempts >= 1", name="ck_auth_rate_limit_attempts"),
)
Index("ix_auth_rate_limits_window", auth_rate_limits.c.window_started_at)
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
device_registry = Table(
    "device_registry",
    metadata,
    Column("identity_key", Text, primary_key=True),
    Column("public_id", Text, nullable=False),
    Column("farm_id", Uuid, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False),
    Column(
        "created_at", DateTime(timezone=True), nullable=False, server_default=func.now()
    ),
    Column("disabled_at", DateTime(timezone=True)),
    CheckConstraint(
        "identity_key = upper(public_id)", name="ck_device_registry_identity"
    ),
    CheckConstraint(
        "length(public_id) BETWEEN 1 AND 128", name="ck_device_registry_public_id"
    ),
    UniqueConstraint(
        "farm_id", "identity_key", name="uq_device_registry_farm_identity"
    ),
)
Index("ix_device_registry_farm", device_registry.c.farm_id)
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

alerts = Table(
    "alerts",
    metadata,
    Column("farm_id", Uuid, ForeignKey("farms.id"), primary_key=True),
    Column("public_id", Text, primary_key=True),
    Column("position", Integer, nullable=False),
    Column("incubator_id", Text),
    Column("unit_name", Text),
    Column("severity", Text, nullable=False),
    Column("code", Text, nullable=False),
    Column("title", Text, nullable=False),
    Column("message", Text, nullable=False),
    Column("occurred_at", DateTime(timezone=True), nullable=False),
    Column("acknowledged_at", DateTime(timezone=True)),
    Column("dismissed", Boolean, nullable=False, server_default="false"),
    ForeignKeyConstraint(
        ["farm_id", "incubator_id"],
        ["incubators.farm_id", "incubators.public_id"],
        name="fk_alerts_farm_incubator",
    ),
    CheckConstraint(
        "severity IN ('critical', 'warning', 'info')", name="ck_alerts_severity"
    ),
)

alert_idempotency = Table(
    "alert_idempotency",
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

cycles = Table(
    "cycles",
    metadata,
    Column("farm_id", Uuid, ForeignKey("farms.id"), primary_key=True),
    Column("id", Text, primary_key=True),
    Column("incubator_id", Text, nullable=False),
    Column("status", Text, nullable=False),
    Column("started_on", Text, nullable=False),
    ForeignKeyConstraint(
        ["farm_id", "incubator_id"],
        ["incubators.farm_id", "incubators.public_id"],
        name="fk_cycles_farm_incubator",
    ),
    UniqueConstraint(
        "farm_id", "incubator_id", "id", name="uq_cycles_farm_incubator_id"
    ),
    CheckConstraint(
        "status IN ('active', 'completed', 'stopped', 'reset')", name="ck_cycles_status"
    ),
)
Index(
    "uq_cycles_active_chamber",
    cycles.c.farm_id,
    cycles.c.incubator_id,
    unique=True,
    postgresql_where=cycles.c.status == "active",
)

incubator_runtime = Table(
    "incubator_runtime",
    metadata,
    Column("farm_id", Uuid, ForeignKey("farms.id"), primary_key=True),
    Column("incubator_id", Text, primary_key=True),
    Column("cycle_id", Text),
    Column("day_of_incubation", Integer, nullable=False),
    Column("total_eggs_loaded", Integer),
    Column("fertile_eggs", Integer),
    Column("cycle_phase", Text, nullable=False),
    Column("last_turned_at", DateTime(timezone=True), nullable=False),
    Column("next_turn_at", DateTime(timezone=True), nullable=False),
    ForeignKeyConstraint(
        ["farm_id", "incubator_id"],
        ["incubators.farm_id", "incubators.public_id"],
        name="fk_runtime_farm_incubator",
    ),
    ForeignKeyConstraint(
        ["farm_id", "incubator_id", "cycle_id"],
        ["cycles.farm_id", "cycles.incubator_id", "cycles.id"],
        name="fk_runtime_farm_cycle",
    ),
    CheckConstraint(
        "day_of_incubation >= 0 AND (total_eggs_loaded IS NULL OR total_eggs_loaded >= 0)",
        name="ck_runtime_counts",
    ),
    CheckConstraint(
        "fertile_eggs IS NULL OR (fertile_eggs >= 0 AND fertile_eggs <= total_eggs_loaded)",
        name="ck_runtime_fertile",
    ),
)

cycle_history = Table(
    "cycle_history",
    metadata,
    Column("farm_id", Uuid, ForeignKey("farms.id"), primary_key=True),
    Column("cycle_id", Text, primary_key=True),
    Column("public_id", Text, nullable=False),
    Column("kind", Text, nullable=False),
    Column("incubator_id", Text, nullable=False),
    Column("chamber_name", Text, nullable=False),
    Column("mode_id", Text, nullable=False),
    Column("mode_name", Text, nullable=False),
    Column("started_on", Text),
    Column("ended_on", Text),
    Column("stopped_at", DateTime(timezone=True)),
    Column("day_stopped", Integer),
    Column("total_eggs", Integer, nullable=False),
    Column("fertile_eggs", Integer),
    Column("hatched_eggs", Integer),
    Column("position", Integer, nullable=False),
    ForeignKeyConstraint(
        ["farm_id", "incubator_id", "cycle_id"],
        ["cycles.farm_id", "cycles.incubator_id", "cycles.id"],
        name="fk_history_farm_cycle",
    ),
    UniqueConstraint("farm_id", "public_id", name="uq_history_farm_public_id"),
    CheckConstraint(
        "total_eggs >= 0 AND (fertile_eggs IS NULL OR (fertile_eggs >= 0 AND fertile_eggs <= total_eggs))",
        name="ck_history_counts",
    ),
    CheckConstraint(
        "(kind = 'completed' AND started_on IS NOT NULL AND ended_on IS NOT NULL AND hatched_eggs IS NOT NULL AND hatched_eggs >= 0 AND hatched_eggs <= coalesce(fertile_eggs, total_eggs) AND stopped_at IS NULL AND day_stopped IS NULL) OR (kind = 'stopped' AND stopped_at IS NOT NULL AND day_stopped IS NOT NULL AND day_stopped >= 0 AND hatched_eggs IS NULL AND started_on IS NULL AND ended_on IS NULL)",
        name="ck_history_outcome",
    ),
)

cycle_idempotency = Table(
    "cycle_idempotency",
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

candling_entries = Table(
    "candling_entries",
    metadata,
    Column("farm_id", Uuid, primary_key=True),
    Column("cycle_id", Text, primary_key=True),
    Column("public_id", Text, primary_key=True),
    Column("day", Integer, nullable=False),
    Column("label", Text, nullable=False),
    Column("observed_on", Text, nullable=False),
    Column("fertile_eggs", Integer, nullable=False),
    Column("clear_eggs", Integer, nullable=False),
    Column("uncertain_eggs", Integer, nullable=False),
    Column("developing_eggs", Integer),
    Column("stopped_developing_eggs", Integer),
    Column("note", Text, nullable=False),
    Column("checks", JSONB, nullable=False),
    Column("checkpoint_type", Text, nullable=False),
    Column("deleted", Boolean, nullable=False, server_default="false"),
    ForeignKeyConstraint(
        ["farm_id", "cycle_id"],
        ["cycles.farm_id", "cycles.id"],
        name="fk_candling_cycle",
    ),
    UniqueConstraint("farm_id", "cycle_id", "day", name="uq_candling_cycle_day"),
    CheckConstraint(
        "day > 0 AND fertile_eggs >= 0 AND clear_eggs >= 0 AND uncertain_eggs >= 0 AND (developing_eggs IS NULL OR developing_eggs >= 0) AND (stopped_developing_eggs IS NULL OR stopped_developing_eggs >= 0)",
        name="ck_candling_counts",
    ),
    CheckConstraint(
        "checkpoint_type IN ('first', 'later')", name="ck_candling_checkpoint"
    ),
    CheckConstraint("jsonb_typeof(checks) = 'array'", name="ck_candling_checks"),
)
candling_photos = Table(
    "candling_photos",
    metadata,
    Column("farm_id", Uuid, primary_key=True),
    Column("cycle_id", Text, primary_key=True),
    Column("entry_id", Text, primary_key=True),
    Column("position", Integer, primary_key=True),
    Column("photo_key", Text, nullable=False),
    ForeignKeyConstraint(
        ["farm_id", "cycle_id", "entry_id"],
        [
            "candling_entries.farm_id",
            "candling_entries.cycle_id",
            "candling_entries.public_id",
        ],
        name="fk_candling_photo_entry",
    ),
    CheckConstraint(
        "position >= 0 AND length(photo_key) > 0", name="ck_candling_photo"
    ),
)
candling_idempotency = Table(
    "candling_idempotency",
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

telemetry_samples = Table(
    "telemetry_samples",
    metadata,
    Column("farm_id", Uuid, primary_key=True),
    Column("device_id", Uuid, primary_key=True),
    Column("observed_at", DateTime(timezone=True), primary_key=True),
    Column("received_at", DateTime(timezone=True), nullable=False),
    Column("temperature_c", Double, nullable=False),
    Column("humidity_pct", Double, nullable=False),
    Column("water_ok", Boolean, nullable=False),
    ForeignKeyConstraint(
        ["farm_id", "device_id"],
        ["devices.farm_id", "devices.id"],
        name="fk_telemetry_device",
    ),
    CheckConstraint(
        "temperature_c > '-Infinity'::float8 AND temperature_c < 'Infinity'::float8",
        name="ck_telemetry_temperature",
    ),
    CheckConstraint(
        "humidity_pct >= 0 AND humidity_pct <= 100", name="ck_telemetry_humidity"
    ),
)

device_telemetry_state = Table(
    "device_telemetry_state",
    metadata,
    Column("farm_id", Uuid, primary_key=True),
    Column("device_id", Uuid, primary_key=True),
    Column("incubator_id", Text, nullable=False),
    Column("boot_id", Text, nullable=False),
    Column("booted_at", DateTime(timezone=True), nullable=False),
    Column("seq", Integer, nullable=False),
    Column("observed_at", DateTime(timezone=True), nullable=False),
    Column("received_at", DateTime(timezone=True), nullable=False),
    Column("last_seen_at", DateTime(timezone=True), nullable=False),
    Column("temperature_c", Double, nullable=False),
    Column("humidity_pct", Double, nullable=False),
    Column("water_ok", Boolean, nullable=False),
    Column("battery_pct", Double, nullable=False),
    Column("power_source", Text, nullable=False),
    ForeignKeyConstraint(
        ["farm_id", "device_id"],
        ["devices.farm_id", "devices.id"],
        name="fk_telemetry_state_device",
    ),
    ForeignKeyConstraint(
        ["farm_id", "incubator_id"],
        ["incubators.farm_id", "incubators.public_id"],
        name="fk_telemetry_state_incubator",
    ),
    UniqueConstraint("farm_id", "incubator_id", name="uq_telemetry_state_incubator"),
    CheckConstraint("seq >= 0", name="ck_telemetry_state_seq"),
    CheckConstraint(
        "humidity_pct >= 0 AND humidity_pct <= 100",
        name="ck_telemetry_state_humidity",
    ),
    CheckConstraint(
        "battery_pct >= 0 AND battery_pct <= 100",
        name="ck_telemetry_state_battery",
    ),
    CheckConstraint(
        "power_source IN ('grid', 'battery')", name="ck_telemetry_state_power"
    ),
)

# Acceptance/replay and dispatch identity are separate: request keys are scoped
# to a farm/chamber; dispatch IDs are globally unique on the MQTT wire.
device_commands = Table(
    "device_commands",
    metadata,
    Column("id", Uuid, primary_key=True),
    Column("farm_id", Uuid, ForeignKey("farms.id"), nullable=False),
    Column("incubator_id", Text, nullable=False),
    Column("device_id", Text, nullable=False),
    Column("request_key", Text, nullable=False),
    Column("status", Text, nullable=False),
    Column("requested_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True), nullable=False),
    Column("next_attempt_at", DateTime(timezone=True), nullable=False),
    Column("attempts", Integer, nullable=False, server_default="0"),
    Column("turn_interval_min", Integer, nullable=False),
    Column("dispatch_boot_id", Text),
    Column("dispatch_booted_at", DateTime(timezone=True)),
    Column("dispatch_seq", Integer),
    Column("executed_at", DateTime(timezone=True)),
    Column("ack_received_at", DateTime(timezone=True)),
    Column("error_code", Text),
    UniqueConstraint(
        "farm_id", "incubator_id", "request_key", name="uq_device_command_request"
    ),
    ForeignKeyConstraint(
        ["farm_id", "incubator_id"],
        ["incubators.farm_id", "incubators.public_id"],
        name="fk_device_command_incubator",
        ondelete="RESTRICT",
    ),
    Index("ix_device_commands_claim", "farm_id", "status", "next_attempt_at"),
    CheckConstraint(
        "status IN ('pending','dispatched','acked','rejected','timed_out')",
        name="ck_device_command_status",
    ),
    CheckConstraint(
        "(dispatch_boot_id IS NULL AND dispatch_booted_at IS NULL AND dispatch_seq IS NULL) "
        "OR (dispatch_boot_id IS NOT NULL AND dispatch_booted_at IS NOT NULL "
        "AND dispatch_seq IS NOT NULL AND dispatch_seq >= 0)",
        name="ck_device_command_dispatch_identity",
    ),
)
