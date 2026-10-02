# Mobile UI audit, page by page — 2026-09-24

## Overall result

At the target **393 × 852 CSS-pixel viewport**, the main authenticated screens fit the phone width and the navigation remains usable. The strongest issue is the fixed 56 × 56px Eggcelerate help launcher: at this viewport it sits over live controls on several pages. The Incubators page also inherits the previous page's scroll position when opened from a scrolled chamber detail, so it can land halfway down the list. In Chamber Device Settings, “Connection Lost” is shown in green even when the device is offline.

The Overview’s current chamber cards use a small Offline badge and leave the progress ring readable. The detail timeline keeps its DAY heading and now separates it from the first journal marker. These areas looked clear in the latest Overview and detail captures.

## Test basis and limits

- Local Vite app, seeded mock account, Firefox Playwright session, **393 × 852 CSS px**, 100% zoom. The test browser reported DPR 1; your device toolbar shows DPR 3. The CSS viewport matches, but this was not a physical-device touch test.
- Reviewed the authenticated shell, Overview, Incubators, chamber detail sections and settings, Candling Logs, Trends, Alerts, Settings categories, notification popover, calendar sheet, and all three candling journal form steps. Navigation and form-step buttons were exercised; no inspection was saved and no alert was dismissed.
- The source hot-updated during the pass. Vite briefly showed a JSX closing-tag error in `OverviewScreen.tsx`; the current source now has the matching `</span>`, the error overlay cleared, and the final typecheck and production build passed. Overview was captured again after the update. Other screens were captured from the same local session before that Overview-only update.
- `pnpm --filter eggcelerate-ui typecheck`: passed. `pnpm --filter eggcelerate-ui exec vite build`: passed, with Vite’s existing warning that a minified JavaScript chunk is over 500 kB. Tests were not rerun for this visual audit.
- This pass covers the 393px portrait viewport. It does not cover physical devices, 320px, landscape, 200% zoom, keyboard-only flows, screen readers, sign-in/onboarding, or throttled mobile-network performance.

## Phase 1 — Home and primary navigation

**Overview.** The 2 × 2 KPI layout, chamber carousel, and Conditions to Check section fit at 393px. The latest chamber cards show an Offline badge without covering the progress ring or day count. The temperature/humidity selector is the main exception: the floating help launcher covers **42 × 32px** at the right end of the Humidity segment. [Overview, 393 × 852](../../output/playwright/mobile-page-audit-2026-09-24/overview-393.png)

**Incubators.** Search, Add, status filters, mode/progress filters, and the sort control fit on one phone-width layout. Chamber cards stack vertically and expose sensor summaries, progress, offline state, and Configure actions. Two cards are partly visible in the initial viewport. [Incubators at the top](../../output/playwright/mobile-page-audit-2026-09-24/incubators-393-viewport.png)

**More menu.** Alerts, Settings, and Sign out are available from the More navigation item. The flyout fits above the bottom bar, but the help launcher covers part of the Sign out row. [More menu](../../output/playwright/mobile-page-audit-2026-09-24/more-sheet-393.png)

**Scroll position.** I scrolled Chamber Twelve to `scrollY=471`, then selected Incubators from the bottom navigation. The Incubators page opened at the same `scrollY=471` and showed partial card content instead of its top. This can make the page feel as though its first results are missing. [Incubators after returning from detail](../../output/playwright/mobile-page-audit-2026-09-24/incubators-returned-mid-scroll-393.png)

## Phase 2 — Incubator detail

**Live Monitor.** Chamber One’s title, day/status chips, three detail tabs, telemetry caveat, timeline, and gauges fit at 393px. Timeline labels through Hatch remain visible. The Chamber status grid continues below the fold and scrolls vertically. [Chamber One monitor](../../output/playwright/mobile-page-audit-2026-09-24/detail-monitor-active-393.png)

**Candling & Inspection.** The milestone timeline and summary fit without horizontal scrolling. The DAY caption remains above the journal dates with visible separation; the calendar action is a 44 × 44px target. [Chamber One candling](../../output/playwright/mobile-page-audit-2026-09-24/detail-candling-active-393.png)

**Device Settings.** Mode, Turning, and Device subsections fit the viewport width. Turning controls remain in a single column and Device lists use compact rows. The device preferences view clearly says values are previews rather than confirmed device settings. [Mode](../../output/playwright/mobile-page-audit-2026-09-24/detail-settings-393.png), [Turning](../../output/playwright/mobile-page-audit-2026-09-24/detail-turning-393.png), [Device & Connection](../../output/playwright/mobile-page-audit-2026-09-24/detail-device-393.png), and [device preferences](../../output/playwright/mobile-page-audit-2026-09-24/settings-device-preferences-393.png).

**Calendar and inspection form.** The calendar sheet fits within the phone viewport. The three-step Log Inspection form keeps its inputs and actions visible; step 1 has a large unused middle area, while steps 2 and 3 use the space more effectively. On step 3, the help launcher overlaps the bottom edge of Save Inspection by about 35 × 5px. [Calendar sheet](../../output/playwright/mobile-page-audit-2026-09-24/calendar-sheet-393.png), [form step 1](../../output/playwright/mobile-page-audit-2026-09-24/log-inspection-modal-393.png), [step 2](../../output/playwright/mobile-page-audit-2026-09-24/log-inspection-step2-393.png), and [step 3](../../output/playwright/mobile-page-audit-2026-09-24/log-inspection-step3-393.png).

## Phase 3 — Daily operation pages

**Candling Logs.** Search, All/To Log/Done filters, sorting, and the first log card fit at 393px. Empty journal panels make the cards tall, so only about one and a half cards appear in the viewport. The help launcher intersects the second Open log button by **16 × 36px**, including the arrow end of the target. [Candling Logs](../../output/playwright/mobile-page-audit-2026-09-24/candling-logs-393.png)

**Trends.** Environmental Trends controls and the chart title/metric selector fit on one row at this viewport. The telemetry banner wraps to three lines but stays readable. Hatch History’s three summary cards, search, species filter, and result cards fit the width. The help launcher sits over the lower-right chart/list content while those sections are visible. [Environmental Trends](../../output/playwright/mobile-page-audit-2026-09-24/trends-393.png) and [Hatch History](../../output/playwright/mobile-page-audit-2026-09-24/hatch-history-393.png).

**Alerts.** All/Unread/Important and the Recent/Mark All/Clear All controls fit. Alert text and acknowledge/dismiss actions are readable, but the floating help launcher covers part of the fourth visible alert row. [Notification Center](../../output/playwright/mobile-page-audit-2026-09-24/alerts-393.png)

**Notification popover.** The 340 × 492px panel remains inside the 393px viewport; each dismiss button measures 44 × 44px. [Notifications popover](../../output/playwright/mobile-page-audit-2026-09-24/notification-popover-393.png)

## Phase 4 — Settings

The four Settings category tabs fit across at 393px. Mode Library search, Import/Export/Add actions, and stacked mode cards fit the phone width. Delivery & contacts fields, Alert rules, and Farm & Account controls are readable at the top of their sections. Hardware & Devices uses stacked paired-device rows, and Device preferences labels the shown values as previews.

The help launcher obscures portions of active content in this area too: it covers the Time Zone selector’s right side, the Battery fully charged switch row, and an Offline badge in the device list. [Mode Library](../../output/playwright/mobile-page-audit-2026-09-24/settings-mode-393.png), [notification delivery](../../output/playwright/mobile-page-audit-2026-09-24/settings-notifications-393.png), [alert rules](../../output/playwright/mobile-page-audit-2026-09-24/settings-alert-rules-393.png), [Farm & Account](../../output/playwright/mobile-page-audit-2026-09-24/settings-account-393.png), and [paired devices](../../output/playwright/mobile-page-audit-2026-09-24/settings-hardware-393.png).

## Phase 5 — Prioritized findings

| Priority | Finding | Evidence and next step |
|---|---|---|
| **P1** | **The floating help launcher overlaps usable mobile controls.** It measures 56 × 56px at x=321–377, y=724–780. It intersects the Overview Humidity segment, the second Candling Logs Open log action, Settings controls, and visible list content. The fixed placement is in [HelpWidget.tsx](../../apps/web/src/app/components/HelpWidget.tsx#L134). | Reposition or collapse the launcher on phones so it never covers a control, form field, status label, or chart label. Recheck the full scroll range, not only the initial viewport. |
| **P1** | **An offline chamber can display “Connection Lost” in green.** Device Settings chooses the accent color from `unit.paired` even when `connectionState` is not connected, so the screenshot shows a green lost-connection status. | Choose the status color from the actual connection state and use the offline/error role when the connection is lost. See [DeviceSettingsTab.tsx](../../apps/web/src/app/components/detail/DeviceSettingsTab.tsx#L605). |
| **P2** | **Bottom navigation preserves a scrolled detail offset on Incubators.** Returning from a detail page at y=471 opens the list at y=471. | Reset scroll to the top on primary destination changes. Preserve the list offset only for an explicit Back-to-Incubators return if that behavior is desired. |
| **P2** | **The first step of Log Inspection reserves substantial empty height.** The form is 361 × 639px while its first-step controls occupy only the upper portion; the fixed footer remains at the bottom. | Let the mobile dialog height follow the active step’s content while keeping its footer reachable. |
| **P2** | **Compact labels and helper copy remain small in dense areas.** Labels and explanatory text in cards, condition rows, and settings commonly use 9–10px CSS text. No clipping was seen at 393px, but readability should be confirmed on the actual DPR-3 device and in direct sunlight. | Keep essential state/value text at the body scale; reserve the smallest type for nonessential metadata and uppercase section captions. |

## What is working well

- The current Overview offline badge leaves the progress ring and day text visible.
- The incubator timeline labels fit the target width, and the DAY journal heading is retained with clear spacing.
- Settings category tabs, detail tabs, Trends selectors, and Alert filters all fit at 393px.
- The notification popover and candling form actions stay inside the viewport; the bottom navigation remains fixed and legible.
- Measured document width matched the 393px viewport on Overview and Hatch History, and no page-level horizontal scrollbar appeared in the reviewed screens.

## Suggested next work order

1. Move or shrink the help launcher so its hitbox clears all mobile controls and content.
2. Correct the offline connection color state and verify the device status wording against actual connection telemetry.
3. Reset scroll when switching to Incubators from primary navigation.
4. Reduce the empty height in the first Log Inspection step and recheck its fixed footer at 393px.
5. Repeat this pass on a physical DPR-3 device, then stress-check 320px, landscape, and 200% zoom.
