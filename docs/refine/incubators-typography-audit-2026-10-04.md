# Incubators typography audit — October 4, 2026

Audit of `/incubators`: page header, search/action row, status filters, mode/sort controls, grid cards, table view and pagination, empty state, Add Incubator dialog, and Finish Cycle dialog. Sections 1–11 record the original measurements before standardization; the applied scale and verification below describe the current implementation. Chamber detail tabs are outside the audit, although shared Finish Cycle dialog prose and action styles also apply there.

## Method

Source inspection plus computed browser styles at 393px mobile and 1164px desktop, with breakpoint checks at 700px and 900px. Font assets were loaded before measurement. Dialog measurements were repeated after CSS transitions finished; intermediate animated font sizes were excluded. Browser preview: `http://127.0.0.1:5176/incubators`. Root font size: 16px. Values below are **font size / line height**, both in CSS pixels. Weight is the CSS font weight, not visual ink height. Distinct font families and line heights explain why same-size text can occupy different apparent heights.

## 1. Page header

| Text | Mobile | Desktop | Font / weight | Token |
| --- | --- | --- | --- | --- |
| Incubators | 20 / 25 | 24 / 30 | Baloo 2 / 700 | `--type-page-title` |
| Manage and monitor your incubators. | 12 / 18 | 14 / 21 | Nunito / 400 | `--type-body` |
| Notification count | 9 / 13.5 | 11 / 16.5 | Nunito / 700 | `--type-label` |

Sources: `PageHeader.tsx`, `ui/typography.tsx`, `alerts/NotificationPopover.tsx`.

## 2. Search and primary action

| Text | Mobile | Desktop | Font / weight | Token |
| --- | --- | --- | --- | --- |
| Search placeholder/value | 10 / 15 | 14 / 21 | Nunito / 400 | `--type-filter-value` |
| Add / Add Incubator | 12 / 15 | 14 / 17.5 | Nunito / 700 | `--type-button-label`, `--leading-button` |

Search and Add are 34px high on mobile, 36px on desktop. Search text is smaller than the adjacent Add label on mobile. Search becomes 12px at 768–1023px, while Add is already 14px there.

Source: `incubators/IncubatorToolbar.tsx`, `ui/input.tsx`.

## 3. Status filters and dropdowns

| Text | Mobile | Desktop | Font / weight | Token |
| --- | --- | --- | --- | --- |
| ALL / NORMAL / ALERTS | 10 / 12.5 | 11 / 13.75 | Nunito / 700 | `--type-filter-label` |
| Filter count badges | 10 / 12.5 | 11 / 13.75 | Nunito / 700 | inherited filter line height |
| All modes / Progress trigger | 10 / 15 | 11 / 16.5 | Nunito / 700 | `--type-filter-label` |
| Dropdown option text | 10 / 12.5 | 11 / 13.75 | Nunito / 700 | `--type-filter-label` (source verified) |

Trigger weight resolves to **700**, despite `sortTriggerStyle` setting 500 on the outer button: SelectTrigger applies its filter-specific bold override after the supplied style. Trigger line height is 1.5; filter options and segmented pills use 1.25. This is a concrete inconsistency within the filter role.

Sources: `incubators/presentation.ts`, `IncubatorToolbar.tsx`, `ui/filter-bar.tsx`, `ui/select.tsx`.

## 4. Card header

| Text | Mobile | Desktop | Font / weight | Token |
| --- | --- | --- | --- | --- |
| Chamber Twelve | 14 / 17.5 | 16 / 20 | Baloo 2 / 600 | `--type-heading-sm` |
| Broiler High-Humidity / mode | 11 / 16.5 | 13 / 19.5 | Nunito / 500 | `--type-body-sm` |
| Battery percentage | 10 / 15 | 12 / 18 | Nunito / 700 | `--type-caption` |
| URGENT / attention badge | 9 / 11.25 | 11 / 13.75 | Nunito / 700 | `--type-label` |

These are intentional title, supporting text, and compact status tiers. They do not need to share one size.

Sources: `ChamberCardShell.tsx`, `SegmentedBattery.tsx`, `IncubatorCard.tsx`.

## 5. Temperature, humidity, and water readings

| Text | Mobile | Desktop | Font / weight | Token |
| --- | --- | --- | --- | --- |
| TEMP / HUMIDITY / WATER | 9 / 11.25 | 11 / 13.75 | Nunito / 700 | `--type-label` |
| Temperature/humidity values | 16 / 17.6 | 18 / 19.8 | Baloo 2 / 700 | `--type-heading-md` |
| °C / % units | 10 / 15 | 12 / 18 | Nunito / 400 | `--type-caption` |
| Stable / trend delta | 10 / 15 | 12 / 18 | Nunito / 400 | `--type-caption` |
| Good / Low water value | 14 / 15.4 | 16 / 17.6 | Baloo 2 / 700 | `--type-heading-sm` |
| Sufficient / Refill | 9 / 13.5 | 11 / 16.5 | Nunito / 400 | `--type-label`, but body line height |

Water helper text is one pixel smaller than temperature/humidity helpers. Water values are two pixels smaller than numeric readings. Water helpers are actionable instructions, so the helper-size difference is a stronger standardization candidate than the word-vs-number metric difference.

The reading value row has a fixed 22px height; the helper row has a fixed 16px height. Desktop caption line height is 18px, exceeding its 16px helper row. This can affect optical alignment and should be checked when adjusting the scale.

Source: `IncubatorCard.tsx`, `Reading` and `Trend` helpers.

## 6. Cycle progress and card footer

| Text | Mobile | Desktop | Font / weight | Token |
| --- | --- | --- | --- | --- |
| Day X of Y | 11 / 16.5 | 13 / 19.5 | Nunito / 700 | `--type-body-sm` |
| Percentage Complete | 10 / 15 | 12 / 18 | Nunito / 500 | `--type-caption` |
| Offline / operational status | 12 / 18 | 14 / 21 | Nunito / 700 | `--type-body` |
| Configure / Finish Cycle / Start Setup | 12 / 15 | 14 / 17.5 | Nunito / 700 | `--type-button-label` |

Card actions already follow the approved 12px mobile / 14px desktop, 1.25 line-height, 34px / 36px button-height rule.

Ready-state source branch: Incubator Ready = Baloo 2, 14/17.5 mobile and 16/20 desktop, weight 700; setup instruction = Nunito, 10/15 and 12/18, weight 400. This branch was source-verified; the current fixture did not display a ready card.

Source: `IncubatorCard.tsx`.

## 7. Table view and pagination

Desktop table measurements:

| Text | Size / line | Font / weight |
| --- | --- | --- |
| Column headings | 11 / 15.71 | Nunito / 700 |
| Chamber name | 14 / 20 | Nunito / 700 |
| Mode pill | 12 / 17.14 | Nunito / 700 |
| Day cell | 14 / 20 | Nunito / 400 |
| Temperature/humidity/water cells | 14 / 20 | Nunito / 700 |
| Status badge | 12 / 17.14 | Nunito / 600 |
| Configure | 14 / 20 | Nunito / 500 |
| Showing / Items per page / Page X of Y | 11 / 16.5 | Nunito / 400 |

The table uses Tailwind `text-sm` and its 20px line-height, rather than the role typography primitive. Thus equal 14px text has 20px in the table vs 21px body or 17.5px actions elsewhere. Table Configure is also 32px high on desktop instead of the card's 36px.

The list-view toggle is hidden on mobile. Resizing an already-selected table to mobile is possible because view state persists; table `text-sm` remains 14px instead of following the mobile body token. This is source-verified, not a separate rendered mobile table capture.

Sources: `incubators/ChamberList.tsx`, `ui/table.tsx`, `ui/button.tsx`, `ui/pagination-bar.tsx`, `StatusBadge.tsx`.

## 8. Empty/filter state

| Text | Mobile | Desktop | Font / weight |
| --- | --- | --- | --- |
| No chambers match your filters | 20 / 25 | 24 / 30 | Baloo 2 / 700 |
| Try a different search term or filter. | 11 / 16.5 | 13 / 19.5 | Nunito / 400 |
| Clear filters | 11 / 16.5 | 13 / 19.5 | Nunito / 600 |

Clear filters is an action but uses body-small rather than the button label scale. The empty-state title matches the full page title; a smaller section-heading tier could avoid competing with the actual page heading.

Source: `incubators/ChamberList.tsx`.

## 9. Add Incubator dialog

| Text | Mobile | Desktop | Font / weight |
| --- | --- | --- | --- |
| Dialog title | 16 / 20 | 18 / 22.5 | Baloo 2 / 700 |
| Description | 14 / 20 | 14 / 20 | Nunito / 400 |
| Field labels | 12 / 15 | 14 / 17.5 | Nunito / 500 |
| Input values/placeholders | 12 / 18 | 14 / 21 | Nunito / 400 |
| Character counter | 10 / 15 | 12 / 18 | Nunito / 600 |
| Cancel / Connect Incubator | 12 / 17.14 | 14 / 20 | Nunito / 500 |

Dialog description remains 14px on mobile because it uses `text-sm`. Dialog actions match the label font-size numbers but inherit 1.4286 line-height and weight 500 instead of the card/toolbar's 1.25 and 700. Both actions explicitly set 34px height even on desktop, where the earlier standard is 36px.

Source-verified error branch: Connection Failed uses body-small (11/13px); error explanation uses caption (10/12px) with 1.45 line-height; connecting helper uses caption, weight 600. No device verification or save operation was submitted during this audit.

Sources: `incubators/CreateIncubatorDialog.tsx`, `ui/dialog.tsx`, `ui/label.tsx`, `FieldCounterLabel.tsx`, `ui/input.tsx`, `ui/button.tsx`.

## 10. Finish Cycle dialog

| Text | Mobile | Desktop | Font / weight |
| --- | --- | --- | --- |
| Dialog title | 16 / 20 | 18 / 22.5 | Baloo 2 / 700 |
| Chamber name | 10 / 12.5 | 12 / 15 | Nunito / 500 |
| Instruction | 10 / 15 | 12 / 18 | Nunito / 400 |
| Chicks hatched label | 11 / 13.75 | 13 / 16.25 | Nunito / 500 |
| Count input | 12 / 18 | 14 / 21 | Nunito / 400 |
| Hatchability label | 11 / 16.5 | 13 / 19.5 | Nunito / 700 |
| Hatchability percentage | 16 / 20 | 18 / 22.5 | Baloo 2 / 700 |
| Supporting result counts | 10 / 15 | 12 / 18 | Nunito / 400–700 |
| Cancel / Save & Reset | 12 / 17.14 | 14 / 20 | Nunito / 500 |

Same action line-height/weight and desktop height mismatch as Add dialog. This dialog's instruction is caption-sized while Add dialog description stays 14px on mobile, so the dialog prose tiers differ substantially. No harvest/reset operation was submitted.

Source: `HarvestModal.tsx` and shared dialog/button/input primitives.

## 11. Breakpoint and documentation drift

- Main typography switches at **640px**; filter and button label overrides switch at **768px**; filter values add a tablet tier up to **1024px**.
- At 700px, page title/cards use desktop sizes while search remains 10px and action labels remain 12px. At 900px, search is 12px and Add is 14px.
- `--type-label` says "11px system minimum" but its phone override is 9px. Typography primitive comments prohibit body/actions below 11px, while the approved experimental theme deliberately lowers mobile sizes. The audit describes actual behavior; those comments should be reconciled with the chosen policy.
- The `--type-filter-value` comment says 11px mobile, but the actual override resolves to **10px**. The header comment on control-value also still references a 16px phone value, while the actual phone value is 12px.
- Numeric arguments `valueSize={16}` / `subtextSize={11}` in Reading choose tokens, rather than guaranteeing those pixel sizes. They resolve to 14px and 9px on phones, respectively.

## Applied standardization

Keep different sizes for different roles; standardize repeated roles across sections.

| Role | Mobile | Desktop | Font / weight | Line height |
| --- | --- | --- | --- | --- |
| Page title | 20px | 24px | Baloo 2 / 700 | 1.25 |
| Card title | 14px | 16px | Baloo 2 / 600–700, choose one shared card contract | 1.25 |
| Mode/supporting card text | 11px | 13px | Nunito / 500 | 1.5 |
| Body/instructions | 12px | 14px | Nunito / 400 | 1.5 |
| Search/dropdown values | 12px | 14px | Nunito / 400–500 | 1.25 or 1.5, one contract per control type |
| All action labels | 12px | 14px | Nunito / 700 | 1.25 |
| Compact status/filter labels | 10px | 11px | Nunito / 700 | 1.25 |
| Numeric readings | 16px | 18px | Baloo 2 / 700 | 1.1 |
| Water word value | 14px | 16px | Baloo 2 / 700 | 1.1 |
| Units, trends, water helpers, battery, percentages | 10px | 12px | Nunito / 400–700 by emphasis | 1.5 |

Applied in this pass: normalized table/dialog/Clear filters action typography and 34px/36px heights; unified water helper text with the caption tier; moved search and dropdown values to readable control-value sizing; and scoped the same mobile/tablet role tokens through the Incubators dialogs. The segmented status filters remain compact by design. The table still uses its existing semantic cell hierarchy, with the Configure action now matching card actions.

This scale preserves the current card density and the explicitly approved action sizes. It is now applied to the Incubators list, its Add Incubator dialog, and its Finish Cycle dialog. The shared controls retain their role-specific typography while using one phone/tablet breakpoint. The remaining card-title and metric distinctions are intentional hierarchy, not unresolved drift.

## Follow-up verification

Computed browser styles confirmed search and mode/sort controls at 12px/18px on 393px and 700px viewports, and 14px/21px at 900px and 1164px. Add action labels resolve to 12px/15px and 14px/17.5px, weight 700, with respective 34px and 36px button heights. No page horizontal overflow was observed at these widths. The mobile Add dialog actions also resolve to 12px/15px, weight 700, height 34px.

The reading helper row now has a minimum height that accommodates its caption line: 16px on mobile and 18px on desktop, instead of a fixed 16px row containing an 18px line.
