"""Run identity and saved mode targets, separate from live controller state."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import insert, select, update

from ..errors import AppError
from .schema import cycle_history, cycles, incubators, modes
from .schema import incubation_runs as runs


async def synchronize(session, farm_id, state, before_runtime):
    """Called inside the existing farm-locked lifecycle transaction."""
    now = datetime.now(UTC)
    open_rows = (
        (
            await session.execute(
                select(runs)
                .where(runs.c.farm_id == farm_id, runs.c.ended_at.is_(None))
                .with_for_update()
            )
        )
        .mappings()
        .all()
    )
    opened = {r["incubator_id"]: dict(r) for r in open_rows}
    for unit in state.incubators.values():
        row = opened.get(unit.id)
        cycle = state.cycles.get(state.current_cycles.get(unit.id, ""))
        preparing = (
            unit.cycle_phase == "ready" and unit.preparation_started_at is not None
        )
        active = (
            cycle is not None
            and cycle.status == "active"
            and unit.cycle_phase != "ready"
        )
        previous = before_runtime.get(unit.id, {})
        # Re-selecting a mode/restarting preparation starts a separate run even
        # for the same species; it must not rewrite the previous snapshot.
        replaced = (
            preparing
            and row
            and (
                row["status"] != "preparing"
                or row["mode"]["id"] != unit.mode_id
                or unit.preparation_started_at != row["prepared_at"]
            )
        )
        if row and (replaced or (not preparing and not active)):
            status = "cancelled" if row["status"] == "preparing" else "stopped"
            if cycle and cycle.id == row["cycle_id"] and cycle.status == "completed":
                status = "completed"
            reason = (
                "Mode changed or preparation restarted"
                if replaced
                else "Preparation cancelled"
                if status == "cancelled"
                else "Cycle completed"
                if status == "completed"
                else "Cycle stopped"
            )
            await session.execute(
                update(runs)
                .where(runs.c.id == row["id"])
                .values(
                    status=status,
                    ended_at=max(now, row["started_at"]),
                    end_reason=reason,
                )
            )
            row = None
        if row and active and row["status"] == "preparing":
            await session.execute(
                update(runs)
                .where(runs.c.id == row["id"])
                .values(
                    status="incubating",
                    cycle_id=cycle.id,
                    incubation_at=now,
                    total_eggs=unit.total_eggs_loaded,
                )
            )
        elif row and active and row["cycle_id"] != cycle.id:
            raise AppError(
                "conflict", "The chamber run does not match its current cycle."
            )
        elif row is None and (preparing or active):
            device = await session.scalar(
                select(incubators.c.device_id).where(
                    incubators.c.farm_id == farm_id, incubators.c.public_id == unit.id
                )
            )
            if device is None:
                continue
            started = unit.preparation_started_at if preparing else now
            # A pre-existing active cycle without a run has only date precision.
            approximate = bool(active and previous.get("cycle_id") == cycle.id)
            if approximate:
                started = datetime.fromisoformat(cycle.started_on).replace(tzinfo=UTC)
            await session.execute(
                insert(runs).values(
                    id=uuid4(),
                    farm_id=farm_id,
                    incubator_id=unit.id,
                    chamber_name=unit.name,
                    device_id=device,
                    mode=state.modes[unit.mode_id].model_dump(mode="json"),
                    cycle_id=cycle.id if active else None,
                    status="preparing" if preparing else "incubating",
                    started_at=started,
                    prepared_at=unit.preparation_started_at if preparing else None,
                    incubation_at=started if active else None,
                    total_eggs=unit.total_eggs_loaded if active else None,
                    approximate=approximate,
                )
            )


async def selected_scope(session, farm_id, run_id, *, end=None, start=None):
    row = (
        (
            await session.execute(
                select(runs).where(runs.c.farm_id == farm_id, runs.c.id == run_id)
            )
        )
        .mappings()
        .first()
    )
    if row is None:
        raise AppError("not_found", "Incubation run was not found.")
    now = datetime.now(UTC)
    upper = min(end or now, row["ended_at"] or now, now)
    lower = max(start or row["started_at"], row["started_at"])
    # Approximate legacy bounds must not absorb another saved run's period.
    next_start = await session.scalar(
        select(runs.c.started_at)
        .where(
            runs.c.farm_id == farm_id,
            runs.c.incubator_id == row["incubator_id"],
            runs.c.started_at > row["started_at"],
        )
        .order_by(runs.c.started_at)
        .limit(1)
    )
    if next_start:
        upper = min(upper, next_start)
    return {
        "public_id": row["incubator_id"],
        "name": row["chamber_name"],
        "device_id": row["device_id"],
        "start": lower,
        "end": max(lower, upper),
    }


async def import_legacy(session, farm_id):
    """One-time operator import. Older dates/targets are explicitly approximate."""
    from .store import mode_from_row

    existing = (
        (
            await session.execute(
                select(runs.c.cycle_id).where(
                    runs.c.farm_id == farm_id, runs.c.cycle_id.is_not(None)
                )
            )
        )
        .scalars()
        .all()
    )
    rows = (
        (
            await session.execute(
                select(
                    cycles,
                    cycle_history.c.mode_id,
                    cycle_history.c.mode_name,
                    cycle_history.c.chamber_name,
                    cycle_history.c.ended_on,
                    cycle_history.c.stopped_at,
                    cycle_history.c.total_eggs,
                )
                .outerjoin(
                    cycle_history,
                    (cycle_history.c.farm_id == cycles.c.farm_id)
                    & (cycle_history.c.cycle_id == cycles.c.id),
                )
                .where(cycles.c.farm_id == farm_id)
            )
        )
        .mappings()
        .all()
    )
    count = 0
    for row in rows:
        if row["id"] in existing:
            continue
        chamber = (
            (
                await session.execute(
                    select(incubators).where(
                        incubators.c.farm_id == farm_id,
                        incubators.c.public_id == row["incubator_id"],
                    )
                )
            )
            .mappings()
            .first()
        )
        if chamber is None:
            continue
        mode_id = row["mode_id"] or chamber["mode_id"]
        # incubators.mode_id is an internal UUID; historical mode_id is public.
        mode_row = (
            (
                await session.execute(
                    select(modes).where(
                        modes.c.farm_id == farm_id, modes.c.public_id == str(mode_id)
                    )
                )
            )
            .mappings()
            .first()
        )
        if mode_row is None:
            mode_row = (
                (
                    await session.execute(
                        select(modes).where(
                            modes.c.farm_id == farm_id, modes.c.id == chamber["mode_id"]
                        )
                    )
                )
                .mappings()
                .first()
            )
        if mode_row is None:
            continue
        snapshot = mode_from_row(mode_row).model_dump(mode="json")
        if row["mode_name"]:
            snapshot["name"] = row["mode_name"]
        started = datetime.fromisoformat(row["started_on"]).replace(tzinfo=UTC)
        imported_at = datetime.now(UTC)
        if started > imported_at:
            continue
        active = row["status"] == "active"
        ended = (
            None
            if active
            else row["stopped_at"]
            or (
                datetime.fromisoformat(row["ended_on"]).replace(tzinfo=UTC)
                + timedelta(days=1)
                if row["ended_on"]
                else started + timedelta(days=1)
            )
        )
        await session.execute(
            insert(runs).values(
                id=uuid4(),
                farm_id=farm_id,
                incubator_id=row["incubator_id"],
                chamber_name=row["chamber_name"] or chamber["name"],
                device_id=chamber["device_id"],
                mode=snapshot,
                cycle_id=row["id"],
                status="incubating"
                if active
                else "completed"
                if row["status"] == "completed"
                else "stopped",
                started_at=started,
                incubation_at=started,
                ended_at=max(min(ended, imported_at), started) if ended else None,
                total_eggs=row["total_eggs"],
                approximate=True,
                end_reason=None if active else "Imported earlier cycle",
            )
        )
        count += 1
    return count
