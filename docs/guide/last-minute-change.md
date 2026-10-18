# Last-minute changes: Settings password change and shared incubator access

**Status:** Settings password change and shared-incubator pairing are deployed
to the VPS (2026-10-18).

## Request

Allow a signed-in user with a real API-backed account to change their own
password from **Settings → Change password**. The user clarified that no
Forgot password function is requested. This replaces the earlier email-recovery
proposal; domain setup, email delivery, email verification, recovery links, and
reset-token storage are outside this scope.

## Current behavior

- API passwords must be 12–128 characters and are hashed with Argon2id.
- An operator can reset an account with
  `python -m eggcelerate_api.admin reset-password --email <address>` from the
  API environment. The CLI prompts privately and revokes all active sessions.
- The mock demo has a separate local administrator reset control that does not
  affect real API accounts.

## User flow

1. The signed-in user opens **Settings → Change password**.
2. They enter their current password, new password, and new-password confirmation.
3. The server verifies their current password and validates the new password
   against the existing 12–128 character policy.
4. The server stores the new Argon2id hash and revokes all active sessions in
   one transaction.
5. The UI clears sensitive form values and account caches, then asks the user
   to sign in again with the new password.

Current-password confirmation and signing out all sessions are implemented
defaults. Users who cannot remember their password can still
use operator-assisted recovery through the existing CLI.

## Changes to plan

### Frontend

- Add an accessible Settings form with current password, new password, and
  confirmation fields, visibility controls, and clear error/success feedback.
- Check matching confirmation and password policy before submission; keep
  server-side validation authoritative.
- Prevent duplicate submissions. Clear sensitive form values on success or
  leaving the form; never persist passwords in browser storage.
- After success, clear authentication state and cached account data and return
  to sign-in with a password-changed confirmation.
- Keep mock-demo behavior separate from real API accounts.

### API and database

- Add an authenticated password-change endpoint under `/api/v1/auth`.
- Derive the account from the authenticated session, never a client-supplied
  email, user ID, or farm membership.
- Verify the current password and reuse the existing password policy and
  Argon2id helpers for the new password.
- Serialize concurrent changes for the same account; recheck the current
  password while holding the account lock. Atomically update the password hash
  and revoke all active sessions, including the requesting session.
- Apply existing session/origin protections and rate-limit failed password
  checks by account and source.
- Reuse the users and auth_sessions tables. No email service, reset-token table,
  or email-verification migration is expected for this feature.

### Security and operations

- Use the existing HTTPS connection. Never log passwords, hashes, or secrets.
- Preserve the operator CLI as a separate recovery path.
- Document that Settings password changes require a signed-in session and the
  current password. No Forgot password feature is included.

## Acceptance checks for implementation

- A signed-in user can change only their own password.
- Wrong current passwords, invalid new passwords, and mismatched confirmation
  leave the password and existing sessions unchanged.
- Unauthenticated requests are rejected and existing origin protections apply.
- A successful change stores an Argon2id hash and revokes every active session.
- The new password works at sign-in; the old password and old sessions do not.
- Concurrent submissions cannot both succeed using the same old password.
- Failed current-password attempts are rate-limited.
- Passwords do not appear in logs, persistent browser storage, or cached data.
- Mock-demo and API account behavior remain separate.
- The existing operator CLI reset continues to work.

## Related implementation references

- [Authentication and onboarding](./auth-onboarding-guide.md)
- [Local user administration](./platform-admin-guide.md)
- [API admin CLI](../../apps/api/src/eggcelerate_api/admin.py)
- [Authentication endpoints](../../apps/api/src/eggcelerate_api/api/v1/auth.py)
- [Sign-in and registration screens](../../apps/web/src/app/components/auth/)

## Interim shared incubator access

**Status:** deployed to the VPS as an interim pairing flow (2026-10-18).

- Account 1 enters the incubator's pairing code, such as `EGG01`, and can
  monitor and control it.
- Account 2 can enter the same code and is added to the farm immediately. There
  is no owner approval or email-verification step.
- If the incubator is already in the farm, the second account opens that same
  incubator instead of creating a duplicate record.
- Pairing switches the current session to that farm. The most recently joined
  farm is selected again at the next sign-in.
- Farm access is currently the authorization boundary, so the second account
  can access the farm's other incubators and records too. Anyone with a valid
  pairing code can join that farm under this interim rule.

## Implementation details (2026-10-18)

- Settings location: **Farm & Account → Change password**, for API accounts only.
- Endpoint: `POST /api/v1/auth/change-password`, with `current_password` and
  `new_password`. Confirmation is checked in the form.
- Password changes require a valid session, allowed origin, and CSRF token.
- New passwords use the existing 12–128 character rule and must differ from the
  current password. All sessions are revoked on success; sign in again.
- Rate limits use separate HMAC buckets: 5 attempts per account and 30 per
  socket source in each 15-minute window. Attempts include successful changes;
  a proxy may make the source limit shared among users.
- Account locking serializes password changes and login session creation.
- Authentication validation responses omit submitted input and validator context
  so malformed password requests do not echo credentials.
- Existing user/session/membership tables are reused; schema remains `0025`.
- This rollout updates API and web images. ESP32 firmware and the MQTT worker
  are unchanged.
- Shared pairing continues to grant farm-wide owner access without approval,
  as described above. No per-incubator permission model is introduced.

### Build and deployment record

- Local TypeScript check, targeted Python lint/type checks, and production API
  and web image builds passed. Functional/automated acceptance tests have not
  been run for this change.
- VPS backup: `/opt/eggcelerate/rollback-settings-password-20261018-v36lt7oa/`.
- Private local backup mirror:
  `output/backups/vps-pre-settings-password-20261018/`.
- Backup files were checked against SHA-256 hashes; the database dump listing
  parsed successfully. A database restore was not rehearsed. The dump emitted
  the existing Timescale continuous-aggregate circular-constraint warning.
- Release files: `output/releases/vps-settings-password-sharing-20261018/`.
- Rollback: restore the backed-up `hardware-compose.sh`, then recreate API and
  web with the prior image selections. No database downgrade is needed for
  this release. Password changes already made remain in the database.

### VPS activation

- API and web are running `settings-password-sharing-20261018` images and both
  containers report healthy. Public HTTPS `/readyz` returned `ready: true`.
- Running API source hashes and both running image IDs match the local release.
- All 10 deployed source files match the release manifest. Deployment source was
  taken from the prior VPS snapshot with only the selected account/pairing
  changes added; unrelated local notification changes were excluded.
- The MQTT worker retained its existing container and image. No firmware was
  installed and no actuator commands were sent.
- Deployment evidence is saved beside the local and remote release artifacts.
- No existing user's password was changed during deployment. Functional account
  acceptance checks remain unrun.
