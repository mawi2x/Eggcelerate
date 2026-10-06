"""Async SQL persistence behind the existing application services.

Other collections remain in memory during this explicitly selected B3 slice.
Configuration, alerts, cycles, terminal history and replay records are relational.
"""

from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager
from copy import copy
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4, uuid5

from fastapi.concurrency import contextmanager_in_threadpool
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from sqlalchemy import delete, func, insert, select, text, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from ..errors import AppError
from ..models import (
    AbortedCycleDTO,
    HatchHistoryDTO,
    IncubatorDTO,
    ModeDTO,
    PreferencesDTO,
    RangeModel,
    TurnAccepted,
)
from ..store import MemoryStore
from .alerts import load_alerts, save_alerts, seed_alerts
from .candling import load_candling, save_candling, seed_candling
from .cycles import load_cycles, runtime_values, save_cycles, seed_cycles
from .incubators import load_incubators, save_incubators, seed_incubators
from .preferences import preference_values, preferences_from_row
from .schema import (
    alert_idempotency,
    alerts,
    candling_idempotency,
    cycle_idempotency,
    device_commands,
    farm_preferences,
    farms,
    incubator_idempotency,
    incubator_runtime,
    incubators,
    mode_idempotency,
    modes,
    preferences_idempotency,
)


def mode_values(farm_id: UUID, mode: ModeDTO, position: int) -> dict[str, Any]:
    return {
        "id": uuid5(farm_id, f"mode:{mode.id}"),
        "farm_id": farm_id,
        "public_id": mode.id,
        "position": position,
        "name": mode.name,
        "built_in": mode.built_in,
        "temp_min": mode.target_temp_c.min,
        "temp_max": mode.target_temp_c.max,
        "humidity_min": mode.target_humidity_pct.min,
        "humidity_max": mode.target_humidity_pct.max,
        "incubation_days": mode.incubation_days,
        "turn_interval_min": mode.default_turn_interval_min,
        "temp_hysteresis_c": mode.temp_hysteresis_c,
        "humidity_hysteresis_pct": mode.humidity_hysteresis_pct,
        "version": mode.version,
        "created_at": mode.created_at,
        "updated_at": mode.updated_at,
    }


def mode_from_row(row: Mapping[str, Any]) -> ModeDTO:
    return ModeDTO(
        id=row["public_id"],
        name=row["name"],
        built_in=row["built_in"],
        target_temp_c=RangeModel(min=row["temp_min"], max=row["temp_max"]),
        target_humidity_pct=RangeModel(
            min=row["humidity_min"], max=row["humidity_max"]
        ),
        incubation_days=row["incubation_days"],
        default_turn_interval_min=row["turn_interval_min"],
        temp_hysteresis_c=row["temp_hysteresis_c"],
        humidity_hysteresis_pct=row["humidity_hysteresis_pct"],
        version=row["version"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


class PostgresStore:
    def __init__(self, url: str, farm_id: str):
        self.farm_id = UUID(farm_id)
        self.engine = create_async_engine(
            url,
            pool_pre_ping=True,
            connect_args={"timeout": 5, "command_timeout": 10},
        )
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)

    def for_farm(self, farm_id: str) -> PostgresStore:
        """Share the engine while binding this request's SQL unit of work to a farm."""
        scoped = copy(self)
        scoped.farm_id = UUID(farm_id)
        return scoped

    async def close(self) -> None:
        await self.engine.dispose()

    async def ready(self, *, require_seeded_farm: bool = True) -> bool:
        async with self.sessions() as session:
            revision = await session.scalar(
                text("SELECT version_num FROM alembic_version")
            )
            extension = await session.scalar(
                text("SELECT extversion FROM pg_extension WHERE extname='timescaledb'")
            )
            if not require_seeded_farm:
                return revision == "0016" and extension is not None
            farm = await session.scalar(
                select(farms.c.id).where(farms.c.id == self.farm_id)
            )
            seeded = await session.scalar(
                select(incubators.c.id)
                .where(incubators.c.farm_id == self.farm_id)
                .limit(1)
            )
            preferences = await session.scalar(
                select(farm_preferences.c.farm_id).where(
                    farm_preferences.c.farm_id == self.farm_id
                )
            )
            alert_seed = await session.scalar(
                select(alerts.c.public_id)
                .where(alerts.c.farm_id == self.farm_id)
                .limit(1)
            )
            runtime_count = await session.scalar(
                select(func.count())
                .select_from(incubator_runtime)
                .where(incubator_runtime.c.farm_id == self.farm_id)
            )
            chamber_count = await session.scalar(
                select(func.count())
                .select_from(incubators)
                .where(incubators.c.farm_id == self.farm_id)
            )
            return (
                runtime_count == chamber_count
                and alert_seed is not None
                and preferences is not None
                and revision == "0016"
                and extension is not None
                and farm is not None
                and seeded is not None
            )

    async def seed(self) -> None:
        """Insert missing deterministic defaults; preserve existing edited rows."""
        async with self.sessions.begin() as session:
            await session.execute(
                pg_insert(farms)
                .values(id=self.farm_id, name="Sunrise Poultry")
                .on_conflict_do_nothing(index_elements=[farms.c.id])
            )
            await session.execute(
                select(farms.c.id).where(farms.c.id == self.farm_id).with_for_update()
            )
            seed = MemoryStore()
            for position, mode in enumerate(seed.modes.values()):
                await session.execute(
                    pg_insert(modes)
                    .values(**mode_values(self.farm_id, mode, position))
                    .on_conflict_do_nothing(constraint="uq_modes_farm_public_id")
                )

            await seed_incubators(session, self.farm_id, seed)
            await seed_alerts(session, self.farm_id, seed)
            previous_modes = seed.modes
            seed.modes = {
                row["public_id"]: mode_from_row(dict(row))
                for row in (
                    await session.execute(
                        select(modes).where(modes.c.farm_id == self.farm_id)
                    )
                ).mappings()
            }
            await load_incubators(session, self.farm_id, seed, previous_modes)
            await seed_cycles(session, self.farm_id, seed)
            await seed_candling(session, self.farm_id, seed)
            await session.execute(
                pg_insert(farm_preferences)
                .values(**preference_values(self.farm_id, seed.preferences))
                .on_conflict_do_nothing(index_elements=[farm_preferences.c.farm_id])
            )

    @asynccontextmanager
    async def transaction(
        self,
        memory: MemoryStore,
        replay: tuple[str, str, str, str] | None = None,
    ) -> AsyncIterator[MemoryStore]:
        try:
            # Database commit occurs before the memory transaction exits. A
            # failed commit therefore restores all in-process mutations too.
            async with (
                contextmanager_in_threadpool(memory.transaction()) as state,
                self.sessions.begin() as session,
            ):
                farm = await session.scalar(
                    select(farms.c.id)
                    .where(farms.c.id == self.farm_id)
                    .with_for_update()
                )
                if farm is None:
                    raise AppError("offline", "Development farm is not seeded.")
                rows = (
                    (
                        await session.execute(
                            select(modes)
                            .where(modes.c.farm_id == self.farm_id)
                            .order_by(modes.c.position, modes.c.public_id)
                        )
                    )
                    .mappings()
                    .all()
                )
                before = {row["public_id"]: mode_from_row(dict(row)) for row in rows}
                previous_modes = state.modes
                state.modes = dict(before)
                incubator_rows = await load_incubators(
                    session, self.farm_id, state, previous_modes
                )
                await load_cycles(session, self.farm_id, state)
                await load_candling(session, self.farm_id, state)
                before_journals = {
                    unit.id: (
                        state.current_cycles.get(unit.id),
                        list(unit.candling_entries),
                    )
                    for unit in state.incubators.values()
                }
                before_cycles = dict(state.cycles)
                before_runtime = {
                    unit.id: runtime_values(
                        self.farm_id, unit, state.current_cycles.get(unit.id)
                    )
                    for unit in state.incubators.values()
                }
                before_history = {r.cycle_id for r in state.hatch} | {
                    r.cycle_id for r in state.aborted
                }
                before_incubators = dict(state.incubators)
                preference_row = (
                    (
                        await session.execute(
                            select(farm_preferences).where(
                                farm_preferences.c.farm_id == self.farm_id
                            )
                        )
                    )
                    .mappings()
                    .first()
                )
                if preference_row is None:
                    raise AppError("offline", "Development preferences are not seeded.")
                state.preferences = preferences_from_row(dict(preference_row))
                before_preferences = state.preferences.model_copy(deep=True)
                await load_alerts(session, self.farm_id, state)
                before_alerts = dict(state.alerts)
                # Never let a process-local durable-operation receipt override the DB.
                state.idempotency = {
                    k: v
                    for k, v in state.idempotency.items()
                    if not k.startswith(
                        (
                            "candling-",
                            "start-",
                            "reset-",
                            "complete-",
                            "stop-",
                            "alert-",
                            "preferences:",
                            "create-mode:",
                            "delete-mode-",
                            "turn-",
                            "patch-mode-",
                            "create-incubator:",
                            "patch-",
                            "reconnect-",
                        )
                    )
                }
                receipt_table = {
                    "candling": candling_idempotency,
                    "candling_delete": candling_idempotency,
                    "cycle": cycle_idempotency,
                    "turn": cycle_idempotency,
                    "mode_delete": mode_idempotency,
                    "complete": cycle_idempotency,
                    "stop": cycle_idempotency,
                    "alerts": alert_idempotency,
                    "incubator": incubator_idempotency,
                    "mode": mode_idempotency,
                    "preferences": preferences_idempotency,
                }[replay[3] if replay else "mode"]
                receipt = None
                if replay:
                    scope, key, fingerprint, kind = replay
                    receipt = (
                        (
                            await session.execute(
                                select(receipt_table).where(
                                    receipt_table.c.farm_id == self.farm_id,
                                    receipt_table.c.scope == scope,
                                    receipt_table.c.key == key,
                                )
                            )
                        )
                        .mappings()
                        .first()
                    )
                    if receipt:
                        if receipt["fingerprint"] != fingerprint:
                            raise AppError(
                                "conflict",
                                "Idempotency key was used with a different request.",
                            )
                        schemas: dict[str, type[BaseModel]] = {
                            "candling": IncubatorDTO,
                            "cycle": IncubatorDTO,
                            "complete": HatchHistoryDTO,
                            "stop": AbortedCycleDTO,
                            "incubator": IncubatorDTO,
                            "mode": ModeDTO,
                            "turn": TurnAccepted,
                            "preferences": PreferencesDTO,
                        }
                        state.idempotency[f"{scope}:{key}"] = (
                            receipt["response"]
                            if kind in ("alerts", "candling_delete", "mode_delete")
                            else schemas[kind].model_validate(receipt["response"])
                        )
                yield state
                removed = set(before) - set(state.modes)
                if removed:
                    await session.execute(
                        delete(modes).where(
                            modes.c.farm_id == self.farm_id,
                            modes.c.public_id.in_(removed),
                        )
                    )
                positions = {row["public_id"]: row["position"] for row in rows}
                next_position = max(positions.values(), default=-1) + 1
                for public_id, mode in state.modes.items():
                    if before.get(public_id) == mode:
                        continue
                    if public_id in before:
                        await session.execute(
                            update(modes)
                            .where(
                                modes.c.farm_id == self.farm_id,
                                modes.c.public_id == public_id,
                            )
                            .values(
                                **mode_values(self.farm_id, mode, positions[public_id])
                            )
                        )
                    else:
                        await session.execute(
                            insert(modes).values(
                                **mode_values(self.farm_id, mode, next_position)
                            )
                        )
                        next_position += 1
                await save_incubators(
                    session, self.farm_id, state, before_incubators, incubator_rows
                )
                await save_cycles(
                    session,
                    self.farm_id,
                    state,
                    before_cycles,
                    before_runtime,
                    before_history,
                )
                await save_candling(session, self.farm_id, state, before_journals)
                await save_alerts(session, self.farm_id, state, before_alerts)
                if state.preferences != before_preferences:
                    await session.execute(
                        update(farm_preferences)
                        .where(farm_preferences.c.farm_id == self.farm_id)
                        .values(**preference_values(self.farm_id, state.preferences))
                    )
                if replay and not receipt:
                    scope, key, fingerprint, kind = replay
                    result = state.idempotency.get(f"{scope}:{key}")
                    if result is not None:
                        if kind == "turn":
                            unit_id = scope.removeprefix("turn-")
                            unit = state.incubators[unit_id]
                            now = datetime.now(UTC)
                            await session.execute(
                                insert(device_commands).values(
                                    id=uuid4(),
                                    farm_id=self.farm_id,
                                    incubator_id=unit_id,
                                    device_id=unit.device_id,
                                    request_key=key,
                                    status="pending",
                                    requested_at=now,
                                    expires_at=now + timedelta(seconds=60),
                                    next_attempt_at=now,
                                    attempts=0,
                                    turn_interval_min=unit.turn_interval_min,
                                )
                            )
                        await session.execute(
                            insert(receipt_table).values(
                                farm_id=self.farm_id,
                                scope=scope,
                                key=key,
                                fingerprint=fingerprint,
                                response=jsonable_encoder(result),
                            )
                        )
        except IntegrityError as exc:
            raise AppError(
                "conflict", "A database constraint rejected the change."
            ) from exc
        except (SQLAlchemyError, OSError, TimeoutError) as exc:
            raise AppError("offline", "Database is unavailable.") from exc
