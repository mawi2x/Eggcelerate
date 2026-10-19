import asyncio
from datetime import UTC, datetime, timedelta

from eggcelerate_api.database import tray_control
from eggcelerate_api.database.climate_control import ClimateReport


def row():
    now = datetime.now(UTC)
    return dict(report=dict(tray_capability=True, tray_cancel_return_capability=True,
                            tray_cancel_return=False, tray_running=False,
                            tray_status=3, tray_position=1, running=False, fault=0, command_id="cancel-id", accepted=True),
                reported_at=now, boot_id="boot", cycle_id="cycle", cycle_status="stopped",
                cycle_phase="stopped_early", next_turn_at=now+timedelta(hours=4),
                turn_interval_min=240, auto_turn=True, intent=dict(phase=0), request=dict(action="cancel", id="cancel-id", status="acked"),
                tray=dict(cycle_id="cycle", interval=240, suspended=True,
                          home_status="cancel_return_requested"))


def setup(monkeypatch, current):
    saved = []
    calls = []

    async def context(*args):
        return current

    async def save(session, source, value):
        current["tray"] = dict(value)
        saved.append(dict(value))

    async def queue(*args, **kwargs):
        calls.append(args[3])

    monkeypatch.setattr(tray_control, "context", context)
    monkeypatch.setattr(tray_control, "save", save)
    monkeypatch.setattr(tray_control, "queue", queue)
    return saved, calls


def test_cancel_suspends_old_request_and_preserves_capability_gate(monkeypatch):
    r = row()
    r["tray"]["request"] = dict(action="turn", status="pending", id=1, key="key")
    setup(monkeypatch, r)
    results = []

    async def result(*args):
        results.append(args[3])

    monkeypatch.setattr(tray_control, "command_result", result)
    assert asyncio.run(tray_control.cancel_for_cycle(None, "farm", "unit"))
    assert r["tray"]["suspended"]
    assert r["tray"]["request"]["status"] == "interrupted"
    assert results == ["rejected"]
    r["report"]["tray_cancel_return_capability"] = False
    assert not asyncio.run(tray_control.cancel_for_cycle(None, "farm", "unit"))
    assert r["tray"]["home_status"] == "cancel_check_level"


def test_worker_does_not_interrupt_authorized_cancel_return(monkeypatch):
    r = row()
    r["report"].update(tray_cancel_return=True, tray_running=True)
    _, calls = setup(monkeypatch, r)
    asyncio.run(tray_control.reconcile_one(None, "farm", "unit", datetime.now(UTC)))
    assert calls == []


def test_timed_level_is_not_reported_as_confirmed(monkeypatch):
    r = row()
    r["report"].update(tray_position=3, tray_running=False)
    setup(monkeypatch, r)
    asyncio.run(tray_control.reconcile_one(None, "farm", "unit", datetime.now(UTC)))
    assert r["tray"]["home_status"] == "cancel_return_complete_check_level"
    assert not r["tray"].get("home_confirmed", False)


def test_interrupted_unknown_position_requests_visual_check(monkeypatch):
    r = row()
    r["report"].update(tray_position=0, tray_status=4)
    setup(monkeypatch, r)
    asyncio.run(tray_control.reconcile_one(None, "farm", "unit", datetime.now(UTC)))
    assert r["tray"]["home_status"] == "cancel_check_level"
    assert r["tray"]["suspended"]


def test_cancel_return_report_fields_are_backward_compatible():
    old = dict(sensor_valid=True, running=False, mode=0, heater=False, mist=False,
               upper=False, exhaust=False, fault=0, command_id="", accepted=False)
    assert not ClimateReport.model_validate(old).tray_cancel_return_capability
    value = ClimateReport.model_validate(dict(old, tray_cancel_return_capability=True,
                                           tray_cancel_return=True, tray_running=True))
    assert value.tray_cancel_return


def test_old_stopped_report_cannot_finish_new_cancel_request(monkeypatch):
    r = row()
    r["report"]["command_id"] = "old-stop"
    r["request"]["status"] = "pending"
    setup(monkeypatch, r)
    asyncio.run(tray_control.reconcile_one(None, "farm", "unit", datetime.now(UTC)))
    assert r["tray"]["home_status"] == "cancel_return_requested"
