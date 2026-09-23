# Phase 4 handoff — documentation truth pass

**Status:** complete. Phase 5 (deployment and CI hygiene) is next.

**Commit:** `45ddca3` (`docs: align project guides with current implementation`).

## What changed

- Resolved review decision D-2 by tracking `docs/refine`, including the review, phase
  plan, handoffs and cited evidence, so links work from a fresh clone.
- Updated the architecture, database, API, infrastructure, environment and onboarding
  guides to describe the implementation through migration `0011`.
- Corrected obsolete `MQTT_URL` and database environment examples, documented the
  private anonymous local Mosquitto broker, and made clear that simulator support does
  not qualify physical hardware or production connectivity.
- Repaired dead or ignored-target links and kept the initial review's corrected baseline
  values as historical evidence in the plan.

## Verification

- User-facing guide link check: **57 local links across 19 files**, no dead or ignored
  targets.
- Refinement-document link check: **99 local links across 52 Markdown files**, no dead
  or ignored targets.
- `git diff --check` passed.
- Base Compose and simulator overlay `docker compose config -q` passed.

## Next phase

Phase 5 is deployment and CI hygiene. Its scope is the web live-refresh build switch,
the declared Python version, non-root API image, workflow concurrency, simulator broker
reachability and revision pin, and the narrow scope of the web image's localhost guard.
Follow the exact work items and exit gate in
[`project-review-execution-plan-2026-09-23.md`](project-review-execution-plan-2026-09-23.md#phase-5--deployment-and-ci-hygiene).
