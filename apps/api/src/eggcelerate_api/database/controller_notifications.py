"""Controller warnings in the durable notification feed, once per episode."""

from uuid import uuid4, uuid5

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert

from .schema import alerts, benchmark_runs, climate_tests, incubators

FAULTS = {
    1: "Sensor failure",
    2: "Stale sensor readings",
    3: "Overheating",
    4: "Continuous heating safety timeout",
    5: "Controller settings storage failure",
    6: "Controller restarted after a crash",
    7: "Fan PWM output failure",
}


async def evaluate(session, farm_id, now):
    # Caller owns farm lock. Dismissed active entries still suppress duplicates.
    active = (
        (
            await session.execute(
                select(alerts).where(
                    alerts.c.farm_id == farm_id,
                    alerts.c.code.like("controller-%"),
                    alerts.c.condition_state == "active",
                )
            )
        )
        .mappings()
        .all()
    )
    rows = (
        (
            await session.execute(
                select(climate_tests, incubators.c.name)
                .select_from(climate_tests)
                .join(
                    incubators,
                    (incubators.c.farm_id == climate_tests.c.farm_id)
                    & (incubators.c.public_id == climate_tests.c.incubator_id)
                    & (incubators.c.device_id == climate_tests.c.device_id),
                )
                .where(climate_tests.c.farm_id == farm_id)
            )
        )
        .mappings()
        .all()
    )
    position = (
        await session.scalar(
            select(func.coalesce(func.max(alerts.c.position), -1)).where(
                alerts.c.farm_id == farm_id
            )
        )
    ) + 1
    benchmark_rows = (
        (
            await session.execute(
                select(benchmark_runs).where(
                    benchmark_runs.c.farm_id == farm_id,
                    benchmark_runs.c.ended_at.is_(None),
                )
            )
        )
        .mappings()
        .all()
    )
    benchmarks = {row["incubator_id"]: row for row in benchmark_rows}
    seen = set()
    for row in rows:
        unit = row["incubator_id"]
        seen.add(unit)
        report = row["report"] or {}
        if not row["intent"] and report.get("lifecycle") != 1:
            continue
        fresh = bool(
            row["reported_at"] and (now - row["reported_at"]).total_seconds() <= 45
        )
        desired = {}

        def add(code, title, message, severity="warning", signature=None):
            desired[code] = (title, f"{row['name']}: {message}", severity, signature)

        if not fresh:
            add(
                "controller-status-stale",
                "Equipment status unavailable",
                "Equipment reports are delayed. Inspect the chamber and check the device connection. A Stop is not confirmed until the device acknowledges it.",
            )
        else:
            fault = report.get("fault", 0)
            if fault:
                add(
                    f"controller-fault-{fault}",
                    FAULTS.get(fault, "Controller fault"),
                    "Regulation stopped. Stop the cycle, or cancel preparation if eggs have not been loaded, and inspect the chamber. Check the heater, fans and sensor. Resolve the cause before resetting the controller and explicitly resuming regulation.",
                    "critical",
                )
            if report.get("lifecycle") != 1:
                add(
                    "controller-firmware",
                    "Controller update required",
                    "Automatic regulation requires the current main firmware. Upload it before continuing preparation.",
                    signature=row["boot_id"],
                )
            benchmark = benchmarks.get(unit)
            benchmark_report = report.get("benchmark") or {}
            benchmark_authorized = bool(
                benchmark
                and benchmark["device_id"] == row["device_id"]
                and benchmark_report.get("run_id") == str(benchmark["id"])
                and benchmark_report.get("outcome") == 1
            )
            req = row["request"] or {}
            if (
                (row["intent"] or {}).get("phase", 0) == 0
                and not fault
                and not benchmark_authorized
                and req.get("status") != "pending"
                and any(report.get(k) for k in ("running", "heater", "mist"))
            ):
                add(
                    "controller-unexpected-output",
                    "Equipment running outside a cycle",
                    "Request Stop equipment and inspect the chamber. Wait for device acknowledgement before treating the outputs as off.",
                    "critical",
                )

        req = row["request"] or {}
        if req.get("status") in {"timed_out", "expired", "rejected"}:
            add(
                "controller-command",
                "Equipment command not confirmed",
                "The controller rejected the command or did not confirm it in time. Inspect the chamber and connection before continuing. If a cycle is active, stop it and inspect the equipment; an offline Stop cannot be assumed delivered.",
                signature=str(req.get("id")),
            )
        tray = row["tray"] or {}
        tray_req = tray.get("request") or {}
        if tray_req.get("status") in {"rejected", "interrupted", "timed_out"}:
            add(
                "controller-tray-command",
                "Tray movement needs attention",
                "Tray movement was rejected, interrupted or not confirmed. Stop the cycle and inspect the tray mechanism before resuming. Its position is unconfirmed.",
                signature=str(tray_req.get("id")),
            )
        if tray.get("home_status") and not tray.get("home_confirmed"):
            add(
                "controller-tray-level",
                "Check tray level before hatching",
                "Turning is paused. Inspect the chamber and confirm the tray is level in Live Monitor. A completed timer does not prove the tray reached level.",
            )

        existing = {a["code"]: a for a in active if a["incubator_id"] == unit}
        for code, old in list(existing.items()):
            # Loss of reports is not evidence that a hardware fault recovered.
            if not fresh and (
                code.startswith("controller-fault-")
                or code in {"controller-firmware", "controller-unexpected-output"}
            ):
                continue
            candidate = desired.get(code)
            changed = bool(
                candidate
                and candidate[3] is not None
                and old["public_id"]
                != "controller-" + str(uuid5(farm_id, f"{unit}:{code}:{candidate[3]}"))
            )
            if code not in desired or changed:
                await session.execute(
                    update(alerts)
                    .where(
                        alerts.c.farm_id == farm_id,
                        alerts.c.public_id == old["public_id"],
                    )
                    .values(
                        condition_state="resolved",
                        resolved_at=now,
                        resolution_reason="configuration_changed"
                        if changed
                        else "recovered",
                    )
                )
                existing.pop(code)
        for code, (title, message, severity, signature) in desired.items():
            if code in existing:
                continue
            public_id = "controller-" + str(
                uuid5(farm_id, f"{unit}:{code}:{signature}")
                if signature is not None
                else uuid4()
            )
            await session.execute(
                insert(alerts)
                .values(
                    farm_id=farm_id,
                    public_id=public_id,
                    position=position,
                    incubator_id=unit,
                    device_id=row["device_id"],
                    unit_name=row["name"],
                    severity=severity,
                    code=code,
                    title=title,
                    message=message,
                    occurred_at=now,
                    condition_state="active",
                    dismissed=False,
                )
                .on_conflict_do_nothing(
                    index_elements=[alerts.c.farm_id, alerts.c.public_id]
                )
            )
            position += 1
    for old in active:
        if old["incubator_id"] not in seen:
            await session.execute(
                update(alerts)
                .where(
                    alerts.c.farm_id == farm_id, alerts.c.public_id == old["public_id"]
                )
                .values(
                    condition_state="resolved",
                    resolved_at=now,
                    resolution_reason="monitoring_ended",
                )
            )
