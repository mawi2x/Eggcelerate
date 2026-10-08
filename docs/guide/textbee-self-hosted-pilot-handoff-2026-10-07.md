# EGGCELERATE — self-hosted TextBee SMS pilot handoff

Date: 2026-10-07
Status: approved to explore; setup and integration have not been performed.

## Objective and authorization

The user wants to try self-hosted TextBee for real SMS notifications from
EGGCELERATE. This handoff prepares that experiment. The current request authorizes
writing this note; it does not deploy services or send messages. When asked to
execute the pilot, obtain the missing server/phone details and an explicitly
designated test recipient before sending a real SMS.

Success is one EGGCELERATE test notification received on the designated phone,
followed by measured resource usage and recovery checks. Production alert
delivery remains a later qualification decision.

## Existing system and proposed architecture

EGGCELERATE uses React/TypeScript, FastAPI/Python, PostgreSQL/TimescaleDB, Docker
Compose and Nginx. Azure VPS hosting is selected, but this note does not establish
its current capacity or deployment state. In-app alerts are implemented; external
SMS delivery is not. Saved SMS preferences do not send messages today.

Proposed flow:

```text
EGGCELERATE alert or explicit test notification
  -> PostgreSQL delivery job
  -> separate Python notification worker
  -> self-hosted TextBee REST API
  -> Firebase Cloud Messaging
  -> dedicated Android gateway phone + SIM
  -> designated recipient
```

TextBee is a separate service, not a replacement for EGGCELERATE's backend.
Its stack adds a NestJS API, Next.js dashboard, MongoDB and Redis. Mongo Express
is an optional admin UI and can be omitted. Firebase wakes the Android app and
hands it messages. Self-hosting requires an app build configured for our domain
and Firebase project; the published hosted-service APK is not suitable.

## Costs and capacity

- TextBee is open source and does not require a hosted TextBee subscription.
- The hosted free plan's 300/month and 50/day limits are not the default limits
  of a new self-hosted instance. The current guide says that without plan documents
  the API applies no message/device limits. This does not remove phone throughput,
  carrier restrictions, or our own spending limits.
- Actual SMS uses the gateway SIM's credits or applicable text allowance. Confirm
  the SIM plan permits the intended use; do not assume an unlimited promo means
  unrestricted automated sending.
- Server resources, storage, backups, internet, power and any Firebase/SMTP usage
  remain our responsibility. No zero-cost total is promised.
- A 4 GB RAM VPS is an initial planning suggestion for the combined low-volume
  pilot, not a measured minimum. No TextBee resource benchmark has been run.
  Inspect available headroom before placing it beside EGGCELERATE.

## Information needed before execution

1. VPS access and current CPU, RAM, disk, services and reverse-proxy configuration.
2. Domain/subdomain and DNS access, such as `sms.<our-domain>`.
3. Dedicated Android phone, Android version, active SIM, carrier and text allowance.
4. Designated consenting test recipient, preferably a separate team phone.
5. Firebase project access, Android build environment and SMTP account.
6. Pilot budget/message cap and owner responsible for the gateway phone.

Store credentials in private environment files or secret storage. Never put real
API keys, Firebase service-account JSON, phone numbers or passwords in this note.

## Batch 1 — standalone TextBee trial

1. Inspect the selected VPS and record idle EGGCELERATE resource usage first.
2. Clone `https://github.com/textbee/textbee` into a separate deployment directory.
   Record and pin the upstream revision. Inspect that revision's Compose files,
   environment examples, API routes and Android configuration before following
   commands from the documentation.
3. Use a distinct Compose project name and persistent volumes. Pin tested image
   versions. Omit Mongo Express and prevent port conflicts with EGGCELERATE.
   The inspected upstream Compose file uses `${PORT}` for both API and dashboard
   host bindings; configure separate bindings rather than setting one shared PORT.
4. Keep MongoDB and Redis private. Expose only the intended web/API endpoints
   through the existing HTTPS reverse proxy. Do not overwrite its current sites.
5. Configure MongoDB credentials, Redis, unique application secrets, SMTP and
   Firebase Cloud Messaging. Enable the send queue with `USE_SMS_QUEUE=true`.
   Account email verification requires working SMTP in the documented setup.
6. Configure the TextBee dashboard and API URLs, including the required `/api/v1`
   suffix. Rebuild the web image after changing build-time public environment values.
7. Build the Android app using our API URL and Firebase `google-services.json`.
   Follow the selected revision's build instructions, configure an appropriate
   signing key, install it and register the dedicated gateway phone.
8. Create an API key on our instance. Send one clearly labeled pilot message to
   the designated recipient. Confirm actual receipt and record the provider
   message identifier/status. API acceptance alone is insufficient evidence.
9. Measure container RAM, CPU, disk and EGGCELERATE responsiveness at idle and
   during a small bounded batch. Record build-time peaks separately from runtime.

## Batch 2 — EGGCELERATE integration

Only proceed after the standalone gateway works.

- Add a replaceable SMS adapter to the Python backend, using HTTPX with explicit
  timeouts and the self-hosted base URL. Inspect the pinned TextBee version's
  endpoint, request schema and authentication headers; do not assume hosted
  examples match every release.
- Suggested new configuration: `SMS_PROVIDER=disabled|mock|textbee`,
  `TEXTBEE_BASE_URL`, `TEXTBEE_API_KEY`, and `TEXTBEE_DEVICE_ID`. These are proposals,
  not existing EGGCELERATE settings. Keep external sending disabled by default.
- Add durable delivery records in PostgreSQL and a separate worker service.
  Commit alert events and delivery jobs atomically. Do not rely on an in-process
  FastAPI background task for restart-safe notification delivery.
- Start with an explicit test action and a recipient allowlist. Enable automatic
  delivery initially for temperature-critical and offline opening events only.
  Existing trigger persistence is 60 seconds for temperature and over 180 seconds
  without advancing telemetry for offline; retain the current alert contract.
- Preserve farm ownership and channel opt-in. Use the existing saved notification
  preferences where appropriate, but validate recipient setup before delivery.
- Deduplicate by event/episode transition, recipient and channel. Polling and
  repeated sensor readings must not create repeated SMS jobs.
- Track queued, processing, accepted, delivered, failed and uncertain outcomes.
  Integrate authenticated delivery callbacks or status polling as supported by
  the selected version. Treat callbacks as untrusted input until authenticated.
- Use bounded retries with delays and rate-limit handling. A timeout after a
  provider accepts a request is ambiguous: verify whether provider idempotency
  or status reconciliation is available before retrying. Local deduplication
  alone cannot guarantee exactly one physical SMS.
- Stop expired jobs and decide how to handle alerts that recover before sending.
  Begin without automatic repeat reminders or SMS escalation. Add recovery
  messages, reminders and escalation only after their policy is agreed.
- Keep secrets on the backend. Settings should offer recipient setup, a bounded
  test action and clear delivery state; a saved toggle must not imply verified
  delivery.

## Pilot checks and evidence

When executing this trial, validate and record:

| Check | Expected evidence |
| --- | --- |
| Real delivery | Labeled message received by the designated recipient |
| Recipient/farm isolation | Another farm cannot trigger delivery through this setup |
| Duplicate alert evaluation | One job per configured event/recipient/channel |
| Gateway phone offline | Job outcome remains honest; delayed/stale behavior documented |
| Worker/API restart | Pending jobs survive and resume without uncontrolled resending |
| Invalid key/recipient | Visible failure with bounded attempts and redacted logs |
| Ambiguous timeout | Outcome reconciled or marked uncertain, not blindly retried |
| Resource usage | Before/after RAM, CPU and disk; effects on dashboard/API recorded |
| Sending cap | Allowlist, rate limit and agreed pilot budget enforced |
| Shutdown | External delivery can be disabled while in-app alerts continue |

Record the EGGCELERATE revision, TextBee revision, environment, phone/app version,
recipient count, message count, elapsed delivery times, costs and unresolved issues.
Avoid retaining unnecessary message contents or personal data in shared evidence.

## Stop and rollback

Disable EGGCELERATE SMS delivery first and stop the notification worker. Pause or
cancel pending pilot jobs explicitly so enabling delivery later cannot send old
alerts. Stop only the TextBee Compose project, preserving its volumes for inspection.
Revoke its API key if retiring the trial. Preserve EGGCELERATE's existing services
and databases. Investigate resource pressure or unreliable delivery before expanding
the recipient list or automatic triggers.

## Sources and freshness

Reviewed 2026-10-07. Recheck against the pinned upstream revision before deployment:

- [TextBee self-hosting guide](https://textbee.dev/docs/self-hosting)
- [TextBee source repository](https://github.com/textbee/textbee)
- [Upstream Compose file](https://github.com/textbee/textbee/blob/main/docker-compose.yaml)
- [TextBee hosted free tier](https://textbee.dev/free-sms-api)
- [EGGCELERATE roadmap](../../ROADMAP.md)
- [Current alert lifecycle](../refine/m3-alert-lifecycle-2026-10-03.md)

Next action: collect the execution details above, then provision the isolated
standalone gateway and prove one real SMS before implementing automatic delivery.
