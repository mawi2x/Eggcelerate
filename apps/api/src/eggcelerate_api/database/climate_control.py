"""Explicit, expiring hardware test requests. Caller locks the farm for writes."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, StrictBool
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

from ..errors import AppError
from .schema import (
    climate_tests,
    devices,
    incubator_runtime,
    incubators,
    modes,
)


class ClimateReport(BaseModel):
    model_config = ConfigDict(extra="forbid")
    halted: StrictBool = True
    resuming: StrictBool = False
    lifecycle: int = Field(default=0, ge=0, le=1)
    phase: int = Field(default=0, ge=0, le=2)
    stop_all: StrictBool = False
    sensor_valid: StrictBool
    running: StrictBool
    mode: int = Field(ge=0, le=2)
    heater: StrictBool
    mist: StrictBool
    upper: StrictBool
    exhaust: StrictBool
    fault: int = Field(ge=0, le=6)
    command_id: str = Field(max_length=36, pattern=r"^([0-9a-f-]{36})?$")
    accepted: StrictBool
    tray_capability: StrictBool = False
    tray_running: StrictBool = False
    tray_position: int = Field(default=0, ge=0, le=3)
    tray_status: int = Field(default=0, ge=0, le=5)
    tray_id: int = Field(default=0, ge=0, le=4294967295)
    tray_highest: int = Field(default=0, ge=0, le=4294967295)
    tray_ack: int = Field(default=0, ge=0, le=4294967295)
    tray_accepted: StrictBool = False


PRESETS = {
    "broiler": (0, (37.5, 37.8, 55.0, 60.0)),
    "duck": (1, (37.4, 37.6, 62.0, 68.0)),
    "quail": (2, (37.5, 37.8, 55.0, 60.0)),
}


async def row_for(session, farm_id, unit_id):
    return (
        (
            await session.execute(
                select(climate_tests).where(
                    climate_tests.c.farm_id == farm_id,
                    climate_tests.c.incubator_id == unit_id,
                )
            )
        )
        .mappings()
        .first()
    )


def pending(row, now):
    return bool(
        row
        and row["request"]
        and row["request"]["status"] == "pending"
        and datetime.fromisoformat(row["request"]["expires_at"]) > now
    )


async def guard_changes(session, farm_id, unit_id=None):
    query = select(climate_tests).where(climate_tests.c.farm_id == farm_id)
    if unit_id:
        query = query.where(climate_tests.c.incubator_id == unit_id)
    for row in (await session.execute(query)).mappings():
        # A missing stop confirmation cannot be interpreted as stopped.
        req = row["request"] or {}
        if (row["report"] or {}).get("running") or req.get("status") in (
            "pending",
            "timed_out",
        ):
            raise AppError(
                "conflict",
                "Stop regulation and wait for device confirmation before changing this configuration.",
            )


async def status(session, farm_id, unit_id):
    exists = await session.scalar(
        select(incubators.c.id).where(
            incubators.c.farm_id == farm_id, incubators.c.public_id == unit_id
        )
    )
    if not exists:
        raise AppError("not_found", "Incubator was not found.")
    row = await row_for(session, farm_id, unit_id)
    now = datetime.now(UTC)
    if not row:
        return {"enabled": True, "fresh": False, "report": None, "request": None}
    req = dict(row["request"]) if row["request"] else None
    if req and req["status"] == "pending" and not pending(row, now):
        req["status"] = "timed_out"
    return {
        "enabled": True,
        "fresh": bool(
            row["reported_at"] and (now - row["reported_at"]).total_seconds() <= 45
        ),
        "report": row["report"],
        "intent": row["intent"],
        "reported_at": row["reported_at"].isoformat() if row["reported_at"] else None,
        "request": req,
    }


async def set_intent(session, farm_id, unit_id, action, *, started_at=None):
    """Called after lifecycle writes, inside their farm-locked transaction."""
    now = datetime.now(UTC)
    assignment = (
        (
            await session.execute(
                select(
                    incubators.c.device_id,
                    modes.c.public_id.label("mode_key"),
                    modes.c.temp_min,
                    modes.c.temp_max,
                    modes.c.humidity_min,
                    modes.c.humidity_max,
                    incubator_runtime.c.preparation_started_at,
                    incubator_runtime.c.cycle_phase,
                )
                .select_from(incubators)
                .join(
                    modes,
                    (modes.c.farm_id == incubators.c.farm_id)
                    & (modes.c.id == incubators.c.mode_id),
                )
                .join(
                    incubator_runtime,
                    (incubator_runtime.c.farm_id == incubators.c.farm_id)
                    & (incubator_runtime.c.incubator_id == incubators.c.public_id),
                )
                .where(
                    incubators.c.farm_id == farm_id, incubators.c.public_id == unit_id
                )
            )
        )
        .mappings()
        .first()
    )
    if not assignment:
        raise AppError("not_found", "Incubator was not found.")
    row = await row_for(session, farm_id, unit_id)
    if not row or row["device_id"] != assignment["device_id"] or not row["report"]:
        raise AppError(
            "rejected",
            "Connect the incubator and wait for its equipment status before continuing.",
        )
    report = row["report"]
    if action != "stop" and report.get("lifecycle", 0) != 1:
        raise AppError(
            "rejected",
            "Upload the preparation/incubation firmware before beginning preparation.",
        )
    if not report.get("stop_all"):
        raise AppError(
            "rejected", "Upload the updated firmware with all-equipment Stop support."
        )
    view = await status(session, farm_id, unit_id)
    mode = PRESETS.get(assignment["mode_key"])
    if action in ("prepare", "incubate"):
        if not mode or any(
            abs(float(assignment[k]) - v) > 0.001
            for k, v in zip(
                ("temp_min", "temp_max", "humidity_min", "humidity_max"),
                mode[1],
                strict=True,
            )
        ):
            raise AppError(
                "rejected",
                "Automatic control currently supports the unchanged Chicken, Duck and Quail presets.",
            )
        if not view["fresh"] or not report["sensor_valid"] or report.get("resuming"):
            raise AppError(
                "offline", "Fresh sensor and controller readings are required."
            )
        if report["fault"]:
            raise AppError(
                "rejected",
                "Resolve and reset the controller fault before resuming regulation.",
            )
    if action == "prepare" and (
        assignment["cycle_phase"] != "ready" or not assignment["preparation_started_at"]
    ):
        raise AppError("rejected", "Begin preparation before starting regulation.")
    if action == "incubate" and assignment["cycle_phase"] not in (
        "incubating",
        "lockdown",
        "hatching",
        "awaiting_finish",
    ):
        raise AppError("rejected", "Confirm the egg count and start incubation first.")
    if action == "reset" and (
        not view["fresh"] or not report["sensor_valid"] or report["running"]
    ):
        raise AppError(
            "rejected", "Reset requires fresh readings and stopped equipment."
        )
    old = row["intent"] or {}
    prep_at = assignment["preparation_started_at"]
    prep_stamp = prep_at.isoformat() if prep_at else old.get("preparation_started_at")
    phase = {"prepare": 1, "incubate": 2}.get(action, 0)
    same = (
        not old.get("suspended")
        and old.get("phase") == phase
        and old.get("mode") == (mode[0] if mode else 0)
    )
    if action == "prepare":
        same = same and old.get("preparation_started_at") == prep_stamp
    if same and (pending(row, now) or (row["request"] or {}).get("status") == "acked"):
        return view
    intent = {
        "suspended": False,
        "phase": phase,
        "mode": mode[0] if mode else 0,
        "generation": old.get("generation") if action == "incubate" else str(uuid4()),
        "preparation_started_at": prep_stamp,
        "changed_at": now.isoformat(),
    }
    req = make_request(row, action, intent["mode"], now)
    await session.execute(
        update(climate_tests)
        .where(
            climate_tests.c.farm_id == farm_id, climate_tests.c.incubator_id == unit_id
        )
        .values(intent=intent, request=req)
    )
    return await status(session, farm_id, unit_id)


def make_request(row, action, mode, now):
    return {
        "id": str(uuid4()),
        "action": action,
        "mode": mode,
        "boot_id": row["boot_id"],
        "status": "pending",
        "requested_at": now.isoformat(),
        "expires_at": (now + timedelta(seconds=90)).isoformat(),
        "order": max(
            int(now.timestamp() * 1000), (row["request"] or {}).get("order", 0) + 1
        ),
    }


async def reconcile(session, farm_id, now):
    """Repair boot/transport interruptions from committed intent, never invent a start."""
    rows = (
        (
            await session.execute(
                select(climate_tests).where(climate_tests.c.farm_id == farm_id)
            )
        )
        .mappings()
        .all()
    )
    for row in rows:
        intent, report, req = (
            row["intent"] or {},
            row["report"] or {},
            row["request"] or {},
        )
        if (
            not intent
            or intent.get("suspended")
            or not row["reported_at"]
            or (now - row["reported_at"]).total_seconds() > 45
        ):
            continue
        if pending(row, now):
            continue
        phase = intent.get("phase", 0)
        if phase and (
            report.get("fault")
            or not report.get("sensor_valid")
            or report.get("resuming")
            or report.get("lifecycle") != 1
        ):
            continue
        actual = report.get("phase", 0) if report.get("running") else 0
        if (
            actual == phase
            and (not phase or report.get("mode") == intent["mode"])
            and req.get("boot_id") == row["boot_id"]
            and req.get("status") == "acked"
        ):
            continue
        if req.get("status") == "rejected" and req.get("boot_id") == row["boot_id"]:
            continue
        if (
            req.get("requested_at")
            and (now - datetime.fromisoformat(req["requested_at"])).total_seconds() < 10
        ):
            continue
        action = {0: "stop", 1: "prepare", 2: "incubate"}[phase]
        await session.execute(
            update(climate_tests)
            .where(
                climate_tests.c.farm_id == farm_id,
                climate_tests.c.incubator_id == row["incubator_id"],
            )
            .values(request=make_request(row, action, intent["mode"], now))
        )


async def record_report(
    session, farm_id, unit_id, device_id, boot_id, booted_at, seq, report, now
):
    # Own ordering also covers status-only reports during sensor failure.
    row = await row_for(session, farm_id, unit_id)
    if row and row["device_id"] == device_id:
        if boot_id == row["boot_id"]:
            if booted_at != row["booted_at"] or seq <= row["seq"]:
                return
        elif booted_at <= row["booted_at"]:
            return
    req = dict(row["request"]) if row and row["request"] else None
    if req and req["status"] == "pending":
        if req["boot_id"] != boot_id:
            req["status"] = "rejected"
        elif req["id"] == report.command_id:
            all_off = not any(
                (
                    report.running,
                    report.heater,
                    report.mist,
                    report.upper,
                    report.exhaust,
                    report.tray_running,
                )
            )
            expected_phase = {"prepare": 1, "incubate": 2}.get(req["action"], 0)
            confirmed = (
                all_off
                if req["action"] == "stop"
                else (
                    report.running
                    and report.phase == expected_phase
                    and report.mode == req["mode"]
                    if req["action"] in ("prepare", "incubate")
                    else not report.running and not report.fault
                )
            )
            req["status"] = "acked" if report.accepted and confirmed else "rejected"
            if req["status"] == "acked":
                req["accepted_at"] = now.isoformat()
        elif datetime.fromisoformat(req["expires_at"]) <= now:
            req["status"] = "timed_out"
    intent = dict(row["intent"]) if row and row["intent"] else None
    if intent and intent.get("phase"):
        waiting_for_start = (
            req
            and req.get("status") == "pending"
            and req.get("action") in ("prepare", "incubate")
            and req.get("boot_id") == boot_id
        )
        if report.fault or (
            report.lifecycle == 1
            and report.halted
            and not report.resuming
            and not waiting_for_start
        ):
            intent["suspended"] = True
    # A later fresh stopped report proves an expired start is no longer running.
    if req and req["status"] == "timed_out" and not report.running:
        req["status"] = "expired"
    values = dict(
        farm_id=farm_id,
        incubator_id=unit_id,
        request=req,
        intent=intent,
        report=report.model_dump(),
        boot_id=boot_id,
        booted_at=booted_at,
        seq=seq,
        device_id=device_id,
        reported_at=now,
    )
    await session.execute(
        insert(climate_tests)
        .values(**values)
        .on_conflict_do_update(
            index_elements=[climate_tests.c.farm_id, climate_tests.c.incubator_id],
            set_={
                k: v for k, v in values.items() if k not in ("farm_id", "incubator_id")
            },
        )
    )


async def command_packets(session, farm_id, now):
    # Boot and latest sequence bind delivery to this device's current connection.
    rows = (
        await session.execute(
            select(
                climate_tests,
                devices.c.public_id.label("device_public_id"),
            )
            .select_from(climate_tests)
            .join(
                incubators,
                (incubators.c.farm_id == climate_tests.c.farm_id)
                & (incubators.c.public_id == climate_tests.c.incubator_id),
            )
            .join(
                devices,
                (devices.c.farm_id == incubators.c.farm_id)
                & (devices.c.id == incubators.c.device_id)
                & (devices.c.id == climate_tests.c.device_id),
            )
            .where(climate_tests.c.farm_id == farm_id)
        )
    ).mappings()
    result = []
    for row in rows:
        if not pending(row, now):
            continue
        req = row["request"]
        if req["boot_id"] != row["boot_id"]:
            continue
        expires = int(datetime.fromisoformat(req["expires_at"]).timestamp())
        body = f"climate|{req['boot_id']}|{row['seq']}|{req['id']}|{req['action']}|{req['mode']}|{expires}|{req['order']}"
        result.append((row["device_public_id"], body))
    return result
