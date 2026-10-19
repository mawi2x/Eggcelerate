import asyncio
from datetime import UTC, datetime
from uuid import UUID

import pytest
from pydantic import ValidationError

from eggcelerate_api.database import benchmarks
from eggcelerate_api.database.climate_control import ClimateReport
from eggcelerate_api.errors import AppError

RUN_ID = "12345678-1234-1234-1234-123456789abc"


def snapshot(**extra):
    result = dict(
        windows=0,
        samples=0,
        mean_t=0,
        mean_rh=0,
        min_t=0,
        max_t=0,
        min_rh=0,
        max_rh=0,
        dew_point=0,
    )
    return dict(
        version=1,
        run_id=RUN_ID,
        kind=1,
        outcome=1,
        stage=0,
        elapsed_ms=5000,
        stage_elapsed_ms=5000,
        invalidated=0,
        samples=2,
        min_t=33,
        max_t=33,
        min_rh=75,
        max_rh=75,
        ceiling_c=38.5,
        limit_ms=3600000,
        results=[result, result, result],
        **extra,
    )


def report(value=None, **extra):
    return ClimateReport.model_validate(
        dict(
            sensor_valid=True,
            running=True,
            mode=0,
            heater=True,
            mist=False,
            upper=True,
            exhaust=False,
            fault=0,
            command_id=RUN_ID,
            accepted=True,
            benchmark=value,
            **extra,
        )
    )


def run():
    return dict(
        started_at=datetime.now(UTC),
        id=UUID(RUN_ID),
        device_id="device",
        boot_id="boot",
        kind="htm",
        status="running",
    )


class Session:
    def __init__(self):
        self.saved = []

    async def execute(self, query):
        self.saved.append(query.compile().params)


def test_old_reports_still_accepted():
    assert report().benchmark is None
    assert report(snapshot()).benchmark.kind == 1


@pytest.mark.parametrize(
    "key,value",
    [
        ("kind", 4),
        ("outcome", 9),
        ("stage", 3),
        ("elapsed_ms", -1),
        ("max_t", float("nan")),
        ("ceiling_c", 40),
        ("limit_ms", 0),
        ("results", []),
    ],
)
def test_invalid_reports_rejected(key, value):
    b = snapshot()
    b[key] = value
    with pytest.raises(ValidationError):
        report(b)


def test_open_benchmark_blocks_other_lifecycle(monkeypatch):
    async def active(*args):
        return run()

    monkeypatch.setattr(benchmarks, "open_run", active)
    with pytest.raises(AppError):
        asyncio.run(benchmarks.guard(None, "farm", "unit"))


@pytest.mark.parametrize("outcome,status", list(benchmarks.OUTCOMES.items()))
def test_device_outcomes_retained(monkeypatch, outcome, status):
    async def active(*args):
        return run()

    monkeypatch.setattr(benchmarks, "open_run", active)
    b = snapshot()
    b["outcome"] = outcome
    session = Session()
    asyncio.run(
        benchmarks.record(
            session, "farm", "unit", "device", "boot", report(b), datetime.now(UTC)
        )
    )
    assert session.saved[-1]["status"] == status
    assert session.saved[-1]["result"]["run_id"] == RUN_ID
    assert session.saved[-1]["ended_at"]


def test_wrong_run_or_kind_cannot_finish_current_run(monkeypatch):
    async def active(*args):
        return run()

    monkeypatch.setattr(benchmarks, "open_run", active)
    session = Session()
    b = snapshot()
    b["kind"] = 2
    b["outcome"] = 2
    asyncio.run(
        benchmarks.record(
            session, "farm", "unit", "device", "boot", report(b), datetime.now(UTC)
        )
    )
    assert not session.saved


def test_restart_without_matching_report_interrupts_run(monkeypatch):
    async def active(*args):
        return run()

    monkeypatch.setattr(benchmarks, "open_run", active)
    session = Session()
    asyncio.run(
        benchmarks.record(
            session, "farm", "unit", "device", "new-boot", report(), datetime.now(UTC)
        )
    )
    assert session.saved[-1]["status"] == "restart_interrupted"


def test_out_of_order_running_report_keeps_stop_pending(monkeypatch):
    async def active(*args):
        return dict(run(), status="stopping")

    monkeypatch.setattr(benchmarks, "open_run", active)
    session = Session()
    asyncio.run(
        benchmarks.record(
            session,
            "farm",
            "unit",
            "device",
            "boot",
            report(snapshot()),
            datetime.now(UTC),
        )
    )
    assert session.saved[-1]["status"] == "stopping"
    assert "ended_at" not in session.saved[-1]
