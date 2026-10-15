# Current mode catalog — Philippine pilot

Updated October 14, 2026. User requested three built-in modes and removal of
other supplied preset/demo choices, while allowing user-created custom modes. Selected **Chicken, Duck and Quail** as common
Philippine poultry egg types. This is a practical pilot selection; the reviewed
sources do not establish a national ranked top-three statistic.

Sources: [PSA chicken/duck egg production reporting](https://rsso06.psa.gov.ph/content/livestock-and-poultry-situation-report-aklan-annual-2025),
[DA mallard/itik production](https://ati2.da.gov.ph/ati-8/content/article/jonalyn-g-saulan/eggs-enterprise-training-duck-production-and-management),
[DA ATI quail production](https://ati2.da.gov.ph/ati-main/content/article/ladylyn-jose/new-e-learning-course-quail-production).

## Existing profile values retained

| Built-in mode | Stable internal ID | Temperature | Humidity | Duration | Turn interval |
| --- | --- | --- | --- | --- | --- |
| Chicken | broiler | 37.5 to 37.8 °C | 55 to 60% RH | 21 days | 4 hours |
| Duck | duck | 37.4 to 37.6 °C | 62 to 68% RH | 28 days | 6 hours |
| Quail | quail | 37.5 to 37.8 °C | 55 to 60% RH | 18 days | 4 hours |

Values are the existing application presets, not new husbandry guidance or
qualified actuator thresholds. Duck breed/quail species, stage-specific hatch
settings, turning cutoffs, hysteresis and fault limits require qualification
before automatic physical control. Keeping the chicken ID broiler preserves
existing chamber and cycle references while the current display name is Chicken.
Historical snapshots retain their recorded names/settings.

## Implemented locally

- Web fixtures and API defaults contain only these three built-in profiles.
- Development chamber fixtures reference the supported set. Persisted physical
  chambers/cycle history are not rewritten or assigned another species.
- Onboarding species choices are Chicken, Duck and Quail.
- Settings and new preparation/configuration choices include the three built-ins
  and eligible user-created custom profiles.
- Add/Import/Duplicate custom-mode actions are enabled. API and mock repository
  support user-created custom profiles, including editing and deleting them when
  not assigned to a chamber. Supported built-ins cannot be deleted.
- Numeric profile settings remain editable; the three built-in species names
  remain fixed. Custom profile names are editable.
- Retired built-in/demo presets are excluded from new selection. A retired profile
  still referenced by an existing chamber remains readable for correct current
  display/derivation. Unreferenced old rows are not included in the API list.
  Old rows remain stored for history/rollback; this change does not purge data.
- Existing farms' mode rows are read using the canonical Chicken display name.
  Fresh owner farms seed only the supported three. No schema migration required.

## Verification and rollout

Web typecheck, production build and Python syntax compilation passed.
No regression suite/browser or live database review
was run for this change. Existing tests asserting ten supplied
presets still require review before claiming the full regression baseline.
Source changes are local; API/web image rollout to the VPS remains pending.

Related: [actuator/VPS plan](vps-actuator-control-plan.md), [roadmap](../../ROADMAP.md).
