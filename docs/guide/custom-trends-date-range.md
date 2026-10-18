# Custom environmental trend dates

**Status:** deployed to the VPS (2026-10-18).

## Using the controls

Open Trends → Environmental Trends. Beside the Last 24h, Last 7 days, and Full
cycle presets, enter **From** and **To** dates/times and choose **Apply**.

- Dates automatically use the browser's local time zone and are converted to
  UTC for server requests. The persistent timezone helper was removed at the
  user's request.
- From is inclusive and To is exclusive. Both must be valid; From must precede
  To, and To cannot be in the future.
- Editing a field does not change the chart until Apply is selected.
- Selecting a preset exits the applied custom range. The custom dates remain
  available while the controls are mounted, and applied dates survive switching
  between the environmental and hatch history tabs.
- Compared chambers use the same bounds. Temperature and humidity share them.
- See all readings and the complete raw CSV use the same custom bounds.
- These controls filter environmental history only; hatch history is unchanged.

## Implementation

- Existing chart and raw-preview endpoints accept optional aware `start` and
  `end` timestamps. `start` requires `end`; existing preset clients continue to
  work. No database migration is needed.
- Custom ranges query the current chamber's farm/device history directly,
  independently of whether an incubation cycle has started.
- The existing server-side chart aggregation stays bounded to at most 600
  points per chamber, preserving sample counts and observed min/max values.
  The first bucket label can precede From because buckets are aligned to epoch
  boundaries; its samples are still strictly limited to the selected interval.
- Query-cache keys include both bounds, so different date ranges do not reuse
  each other's chart responses.
- Historical raw previews use a separate receipt-time cutoff taken when opened,
  so offline uploads already received can be included even when To is earlier
  than their upload time. The signed CSV scope retains this same cutoff.
- The existing farm authorization, bounded raw preview, streaming CSV, and
  signed-scope expiry are preserved.
- The mock repository also honors custom observation bounds for its available
  generated samples; it cannot supply historical data outside those fixtures.

## Release and backup

- API/web images: `eggcelerate-api:custom-trends-20261018` and
  `eggcelerate-web:custom-trends-20261018`.
- Backup: `/opt/eggcelerate/rollback-custom-trends-20261018-x8nj62kw/`.
- Private local backup mirror:
  `output/backups/vps-pre-custom-trends-20261018/`.
- Release: `output/releases/vps-custom-trends-20261018/` and
  `/opt/eggcelerate/releases/custom-trends-20261018/`.
- Backup hashes match and the database dump listing parsed. A restore was not
  rehearsed; the existing Timescale aggregate circular-constraint warning was
  emitted by pg_dump.
- TypeScript, targeted Python lint/type checks, and whitespace checks passed.
  Functional/visual tests were not run for this change.
- Rollback restores the backed-up compose wrapper and recreates API/web with
  their previous images. No database downgrade is required. The ESP32 firmware,
  MQTT worker, and controller regulation are not changed by this release.

## Activation result

- API and web containers are healthy on the custom-trends release images.
- Public verified HTTPS `/readyz` returned `ready: true`.
- All 13 source files matched their release hashes. Installed API modules and
  running API/web image IDs match the built release artifacts.
- MQTT worker retained its previous container/image. No hardware commands were
  sent and the ESP32 was not restarted.
- Production builds and static checks passed. Functional account/chart/CSV and
  visual acceptance checks remain unrun.
