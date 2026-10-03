# M2 fetch-notification checkpoint — 2026-10-03

Status: **requested notification batch delivered locally; M2 remains in progress**.
Later update: the remaining M2 work is complete locally; see the
[M2 handoff](m2-handoff-2026-10-03.md). The evidence below preserves this earlier
notification-only checkpoint.

Revision: `experiment` at `cc188ea` plus the uncommitted M0/M1/M2 working tree.

## Behavior

Fetch failures appear in the notification bell, unread counts, and full feed.
The dashboard groups failed farm queries into one notification per continuous
outage and identifies the affected data: status, modes, alerts, history, readings,
settings, or turn status. Initial farm-load failure also exposes the bell and
notification feed, with a Try again action and toast host.

The first exhausted query failure shows one five-second warning toast. Automatic
retries that succeed remain quiet. Further polling/retry failures update the same
notification, including additional affected datasets, without more toasts. After
recovery, the same entry changes to “Data updates restored”; no recovery toast.
A new outage can create a new entry, but its toast has a 60-second cooldown to
avoid repeated interruptions during a flapping connection.

Notifications can be marked read, dismissed, or cleared with the existing controls.
Dismissing an active outage keeps it hidden through subsequent failed retries.
Only successful network query completion resolves a tracked failure; optimistic
cache writes do not claim recovery. Unrelated queries and unauthorized responses
are excluded; authentication handles session expiry separately.

These are local browser notifications, retained in memory for the current signed-in
app session, limited to 20 episodes. They reset on logout/account change or reload.
They are never persisted as device alerts or sent to backend alert mutation APIs.
Existing durable device-alert actions retain their own repository behavior.

## Verification

- Seven new tests cover multi-query grouping, cached-data preservation, repeat
  suppression, partial/full recovery, cooldown recurrence, read/clear/dismiss,
  logout, unauthorized/unrelated errors, cache-write semantics, bounded history,
  quiet successful automatic retry, and notification access during initial failure.
- Full frontend coverage run: 260 tests across 35 files; coverage gates passed.
- Biome lint: 181 files passed. Typecheck and production build passed.
- Main chunk: 582.60 kB / 158.13 kB gzip. The existing 500 kB warning remains M5 work.
- Firefox: injected a local in-memory repository failure while loaded dashboard
  data remained visible. Twelve failed request attempts remained one feed entry.
  The bell at 393 px and full feed at 320 px were inspected; document width stayed
  320 px. Restoring fetching and selecting Retry updated the same entry to restored.
- Local screenshots: `output/playwright/m2-2026-10-03/fetch-error-393.png`,
  `fetch-feed-320.png`, and `fetch-recovered-320.png`.

The injected failure was browser-only, removed after verification; no fault code
was added to the app. Temporary dev server/browser were stopped. No API/schema,
deployment, hardware, or live farm-data changes were made.

## Remaining M2 work

Secondary-query failure isolation, feature-level retry/loading states, application
and lazy-route recovery boundaries, periodic alerts/history refresh, complete
stale-data policy, and broader session-expiry/refresh checks remain. This batch
adds notification feedback and preserves existing background cached-data behavior;
it does not close those separate completion gates.
