"""Timed hardware tray commands. Caller holds the farm lock for every write."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import insert, select, update

from ..domain import lockdown_day
from ..errors import AppError
from .schema import (
    climate_tests,
    cycles,
    device_commands,
    devices,
    incubator_runtime,
    incubators,
    modes,
)

ACTIONS = {
    "turn": 0,
    "home": 1,
    "confirm_plus": 2,
    "confirm_minus": 3,
    "confirm_level": 4,
    "stop": 5,
    "tilt": 6,
}
ACTIVE = {"pending", "moving"}


async def context(session, farm_id, unit_id):
    row = (
        (
            await session.execute(
                select(
                    climate_tests,
                    incubator_runtime.c.cycle_id,
                    incubator_runtime.c.cycle_phase,
                    incubator_runtime.c.next_turn_at,
                    incubators.c.auto_turn,
                    incubators.c.turn_interval_min,
                    modes.c.incubation_days,
                    cycles.c.started_on,
                    cycles.c.status.label("cycle_status"),
                    devices.c.public_id.label("device_public_id"),
                )
                .select_from(climate_tests)
                .join(
                    incubators,
                    (incubators.c.farm_id == climate_tests.c.farm_id)
                    & (incubators.c.public_id == climate_tests.c.incubator_id),
                )
                .join(
                    incubator_runtime,
                    (incubator_runtime.c.farm_id == incubators.c.farm_id)
                    & (incubator_runtime.c.incubator_id == incubators.c.public_id),
                )
                .join(modes, modes.c.id == incubators.c.mode_id)
                .join(
                    devices,
                    (devices.c.id == incubators.c.device_id)
                    & (devices.c.id == climate_tests.c.device_id),
                )
                .outerjoin(
                    cycles,
                    (cycles.c.farm_id == incubator_runtime.c.farm_id)
                    & (cycles.c.id == incubator_runtime.c.cycle_id),
                )
                .where(
                    climate_tests.c.farm_id == farm_id,
                    climate_tests.c.incubator_id == unit_id,
                )
            )
        )
        .mappings()
        .first()
    )
    if row is None:
        raise AppError("not_found", "Wait for the chamber's controller report.")
    return row


def boundary(row):
    if not row["started_on"]:
        return None
    start = datetime.fromisoformat(row["started_on"]).replace(tzinfo=UTC)
    return start + timedelta(days=lockdown_day(row["incubation_days"]) - 1)


def fresh(row, now):
    r = row["report"] or {}
    return bool(
        row["reported_at"]
        and (now - row["reported_at"]).total_seconds() <= 45
        and r.get("tray_capability")
    )


def normal(row, now):
    end = boundary(row)
    return (
        row["cycle_status"] == "active"
        and row["cycle_phase"] == "incubating"
        and end is not None
        and now < end - timedelta(seconds=120)
    )


async def save(session, row, state):
    await session.execute(
        update(climate_tests)
        .where(
            climate_tests.c.farm_id == row["farm_id"],
            climate_tests.c.incubator_id == row["incubator_id"],
        )
        .values(tray=state)
    )


async def view(session, farm_id, unit_id):
    row = await context(session, farm_id, unit_id)
    return {
        "enabled": True,
        "fresh": fresh(row, datetime.now(UTC)),
        "report": row["report"],
        "state": row["tray"] or {},
        "auto_turn": row["auto_turn"],
        "allow_turn": normal(row, datetime.now(UTC)),
        "interval_minutes": row["turn_interval_min"],
    }


async def queue(session, farm_id, unit_id, action, *, key=None, automatic=False):
    now = datetime.now(UTC)
    row = await context(session, farm_id, unit_id)
    state = dict(row["tray"] or {})
    report = row["report"] or {}
    req = state.get("request") or {}
    if key:
        old = (
            (
                await session.execute(
                    select(device_commands).where(
                        device_commands.c.farm_id == farm_id,
                        device_commands.c.incubator_id == unit_id,
                        device_commands.c.request_key == key,
                    )
                )
            )
            .mappings()
            .first()
        )
        if old and (old["status"] != "pending" or req.get("key") == key):
            return state
    if req.get("status") in ACTIVE and action != "stop":
        raise AppError("conflict", "A tray movement is already pending.")
    if action != "stop" and not fresh(row, now):
        raise AppError("offline", "Wait for a fresh tray-capable controller report.")
    if action != "stop" and (
        (row["intent"] or {}).get("phase") != 2
        or (row["intent"] or {}).get("suspended")
        or report.get("fault")
        or not report.get("sensor_valid")
        or not report.get("running")
        or report.get("phase") != 2
    ):
        raise AppError(
            "rejected", "Tray control requires healthy confirmed incubation."
        )
    if action in {"turn", "tilt"} and not normal(row, now):
        raise AppError("rejected", "Turning is disabled outside normal incubation.")
    if action == "turn" and state.get("suspended"):
        raise AppError(
            "rejected", "Confirm the current tray position to resume turning."
        )
    if action in {"turn", "home"} and (
        report.get("tray_position") not in (1, 2)
        or report.get("tray_status") not in (1, 3)
    ):
        raise AppError("rejected", "Confirm the current side before moving the tray.")
    if action == "tilt" and (
        report.get("tray_position") != 3 or report.get("tray_status") != 3
    ):
        raise AppError("rejected", "Initial tilt requires an observed level start.")
    if action == "home" and row["cycle_status"] != "active":
        raise AppError("rejected", "No active incubation cycle.")
    if action.startswith("confirm_") and report.get("tray_running"):
        raise AppError("conflict", "Stop the tray before confirming position.")
    highest = max(int(state.get("highest", 0)), int(report.get("tray_highest", 0))) + 1
    if highest > 4294967295:
        raise AppError(
            "rejected", "Tray command identity exhausted; contact the operator."
        )
    key = key or f"tray-{uuid4().hex}"
    if action == "turn":
        existing = await session.scalar(
            select(device_commands.c.id).where(
                device_commands.c.farm_id == farm_id,
                device_commands.c.incubator_id == unit_id,
                device_commands.c.request_key == key,
            )
        )
        if existing is None:
            await session.execute(
                insert(device_commands).values(
                    id=uuid4(),
                    farm_id=farm_id,
                    incubator_id=unit_id,
                    device_id=row["device_public_id"],
                    request_key=key,
                    status="pending",
                    requested_at=now,
                    expires_at=now + timedelta(seconds=90),
                    next_attempt_at=now,
                    attempts=0,
                    turn_interval_min=row["turn_interval_min"],
                )
            )
        await session.execute(
            update(device_commands)
            .where(
                device_commands.c.farm_id == farm_id,
                device_commands.c.incubator_id == unit_id,
                device_commands.c.request_key == key,
            )
            .values(
                expires_at=now + timedelta(seconds=90),
                dispatch_boot_id=row["boot_id"],
                dispatch_booted_at=row["booted_at"],
                dispatch_seq=row["seq"],
            )
        )
    elif (
        action == "stop" and req.get("action") == "turn" and req.get("status") in ACTIVE
    ):
        await command_result(session, row, req, "rejected", now, "tray_stopped")
    state.update(
        highest=highest,
        cycle_id=row["cycle_id"],
        request={
            "id": highest,
            "key": key,
            "action": action,
            "from": report.get("tray_position", 0),
            "boot_id": row["boot_id"],
            "status": "pending",
            "automatic": automatic,
            "expires_at": (now + timedelta(seconds=90)).isoformat(),
            "requested_at": now.isoformat(),
        },
    )
    if action == "stop":
        state["suspended"] = True
    if action == "home":
        state.update(home_status="return_requested", home_confirmed=False)
    await save(session, row, state)
    return state


async def command_result(session, row, req, status, now, error=None):
    if req.get("action") != "turn":
        return
    values = dict(status=status, error_code=error, ack_received_at=now)
    if status == "acked":
        values["executed_at"] = now
    await session.execute(
        update(device_commands)
        .where(
            device_commands.c.farm_id == row["farm_id"],
            device_commands.c.incubator_id == row["incubator_id"],
            device_commands.c.request_key == req["key"],
        )
        .values(**values)
    )


async def reconcile_one(session, farm_id, unit_id, now):
    row = await context(session, farm_id, unit_id)
    state = dict(row["tray"] or {})
    report = row["report"] or {}
    req = dict(state.get("request") or {})
    if req.get("status") in ACTIVE:
        result = None
        if req["boot_id"] != row["boot_id"]:
            result = "interrupted"
        elif report.get("tray_ack") == req["id"]:
            if not report.get("tray_accepted"):
                result = "rejected"
            elif report.get("tray_running"):
                req["status"] = "moving"
                await command_result(session, row, req, "dispatched", now)
            elif req["action"] in {"turn", "home", "tilt"}:
                result = (
                    "completed"
                    if report.get("tray_status") == 3
                    and report.get("tray_id") == req["id"]
                    else "interrupted"
                )
            else:
                result = "completed"
        if result is None and datetime.fromisoformat(req["expires_at"]) <= now:
            result = "timed_out"
        if result:
            req["status"] = result
            req["finished_at"] = now.isoformat()
            if result == "completed":
                if req["action"] == "turn":
                    next_at = now + timedelta(minutes=row["turn_interval_min"])
                    state["next_at"] = next_at.isoformat()
                    await session.execute(
                        update(incubator_runtime)
                        .where(
                            incubator_runtime.c.farm_id == farm_id,
                            incubator_runtime.c.incubator_id == unit_id,
                        )
                        .values(last_turned_at=now, next_turn_at=next_at)
                    )
                    await command_result(session, row, req, "acked", now)
                elif req["action"].startswith("confirm_"):
                    state["suspended"] = req[
                        "action"
                    ] == "confirm_level" and not normal(row, now)
                    state["next_at"] = (
                        now + timedelta(minutes=row["turn_interval_min"])
                    ).isoformat()
                    state["home_confirmed"] = req[
                        "action"
                    ] == "confirm_level" and not normal(row, now)
                    if normal(row, now):
                        state["home_status"] = None
                elif req["action"] == "tilt":
                    next_at = now + timedelta(minutes=row["turn_interval_min"])
                    state["next_at"] = next_at.isoformat()
                    await session.execute(
                        update(incubator_runtime)
                        .where(
                            incubator_runtime.c.farm_id == farm_id,
                            incubator_runtime.c.incubator_id == unit_id,
                        )
                        .values(next_turn_at=next_at)
                    )
                elif req["action"] == "home":
                    state["home_status"] = "timed_return_complete_check_level"
                    state["suspended"] = True
            else:
                if req["action"] == "home":
                    state["home_status"] = "return_failed_position_unknown"
                state["suspended"] = True
                state["home_confirmed"] = False
                await command_result(
                    session,
                    row,
                    req,
                    "timed_out" if result == "timed_out" else "rejected",
                    now,
                    f"tray_{result}",
                )
        state["request"] = req
        await save(session, row, state)
    if state.get("cycle_id") != row["cycle_id"]:
        state.update(
            cycle_id=row["cycle_id"],
            suspended=True,
            home_confirmed=False,
            home_status=None,
            next_at=row["next_turn_at"].isoformat(),
        )
        await save(session, row, state)
    if state.get("interval") != row["turn_interval_min"]:
        state.update(
            interval=row["turn_interval_min"],
            next_at=(now + timedelta(minutes=row["turn_interval_min"])).isoformat(),
        )
        await save(session, row, state)
    if not fresh(row, now):
        return
    if report.get("tray_status") in (0, 4, 5) or report.get("fault"):
        state.update(suspended=True, home_confirmed=False)
        await save(session, row, state)
    req = state.get("request") or {}
    running = report.get("tray_running") or req.get("status") in ACTIVE
    if (row["intent"] or {}).get("phase") != 2 or (row["intent"] or {}).get(
        "suspended"
    ):
        state["suspended"] = True
        await save(session, row, state)
        if running and req.get("action") != "stop":
            await queue(session, farm_id, unit_id, "stop", automatic=True)
        return
    if row["cycle_status"] != "active":
        if running and req.get("action") != "stop":
            await queue(session, farm_id, unit_id, "stop", automatic=True)
        return
    if (
        not row["auto_turn"]
        and running
        and req.get("automatic")
        and req.get("action") in {"turn", "tilt"}
    ):
        await queue(session, farm_id, unit_id, "stop", automatic=True)
        return
    if req.get("status") in ACTIVE:
        return
    end = boundary(row)
    if end and now >= end:
        if not state.get("home_confirmed") and not state.get("home_status"):
            state.update(
                home_status="missed_prelockdown_return_check_level", suspended=True
            )
            await save(session, row, state)
        return
    if end and now >= end - timedelta(seconds=120):
        if not state.get("home_status") and not state.get("home_confirmed"):
            if state.get("suspended", True):
                state.update(home_status="turning_paused_check_level", suspended=True)
                await save(session, row, state)
                return
            if report.get("tray_position") in (1, 2) and report.get("tray_status") in (
                1,
                3,
            ):
                try:
                    await queue(session, farm_id, unit_id, "home", automatic=True)
                except AppError as exc:
                    if exc.code not in {"offline", "rejected", "conflict"}:
                        raise
                    state.update(
                        home_status="return_unavailable_check_level", suspended=True
                    )
                    await save(session, row, state)
            else:
                state["home_status"] = "position_unknown_confirm_level"
                state["suspended"] = True
                await save(session, row, state)
        return
    if not row["auto_turn"] or not normal(row, now) or state.get("suspended", True):
        return
    if report.get("tray_position") == 3 and not state.get("home_status"):
        try:
            await queue(session, farm_id, unit_id, "tilt", automatic=True)
        except AppError as exc:
            if exc.code not in {"offline", "rejected", "conflict"}:
                raise
        return
    if (
        datetime.fromisoformat(state.get("next_at", row["next_turn_at"].isoformat()))
        <= now
    ):
        # At most one due command; completion schedules from now, skipping backlog.
        try:
            await queue(session, farm_id, unit_id, "turn", automatic=True)
        except AppError as exc:
            if exc.code not in {"offline", "rejected", "conflict"}:
                raise


async def reconcile(session, farm_id, now):
    ids = (
        await session.scalars(
            select(climate_tests.c.incubator_id).where(
                climate_tests.c.farm_id == farm_id
            )
        )
    ).all()
    for unit_id in ids:
        try:
            await reconcile_one(session, farm_id, unit_id, now)
        except AppError as exc:
            # A reassigned chamber may retain the prior device report until the
            # replacement publishes. It is ineligible for commands meanwhile.
            if exc.code != "not_found":
                raise


async def packets(session, farm_id, now):
    rows = (
        (
            await session.execute(
                select(climate_tests, devices.c.public_id.label("device_public_id"))
                .select_from(climate_tests)
                .join(
                    incubators,
                    (incubators.c.farm_id == climate_tests.c.farm_id)
                    & (incubators.c.public_id == climate_tests.c.incubator_id)
                    & (incubators.c.device_id == climate_tests.c.device_id),
                )
                .join(
                    devices,
                    (devices.c.id == climate_tests.c.device_id)
                    & (devices.c.farm_id == climate_tests.c.farm_id),
                )
                .where(climate_tests.c.farm_id == farm_id)
            )
        )
        .mappings()
        .all()
    )
    result = []
    for row in rows:
        req = (row["tray"] or {}).get("request") or {}
        if (
            req.get("status") not in ACTIVE
            or req.get("boot_id") != row["boot_id"]
            or not fresh(row, now)
        ):
            continue
        if datetime.fromisoformat(req["expires_at"]) <= now:
            continue
        expiry = int(datetime.fromisoformat(req["expires_at"]).timestamp())
        result.append(
            (
                row["device_public_id"],
                f"tray|{row['boot_id']}|{row['seq']}|{req['id']}|{ACTIONS[req['action']]}|{req['from']}|{expiry}",
            )
        )
    return result
