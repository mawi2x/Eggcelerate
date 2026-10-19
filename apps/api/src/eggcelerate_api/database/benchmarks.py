"""Equipment run lifecycle. Writes share the farm lock with incubation changes."""

from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import insert, select, update

from ..errors import AppError
from .schema import (
    benchmark_runs,
    climate_tests,
    cycles,
    incubation_runs,
    incubator_runtime,
    incubators,
)

KINDS = {
    "htm": "Highest Temperature Mode (HTM)",
    "ltm": "Lowest Temperature Mode (LTM)",
    "lhm": "Lowest Humidity Mode (LHM)",
}
OUTCOMES = {
    2: "completed",
    3: "cancelled",
    4: "timed_out",
    5: "ceiling_reached",
    6: "faulted",
    7: "restart_interrupted",
    8: "temperature_limited",
}
SETTINGS = {
    "version": 1,
    "ceiling_c": 38.5,
    "limit_ms": 3600000,
    "temperature_c": [37.5, 37.8],
    "lhm_duties": [60, 100],
    "stage_ms": 600000,
    "window_ms": 300000,
}


async def open_run(session, farm_id, unit_id):
    return (
        (
            await session.execute(
                select(benchmark_runs).where(
                    benchmark_runs.c.farm_id == farm_id,
                    benchmark_runs.c.incubator_id == unit_id,
                    benchmark_runs.c.ended_at.is_(None),
                )
            )
        )
        .mappings()
        .first()
    )


async def guard(session, farm_id, unit_id):
    if await open_run(session, farm_id, unit_id):
        raise AppError(
            "conflict", "Stop the benchmark and wait for device confirmation first."
        )


async def start(session, farm_id, unit_id, kind, conditions):
    from .climate_control import make_request, pending, row_for, status

    unit = (
        (
            await session.execute(
                select(incubators).where(
                    incubators.c.farm_id == farm_id, incubators.c.public_id == unit_id
                )
            )
        )
        .mappings()
        .first()
    )
    if not unit:
        raise AppError("not_found", "Incubator was not found.")
    await guard(session, farm_id, unit_id)
    runtime = (
        (
            await session.execute(
                select(incubator_runtime).where(
                    incubator_runtime.c.farm_id == farm_id,
                    incubator_runtime.c.incubator_id == unit_id,
                )
            )
        )
        .mappings()
        .first()
    )
    active_cycle = await session.scalar(
        select(incubation_runs.c.id).where(
            incubation_runs.c.farm_id == farm_id,
            incubation_runs.c.incubator_id == unit_id,
            incubation_runs.c.ended_at.is_(None),
        )
    )
    legacy_active = await session.scalar(
        select(cycles.c.id).where(
            cycles.c.farm_id == farm_id,
            cycles.c.incubator_id == unit_id,
            cycles.c.status == "active",
        )
    )
    if (
        legacy_active
        or not runtime
        or runtime["cycle_phase"] != "ready"
        or runtime["preparation_started_at"]
        or active_cycle
    ):
        raise AppError(
            "conflict",
            "End or cancel preparation and incubation before benchmarking the empty chamber.",
        )
    row = await row_for(session, farm_id, unit_id)
    view = await status(session, farm_id, unit_id)
    report = (row or {}).get("report") or {}
    if not view["fresh"] or not row or row["device_id"] != unit["device_id"]:
        raise AppError("offline", "Wait for fresh controller readings.")
    if report.get("benchmark_capability") != 1:
        raise AppError(
            "rejected", "Install benchmark firmware before selecting this mode."
        )
    if (
        report.get("running")
        or report.get("fault")
        or not report.get("sensor_valid")
        or report.get("resuming")
        or report.get("tray_running")
        or report.get("tray_cancel_return")
        or pending(row, datetime.now(UTC))
    ):
        raise AppError(
            "rejected",
            "Stop regulation, resolve faults, and wait for healthy equipment confirmation first.",
        )
    now = datetime.now(UTC)
    req = make_request(row, kind, 0, now)
    run_id = UUID(req["id"])
    await session.execute(
        insert(benchmark_runs).values(
            id=run_id,
            farm_id=farm_id,
            incubator_id=unit_id,
            device_id=unit["device_id"],
            chamber_name=unit["name"],
            kind=kind,
            status="requested",
            boot_id=row["boot_id"],
            started_at=now,
            conditions=conditions,
            settings=SETTINGS,
        )
    )
    # Never reconcile/restart a benchmark as an incubation intent.
    await session.execute(
        update(climate_tests)
        .where(
            climate_tests.c.farm_id == farm_id, climate_tests.c.incubator_id == unit_id
        )
        .values(
            intent={
                "phase": 0,
                "mode": 0,
                "suspended": True,
                "benchmark_run_id": str(run_id),
            },
            request=req,
        )
    )
    return dict(
        (
            await session.execute(
                select(benchmark_runs).where(benchmark_runs.c.id == run_id)
            )
        )
        .mappings()
        .one()
    )


async def stop(session, farm_id, unit_id):
    from .climate_control import make_request, row_for

    run = await open_run(session, farm_id, unit_id)
    if not run:
        return None
    row = await row_for(session, farm_id, unit_id)
    if not row:
        raise AppError("offline", "Controller connection is unavailable.")
    req = make_request(row, "stop", 0, datetime.now(UTC))
    await session.execute(
        update(climate_tests)
        .where(
            climate_tests.c.farm_id == farm_id, climate_tests.c.incubator_id == unit_id
        )
        .values(request=req, intent={"phase": 0, "mode": 0, "suspended": True})
    )
    await session.execute(
        update(benchmark_runs)
        .where(benchmark_runs.c.id == run["id"])
        .values(status="stopping")
    )
    return {"id": str(run["id"]), "status": "stopping"}


async def record(
    session, farm_id, unit_id, device_id, boot_id, report, now, *, booted_at=None
):
    run = await open_run(session, farm_id, unit_id)
    if not run or run["device_id"] != device_id:
        return
    b = report.benchmark
    values = None
    if b and b.run_id == str(run["id"]):
        if b.kind != {"htm": 1, "ltm": 2, "lhm": 3}[run["kind"]]:
            return
        values = {"result": b.model_dump()}
        settings = dict(run.get("settings") or SETTINGS)
        if (
            not settings.get("device_started_at")
            and b.outcome == 1
            and booted_at
            and report.uptime_ms is not None
        ):
            started = booted_at + timedelta(
                milliseconds=report.uptime_ms - b.elapsed_ms
            )
            if (
                run["started_at"] - timedelta(seconds=5)
                <= started
                <= now + timedelta(seconds=5)
            ):
                settings["device_started_at"] = started.isoformat()
                values["settings"] = settings
        ended = now
        if settings.get("device_started_at") and b.outcome in OUTCOMES:
            ended = max(
                run["started_at"],
                min(
                    now,
                    datetime.fromisoformat(settings["device_started_at"])
                    + timedelta(milliseconds=b.elapsed_ms),
                ),
            )
        if b.outcome in OUTCOMES:
            values.update(
                status=OUTCOMES[b.outcome], ended_at=ended, reason=OUTCOMES[b.outcome]
            )
        elif b.outcome == 1 and report.running:
            values["status"] = "stopping" if run["status"] == "stopping" else "running"
    elif boot_id != run["boot_id"]:
        values = {
            "status": "restart_interrupted",
            "ended_at": now,
            "reason": "Device rebooted; no automatic test resume.",
        }
    elif run["status"] == "stopping" and not report.running and not report.tray_running:
        values = {
            "status": "cancelled",
            "ended_at": now,
            "reason": "Stopped on device.",
        }
    elif report.command_id == str(run["id"]) and not report.accepted:
        values = {
            "status": "rejected",
            "ended_at": now,
            "reason": "Device rejected start.",
        }
    if values:
        await session.execute(
            update(benchmark_runs)
            .where(benchmark_runs.c.id == run["id"])
            .values(**values)
        )


async def reconcile(session, farm_id, now):
    # A missing acknowledgement must not be mistaken for a stopped actuator.
    # Keep the open run/lifecycle exclusion until fresh stopped evidence arrives.
    rows = (
        await session.execute(
            select(benchmark_runs).where(
                benchmark_runs.c.farm_id == farm_id, benchmark_runs.c.ended_at.is_(None)
            )
        )
    ).mappings()
    for run in rows:
        if (
            now - run["started_at"] > timedelta(seconds=90)
            and run["status"] == "requested"
        ):
            from .climate_control import row_for

            row = await row_for(session, farm_id, run["incubator_id"])
            if (
                row
                and row["reported_at"]
                and (now - row["reported_at"]).total_seconds() <= 45
                and not row["report"].get("running")
            ):
                req = row["request"] or {}
                if req.get("status") in ("timed_out", "expired", "rejected"):
                    await session.execute(
                        update(benchmark_runs)
                        .where(benchmark_runs.c.id == run["id"])
                        .values(
                            status="rejected",
                            ended_at=now,
                            reason="Start expired without device acknowledgement.",
                        )
                    )
