# Desktop and mobile UI controls audit — 2026-10-19

Status: audit complete; correction pass implemented 2026-10-19 (see follow-up). Source inventory, guide reconciliation, representative rendered desktop/mobile measurements, menus/dialogs, settings/detail sections, and reflow/state checks are recorded below. This is an audit, not an implementation change or a claim that every screen complies.

## Scope and evidence

Dropdown triggers and options, filters, inputs, buttons, segments, switches, checkboxes, theme tokens, and relevant dashboard/auth/settings consumers. Inventory: 152 declarations across 37 component files (`output/audit/control-source-inventory.json`). Inventory counts are search candidates, not proof of visual compliance. Non-interactive icons, card sizes, calendar cells, and pagination are not ordinary button-height violations.

References: `docs/guide/ui-control-size-guidelines.md`, `typography-guidelines.md`, `typography-experimental.md`, `color-guidelines.md`; actual values in `apps/web/src/styles/theme.css`; approved recent action convention: 34px below 768px, 36px from 768px; 12px/14px Nunito bold with 1.25 line height. Use semantic role before deciding size. Compact, toolbar, pagination, navigation, and touch wrappers have distinct roles.

## Confirmed source findings

| ID | Priority | Finding and evidence | Effect / proposed correction |
|---|---|---|---|
| A01 | High | `ui/button.tsx:8` defaults to `text-sm font-medium`, without action-role font size or line height. | Consumers without overrides stay 14px/500/20px even on phones. Move approved action typography into a reusable action primitive/variant; preserve compact and micro roles deliberately. |
| A02 | High | `ui/select.tsx:87` and `:165` use `--type-filter-label` for filter trigger and option values. Experimental guide assigns values to `--type-filter-value`. | Values follow the smaller label tier; callers' supplied font weights are also overwritten by the filter branch. Use the value role consistently for trigger and menu; keep group labels separate. |
| A03 | High | `ui/switch.tsx:14` wraps an approximately 32×18.4px clickable Radix root in a non-interactive 34px span. | The guide calls for an explicit 44px touch target. A larger non-interactive wrapper does not enlarge the actual click target. Make the interactive root own the target and render the visual track inside. |
| A04 | Medium | `trends/CustomDateRangeControls.tsx:52` references `--brand-primary-soft-hover`, which the color guide lists but current theme does not define. | Hover background declaration is invalid. Define the approved semantic token centrally or use a defined approved hover token. Radix runtime variables were excluded from the undefined-token check. |
| A05 | Medium | `trends/CustomDateRangeControls.tsx:45,49,52` applies `CONTROL_FONT` (`--type-body-sm`, 600, 1.5) to editable values and Apply action. | Date fields bypass control-value typography; Apply bypasses action typography. Use control-value for fields and button-label/bold/button-leading for the action. |
| A06 | Medium | `settings/tokens.tsx:26` defines shared input class `h-auto ... py-2.5`. | Settings input geometry derives from text line height and padding, unlike role-sized controls. Settings is explicitly outside the older dashboard sizing review; classify as a migration gap, not an undocumented new global standard. |
| A07 | Medium | `settings/ChangePasswordPanel.tsx:71,77`, `detail/OfflineStorageStatus.tsx:49`, and `detail/TrayControlStatus.tsx:177` retain `min-h-11` and rely on default Button typography. | Text actions differ from recently approved 34/36 action pattern. Review role and adopt shared action sizing; do not remove valid icon hit wrappers. |
| A08 | Medium | `screens/AlertsScreen.tsx:214,237` uses `--type-filter-label` for Mark All/Clear All buttons. | Action text is a filter-label role rather than button-label. Decide whether compact toolbar actions are an intentional documented exception; otherwise use action role. |
| A09 | Medium | `trends/IncubationRunHistory.tsx` uses Select `size="toolbar"` plus value-token override; other dashboard filters use `size="filter"`. | Menus and triggers can follow different typography policies across screens. Resolve A02 first and use one filter API, retaining the requested three-column mobile layout. |
| A10 | Medium | `ui/input.tsx` phone-value comment says 16px; theme now supplies 12px. | Misleading maintenance guidance. Correct comment and guide examples to the approved experimental scale; do not silently change the user's chosen scale. |

## Documentation conflicts requiring resolution

- Control-size guide screen table says 40px toolbar actions/search/selects. Current Incubators implementation and approved October audit use 34px mobile / 36px desktop. These cannot both be enforced for the same roles without a documented exception.
- Control-size guide micro/compact examples show 28/32px unconditionally; actual shared primitives use 36px on phones and 28/32px on desktop.
- Experimental filter table reports 11px phone values and 10px labels, but current theme supplies 10px values and 10px filter labels (the later under-768px rule wins over the earlier phone block). Code is explicitly authoritative in that guide; the table is stale.
- Typography guide retains a clearly marked superseded 16px input phone policy. Do not treat it as active. Its basic control-value table and Input source comments still repeat that older policy.
- `.incubators-typography` adds a screen-specific mobile scale through 767px; global phone scale changes below 640px. At 640–767px, same-role controls can differ between Incubators and other screens.

## Theme review

Light theme is the supported brand implementation. No complete dark palette or user theme switch was found; generic `dark:` utility branches are not evidence of supported dark mode. Do not mark lack of dark mode as a regression. Surface, text, status, and focus roles predominantly consume semantic tokens. The undefined soft-hover token is a confirmed exception. Status text uses paired foreground/background tokens and visible labels. Photo-viewer overlays legitimately use a separate dark overlay palette.

## Verification plan (completed with scope limits below)

Rendered measurements at 1440, 900, 700, 402, 375, and 320px; open dropdown menus and check selected labels/options; settings categories and dialogs; detail tabs/actions; 200% zoom/reflow; representative focus/hover/disabled states. Source-only findings above must not be presented as a complete rendered audit. No production settings or farm data have been changed for this audit.

## Rendered baseline evidence (local mock preview)

Measured Firefox, local current-worktree Vite at `http://127.0.0.1:5173`, viewport height 900px. Raw results: `output/audit/control-runtime.json`. Five routes × six widths = 30 samples. At 375px, Candling and Alerts initially yielded no controls; those two samples are inconclusive and must be repeated. No page-width overflow was recorded, but empty samples do not count as a pass. This is not a VPS visual audit or a full browser compatibility claim.

| Control | 1440px desktop | 402px phone | Assessment |
|---|---|---|---|
| Incubators search | 36px height, 14px/400 | 34px, 10px/400 | Recent compact implementation; older 40px toolbar guide conflicts. Search font belongs to documented experimental filter scope. |
| Incubators Add | 36px, 14px/700 | 34px, 10px/700 | Mobile Add deliberately uses filter-value; guide explicitly includes it in experimental scope. Do not label this a general action-font bug. |
| Mode filter | 36px, 11px/700 | 34px, 10px/700 | Desktop values use label role instead of documented 14px value role (A02). |
| Trends chamber | 40px, 11px/700 | 34px, 10px/700 | Same desktop value-role mismatch. |
| Compare Chambers switch | interactive height 18.4px | interactive height 18.4px | Confirms A03; wrapper padding is not the button target. |
| Date range inputs | 32px, 13px/600 | 36px, 11px/600 | Uses body-small rather than control-value (A05). |
| Apply | 32px, 13px/600 | 36px, 11px/600 | Shares date-field body font; action-role mismatch (A05). Compact height is a role choice, not automatically wrong. |
| Settings Import/Export/Add Custom Mode | 36px, 10px/500 | 34px, 10px/500 | Actual text actions do not use approved 14/12px bold action role. Inspect specific settings size overrides before changing base Button. |
| Alerts Mark All/Clear All | 36px, 11px/700 | 34px, 10px/700 | Geometry follows current compact actions; action-label exception needs documentation or correction. |

Computed styles are stronger evidence than class names. Generic element rules in `theme.css` can change inherited typography; do not infer final values from `text-sm` alone. A01 describes an API/role problem; its precise rendered outcome depends on the consuming screen and cascade.

### Additional confirmed finding

A11 (high): `settings/ModeLibraryPanel.tsx:590,599,610` sets literal `fontSize: 10` for Import, Export All, and Add Custom Mode at every viewport. Rendered 10px values at desktop and phone confirm this is not a media-query artifact. Replace the numeric override with the approved semantic action role. This is stronger evidence than attributing these specific buttons to shared Button alone.

### Audit progress and boundaries

No product UI or deployment was changed by this audit. Browser-driven dialog sampling initially failed to locate the responsive Add button by exact text; that sample is not counted as verified. Main-route runtime output and source inventory are retained for reproducibility. Those follow-up checks are recorded below; failed initial attempts were not counted as successful samples.

## Follow-up source findings

- A12 (medium): `screens/DetailScreen.tsx:87` and `screens/SettingsScreen.tsx:127` use segmented `FilterBar` for panel navigation. `FilterBar` emits choice buttons with `aria-pressed`, not tablist/tab/aria-selected relationships. The control-size guide explicitly distinguishes these roles. Visual alignment does not prove navigation semantics compliance. Trends top sections should be reviewed under the same rule.
- A13 (medium): `ui/alert-dialog.tsx:115` hardcodes description `text-sm`, so descriptions do not consume a responsive prose token unless individually overridden. Action/cancel defaults reuse `buttonVariants` and inherit A01. `detail/TrayControlStatus.tsx:128,140,171,176,208` similarly retains fixed `text-sm` copy.
- Auth and onboarding are separate design contexts: `auth/FormInput.tsx` consumes control-value and default-height tokens correctly; onboarding's 48px next/back actions are outside the dashboard guide's reviewed scope. They should not be mass-shrunk to card-action sizes. Their exception should be documented if a project-wide action API is introduced.
- `ui/checkbox.tsx` gives the interactive root a 44px mobile box and keeps the visual mark at 16px, which matches the documented hit-area strategy. This contrasts with A03's non-interactive Switch wrapper.

## Open menu and Create Incubator measurements

`output/audit/dialog-menu-runtime.json` covers 1440/402/320px. Create dialog: no horizontal content overflow; inputs use 14px desktop / 12px mobile, action labels use 14px/700/17.5px desktop and 12px/700/15px mobile. Actions are nominally 36px/34px. Dialog-close target is nominally 32px desktop / 44px mobile. Some recorded bounding boxes are fractional because dialog transform transitions were sampled; do not interpret fractions as a new size tier. Open options use 11px desktop / 10px mobile, nominal 32px/36px rows. This confirms the filter value token issue while showing mobile menu sizing itself is compact and consistent.

## Settings and detail rendered follow-up

`output/audit/settings-panels.json`: Farm & Account, Notifications, Hardware & Devices at 1440/402/320px. No page horizontal overflow in these nine samples. Account/delivery fields are 43px desktop and 40px phone, with control-value fonts 14/12px. Save/Discard use 40px and 14px/500 desktop. Upload photo remains 36px and 14px/500 on phones, confirming the missing responsive action typography. Delivery switches repeat the 18.4px clickable-height issue. These measurements confirm Settings migration gaps rather than treating the old dashboard-only sizing guide as globally authoritative.

`output/audit/detail-panels.json`: Monitor, Device Settings, Candling & Inspection at 1440/402/320px; no page overflow in these nine samples. Section selectors render 34px desktop / 32px phone with 11/10px filter labels; nested Device Settings selectors use 13px desktop / 11px phone, weight 600. These differ from the guide's 40px detail-tab contract, and use pressed-button rather than navigation-tab semantics. Current flow remains operable by click; this does not establish full tab-keyboard behavior compliance.

A14 (medium, documentation/geometry drift): `components/ViewToggle.tsx:36` uses literal `h-8 w-8` (32px), whereas the control-size guide explicitly describes ViewToggle as the 36px icon-token family. Rendered desktop toggles confirm 32px. Either migrate to the semantic icon token or document the compact exception; do not count the group's padding as the individual button target.

## Recommended correction order

1. Reconcile active guide tables with current approved role sizes and breakpoints; keep the user's compact mobile decisions explicit.
2. Fix shared filter-value typography, action-role defaults/variants, Switch targets, and missing soft-hover token. These changes have the largest reuse impact.
3. Remove hardcoded Settings 10px actions; align date-field/action roles; migrate Settings field/save geometry only after documenting its intended role.
4. Correct section navigation semantics and verify arrow-key/tab behavior.
5. Recheck consumers at phone/tablet/desktop widths after shared changes, including overflow, menus, dialogs, focus, disabled and hover states. Keep valid 44px icon wrappers and calendar/pagination exceptions.

## Reflow and state verification

- `output/audit/reflow.json`: the initially inconclusive Candling/Alerts 375px samples were repeated after waiting for controls; both now have populated measurements and no page overflow. Trends/Settings also passed this check.
- At effective 720px viewport with 200% root font scaling, Candling/Alerts/Trends/Settings had no page overflow and no input/select extending beyond the viewport. This verifies text enlargement/reflow under that explicit simulation, not native browser zoom, every long label, or every device.
- `output/audit/states.json`: mobile Add button received actual focus with a visible 3px shadow ring, and retained brand foreground/background on hover. Create dialog measured after animations: 36px inputs, 34px actions, 44px close button; 12px input/action text. No dialog overflow.
- Visual inspection: `output/audit/create-dialog-phone.png` and `output/audit/trends-phone.png`. The latter confirms fields wrap within the phone toolbar without page overflow. Smaller fonts/role mismatches listed above remain audit failures; a tidy layout is not proof of typography compliance.
- Disabled state: source Button applies `disabled:pointer-events-none`, opacity and cursor feedback. A separate runtime sample is in `output/audit/disabled-cli.txt`.

## Final assessment and scope limits

The interface does **not** consistently follow one desktop/mobile control contract. The strongest confirmed defects are Settings' literal 10px actions, desktop filter values using the label token, date input/action role reuse, Switch hit-target geometry, missing hover token, and section-navigation semantics. Other differences require guide reconciliation because existing compact implementations have been approved more recently than older geometry tables.

Coverage includes all shared control families and a source inventory spanning dashboard, detail, settings, auth, and admin consumers. Rendered sampling covers five primary routes at six viewport widths plus representative menus, create dialog, three Settings categories, and three detail sections at desktop and phone widths. Auth/admin, every possible nested dialog, live VPS data state, Safari/iOS native date picker behavior, native browser zoom, and unsupported dark mode were not exhaustively browser-tested. Their source patterns were reviewed where applicable; no pass claim is made for unmeasured states. These are audit boundaries, not a claim that compliance was established there.

No product source, database data, notification settings, or VPS deployment was changed for the audit. The requested deliverable is the audit and prioritized findings; correcting the 14 findings is separate implementation work.

## Implementation follow-up — 2026-10-19

The audit findings have been addressed in a frontend correction pass:

| Findings | Resolution |
|---|---|
| A01 | Shared Button owns semantic action font family, label size, bold weight and 1.25 leading. Default text action uses new `--control-height-action` (36/34px). Compact/micro/toolbar/icon variants retain role geometry. |
| A02 / A09 | Filter triggers and menu options use filter-value; run-history filters use the filter API. |
| A03 | Switch interactive Radix root owns 44×44px; separate 32px track retains its visual scale. |
| A04 | Defined the guide's existing approved `--brand-primary-soft-hover` palette value. |
| A05 | Date inputs use control-value/regular; Apply uses action typography and height. |
| A06 | Settings shared fields now use the default 36px field role; save bars retain the explicitly documented 40px toolbar exception. |
| A07 / A08 / A11 | Removed 44px text-action minimum overrides in audited consumers, corrected Alerts action label role, and removed Settings literal 10px action sizes. |
| A10 | Corrected Input/theme comments and updated typography/control guide tables; approved Incubators scope and mobile filter exceptions remain explicit. |
| A12 | Detail/Settings/Trends section navigation uses tab semantics with roving focus and ArrowLeft/Right/Home/End; nested device panels identify their controlling tabs. Filtering groups keep pressed-button semantics. |
| A13 | Alert descriptions and tray copy use responsive body tokens rather than fixed text-sm. |
| A14 | ViewToggle uses the semantic 36px icon size. |

Validation: TypeScript passed. Post-change rendered measurements and deployment status are recorded after completion below. No automated test suites were added or run.

### Correction validation and deployment

- `pnpm typecheck:web` passed after the shared-control and navigation changes; `git diff --check` passed.
- `output/audit/fix-runtime.json`: Incubators, Trends, Settings, Alerts at 1440/900/402/320px; all 16 samples have no page-level horizontal overflow. Mode values render 14px desktop/10px phone; Settings Import/Export/Add actions render 14px/700 desktop and 12px/700 phone; Switch root measures 44px. One initial Apply measurement predates its final height correction; final interaction evidence confirms 34px/12px/700 on phone.
- `output/audit/fix-interactions-verified-cli.txt`: clicking the left-middle of the enlarged Switch target toggles state; Settings ArrowRight selects Notifications and moves focus with a roving tab stop. A corner click was excluded because a rounded corner is outside the button shape.
- Shared segmented tablists now also handle nested Settings tab keyboard navigation, with custom handlers preventing duplicate processing.
- Local and VPS web images rebuilt; web service only recreated. VPS image tag: `eggcelerate-web:ui-audit-fix-20261019`; backend/firmware were not part of this correction deployment. Source backup on VPS: `/tmp/egg-ui-before-audit-fix.tar.gz`.
- Browser coverage remains local Firefox with mock data; no claim of exhaustive Safari/native zoom testing. No automated test suites were added or run.
