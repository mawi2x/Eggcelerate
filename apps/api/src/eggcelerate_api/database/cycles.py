"""Relational lifecycle state; sensor and candling projections remain deferred."""

from dataclasses import asdict
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from .. import domain
from ..errors import AppError
from ..lifecycle import CycleState
from ..models import AbortedCycleDTO, HatchHistoryDTO, IncubatorDTO
from ..store import MemoryStore
from .schema import cycle_history, cycles, incubator_runtime

RUNTIME_FIELDS = (
    "day_of_incubation",
    "total_eggs_loaded",
    "fertile_eggs",
    "cycle_phase",
    "last_turned_at",
    "next_turn_at",
)


def runtime_values(
    farm_id: UUID, unit: IncubatorDTO, cycle_id: str | None
) -> dict[str, Any]:
    return {
        "farm_id": farm_id,
        "incubator_id": unit.id,
        "cycle_id": cycle_id,
        **{key: getattr(unit, key) for key in RUNTIME_FIELDS},
    }


def history_values(
    farm_id: UUID, record: HatchHistoryDTO | AbortedCycleDTO, position: int
) -> dict[str, Any]:
    values = record.model_dump()
    values["public_id"] = values.pop("id")
    return {
        "farm_id": farm_id,
        "kind": "completed" if isinstance(record, HatchHistoryDTO) else "stopped",
        "position": position,
        **values,
    }


async def seed_cycles(session: AsyncSession, farm_id: UUID, state: MemoryStore) -> None:
    # Historical fixture identities and snapshots are immutable; seed never edits them.
    records: list[HatchHistoryDTO | AbortedCycleDTO] = [*state.hatch, *state.aborted]
    for position, record in enumerate(records):
        cycle = state.cycles[record.cycle_id]
        await session.execute(
            pg_insert(cycles)
            .values(farm_id=farm_id, **asdict(cycle))
            .on_conflict_do_nothing(index_elements=[cycles.c.farm_id, cycles.c.id])
        )
        await session.execute(
            pg_insert(cycle_history)
            .values(**history_values(farm_id, record, position))
            .on_conflict_do_nothing(
                index_elements=[cycle_history.c.farm_id, cycle_history.c.cycle_id]
            )
        )
    existing = set(
        (
            await session.scalars(
                select(incubator_runtime.c.incubator_id).where(
                    incubator_runtime.c.farm_id == farm_id
                )
            )
        ).all()
    )
    for unit in state.incubators.values():
        if unit.id in existing:
            continue
        cycle_id = state.current_cycles.get(unit.id)
        if cycle_id:
            await session.execute(
                insert(cycles).values(farm_id=farm_id, **asdict(state.cycles[cycle_id]))
            )
        await session.execute(
            insert(incubator_runtime).values(**runtime_values(farm_id, unit, cycle_id))
        )


async def load_cycles(
    session: AsyncSession,
    farm_id: UUID,
    state: MemoryStore,
    *,
    current_only: bool = False,
) -> None:
    cycle_rows = (
        (
            await session.execute(
                select(cycles).where(
                    cycles.c.farm_id == farm_id,
                    *(
                        [cycles.c.incubator_id.in_(state.incubators)]
                        if current_only
                        else []
                    ),
                )
            )
        )
        .mappings()
        .all()
    )
    state.cycles = {
        row["id"]: CycleState(
            row["id"], row["incubator_id"], row["status"], row["started_on"]
        )
        for row in cycle_rows
    }
    previous_current = state.current_cycles
    state.current_cycles = {}
    runtime_rows = (
        (
            await session.execute(
                select(incubator_runtime).where(
                    incubator_runtime.c.farm_id == farm_id,
                    *(
                        [incubator_runtime.c.incubator_id.in_(state.incubators)]
                        if current_only
                        else []
                    ),
                )
            )
        )
        .mappings()
        .all()
    )
    if {r["incubator_id"] for r in runtime_rows} != set(state.incubators):
        raise AppError("offline", "Development cycle runtime is not initialized.")
    for row in runtime_rows:
        unit_id, cycle_id = row["incubator_id"], row["cycle_id"]
        if cycle_id:
            state.current_cycles[unit_id] = cycle_id
        patch = {key: row[key] for key in RUNTIME_FIELDS}
        # Never attach previous-cycle or bootstrap candling entries to a newer cycle.
        if previous_current.get(unit_id) != cycle_id or row["day_of_incubation"] == 0:
            patch.update(candled_days=[], candling_entries=[])
        unit = state.incubators[unit_id].model_copy(update=patch)
        state.incubators[unit_id] = domain.derive(
            unit, state.modes[unit.mode_id], datetime.now(UTC)
        )
    if not current_only:
        await load_history(session, farm_id, state)


async def load_history(
    session: AsyncSession, farm_id: UUID, state: MemoryStore
) -> None:
    rows = (
        (
            await session.execute(
                select(cycle_history)
                .where(cycle_history.c.farm_id == farm_id)
                .order_by(cycle_history.c.position, cycle_history.c.public_id)
            )
        )
        .mappings()
        .all()
    )
    state.hatch, state.aborted = [], []
    for row in rows:
        values = {
            key: value
            for key, value in row.items()
            if key not in ("farm_id", "position", "kind", "public_id")
            and value is not None
        }
        values["id"] = row["public_id"]
        if row["kind"] == "completed":
            state.hatch.append(HatchHistoryDTO.model_validate(values))
        else:
            state.aborted.append(AbortedCycleDTO.model_validate(values))


async def save_cycles(
    session: AsyncSession,
    farm_id: UUID,
    state: MemoryStore,
    before_cycles: dict[str, CycleState],
    before_runtime: dict[str, dict[str, Any]],
    before_history: set[str],
) -> None:
    # Close old active rows before inserting a replacement, satisfying the partial unique index.
    for cycle in state.cycles.values():
        if cycle.id in before_cycles and cycle != before_cycles[cycle.id]:
            await session.execute(
                update(cycles)
                .where(cycles.c.farm_id == farm_id, cycles.c.id == cycle.id)
                .values(**asdict(cycle))
            )
    for cycle in state.cycles.values():
        if cycle.id not in before_cycles:
            await session.execute(
                insert(cycles).values(farm_id=farm_id, **asdict(cycle))
            )
    for unit in state.incubators.values():
        values = runtime_values(farm_id, unit, state.current_cycles.get(unit.id))
        if unit.id not in before_runtime:
            await session.execute(insert(incubator_runtime).values(**values))
        elif values != before_runtime[unit.id]:
            await session.execute(
                update(incubator_runtime)
                .where(
                    incubator_runtime.c.farm_id == farm_id,
                    incubator_runtime.c.incubator_id == unit.id,
                )
                .values(**values)
            )
    records: list[HatchHistoryDTO | AbortedCycleDTO] = [*state.hatch, *state.aborted]
    for position, record in enumerate(records):
        if record.cycle_id not in before_history:
            await session.execute(
                insert(cycle_history).values(
                    **history_values(farm_id, record, position)
                )
            )
