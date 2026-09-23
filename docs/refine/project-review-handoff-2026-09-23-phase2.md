# Phase 2 handoff — turn outcome truthfulness

**Status:** complete. Phase 3 (telemetry projection robustness) is next.

**Commits:** API `b4bbc7e` (`fix(commands): preserve executed turn outcomes`); simulator
`2b85e15` (`feat(sim): correlate commands with device boot`).

## What changed

- A shared 60-second device clock tolerance now covers future ACK timestamps and
  telemetry observations. ACK execution timestamps are checked against the command
  deadline; receipt after expiry can still succeed when the recorded execution happened
  before expiry. The worker gives delayed ACKs that tolerance window before timing out an
  unconfirmed command and records the MQTT ingress receipt time.
- Migration `0010` adds the dispatched boot ID, boot time and telemetry sequence to each
  outbox command. The worker waits for a telemetry projection before first dispatch.
  Successful ACKs must echo that boot identity and advance its sequence. A stale boot or
  replayed sequence cannot advance the confirmed turn cursor.
- The MQTT worker uses Paho manual ACKs and a dedicated priority queue for QoS1 ACKs.
  Bounded QoS0 telemetry is shed first when its queue fills; oversized or invalid ACKs
  are counted and logged. Database failures leave ACKs unacknowledged and requeue them.
- The simulator now validates the dispatched boot snapshot, rejects commands for an old
  boot without actuating, and replays persisted outcomes for duplicate command IDs. Its
  examples document that ACKs share the device's per-boot sequence with telemetry.
- PostgreSQL readiness now recognizes schema revision `0010`.

## Verification

- API database suite: **102 passed, 0 skipped**, 4 dependency/Pydantic deprecation
  warnings.
- Shared live HTTP contract: **28/28 passed**.
- Migration verifier: fresh and populated upgrades passed through `0010`.
- Ruff check/format passed, 71 files; mypy passed, 36 API source files.
- Simulator suite: **25 passed**; all MQTT/REST contract examples passed.
- `git diff --check` passed in both repositories.

No physical board or live broker-in-the-loop was available. The committed simulator
exercises the command/ACK shape and durable replay behavior.

## Next phase

Phase 3 fixes telemetry projection ordering after a reboot, limits future-dated boot
identity using the shared tolerance, and makes device reassignment safe. It also adds the
device-command claim index and incubator foreign key. See Phase 3 in
[`project-review-execution-plan-2026-09-23.md`](project-review-execution-plan-2026-09-23.md).

**Tracking:** Phase 4 applied D-2 and added `!docs/refine` to `.gitignore`; this handoff
and the review evidence are now versioned.
