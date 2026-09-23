# Table/List Consistency Refinement Plan

Status: Partially implemented — Candling table/pagination migration is present; visual/responsive parity and manual review pending

Historical note: the original local-only audit artifact is not part of the tracked
record. The implemented table primitives are described in the current source and
the [UI control-size guidelines](../../guide/ui-control-size-guidelines.md).

## Goal

Make the Incubators and Candling Logs list views feel like two uses of the same product table while preserving their different data and purposes.

The list views should share the same table structure, pagination behavior, surface colors, header treatment, row density, separators, and focus behavior. Candling Logs may still show richer journal information inside its cells. Its diary-like card grid remains a separate presentation mode.

## Current implementation status

Incubators uses the project’s shared table and pagination primitives:

- `apps/web/src/app/components/ui/table.tsx`
- `apps/web/src/app/components/ui/pagination-bar.tsx`
- `apps/web/src/app/components/screens/IncubatorsScreen.tsx:371-447`

Candling Logs list mode has already been migrated to the shared native table and pagination primitives:

- `apps/web/src/app/components/screens/CandlingLogsScreen.tsx:457-547`

The source migration removes the previous semantic and pagination split. The remaining phases in this document apply to visual parity, contained responsive overflow, keyboard review, and documentation—not to reimplementing the Candling table markup.

## Refinement decisions

### Use the existing table primitives as the canonical contract

Candling Logs list mode should use `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, and `TableCell`. Do not create a second table markup pattern for this screen.

Reuse `PaginationBar` for result range, page size, and page navigation. Do not reintroduce the removed “All incubators” section heading or duplicate result-count line; any result count belongs in the pagination bar.

### Keep content-specific columns

The shared structure does not require identical columns:

| Screen | Columns |
|---|---|
| Incubators | Chamber, Mode, Day, Temp, Humidity, Water, Status, Actions |
| Candling Logs | Chamber, Progress, Next Check, Last Logged, Status, Actions |

The Candling “Latest journal entry” treatment should become content inside a table cell rather than a separate card-like row structure.

### Keep the diary view separate

The Candling grid view should continue using `JournalCard` because it supports the notebook/diary feeling. Only the list view should be normalized to the Incubators table pattern.

### Reuse tokens instead of adding table-specific colors

Use the existing theme roles:

- `var(--surface-subtle)` for the table frame and header surface;
- `var(--surface-card)` for the readable row/content surface when needed;
- `var(--border-default)` for the outer frame;
- `var(--border-subtle)` for row separators;
- `var(--text-muted)` for uppercase column labels;
- `var(--text-primary)` and `var(--text-secondary)` for cell hierarchy;
- existing semantic status tokens for Overdue, Due, Upcoming, and Complete.

Match the Incubators table’s geometry first. Do not introduce another radius, shadow, header height, or ad-hoc hex color during this refinement.

## Implementation phases

### Phase 0 — Confirm the baseline

1. Capture Incubators list mode and Candling Logs list mode at the same viewport and browser zoom.
2. Record the current first-content position, table frame width, header height, row height, and visible columns.
3. Confirm that the only intended screen change is Candling Logs list mode; leave the Candling grid mode unchanged.

### Phase 1 — Add Candling list pagination state *(implemented in source)*

Modify `CandlingLogsScreen.tsx`:

1. Add `page` and `rowsPerPage` state with the same initial page size used by Incubators (`10`).
2. Derive `totalPages`, a clamped page, and `pagedRows` from the existing filtered/sorted `rows` collection.
3. Reset to page 1 when search, status filter, mode filter, or sort changes in a way that can invalidate the current page.
4. Pass the derived page values to `PaginationBar` rather than paginating the underlying summaries or changing the existing filtering logic.
5. Use consistent result copy. Prefer the row noun used by the table (`chambers`) or the product noun used by Incubators (`incubators`), but do not mix both in the same control.

### Phase 2 — Replace the custom list renderer *(implemented in source)*

Replace the desktop/list branch in `CandlingLogsScreen.tsx:475-577`:

1. Import and use the shared table primitives.
2. Use the same outer table surface shape as Incubators.
3. Render `PaginationBar` at the top of the table surface.
4. Render a native `TableHeader` with the Candling columns.
5. Render each `pagedRows` item as a `TableRow` with `TableCell` children.
6. Keep the current progressbar semantics inside the Progress cell.
7. Keep the chamber-specific `Open log` button and accessible name.
8. Avoid making a `<tr>` itself a nested button if the row already contains an action button. If whole-row navigation is desired later, define that interaction consistently for both screens first.

The grid/card branch should not be rewritten as part of this phase.

### Phase 3 — Align visual treatment *(remaining parity work)*

Apply the Incubators list treatment to Candling Logs:

1. Match table frame radius, border, and shadow behavior.
2. Match column-header typography: `var(--type-label)`, bold weight, uppercase, and `var(--tracking-label)`.
3. Match table cell padding and vertical alignment before tuning Candling-specific text wrapping.
4. Use the same separator color and hover/focus treatment.
5. Keep status text and icons semantically labeled; color must not be the only status signal.
6. Use `var(--brand-primary)` for Open log actions and keep the existing outline hierarchy.
7. Remove duplicated local grid-column definitions and any styles that only existed to simulate table columns.

### Phase 4 — Responsive and accessibility review

1. Verify the native table has a clear accessible name or caption.
2. Verify column headers and cell values are announced in the correct order.
3. Verify Open log buttons are reachable by keyboard and retain chamber-specific names.
4. Verify pagination announces updated ranges without moving focus unexpectedly.
5. Keep horizontal overflow contained within the table region; do not introduce page-level horizontal scrolling.
6. Test narrow widths. If six Candling columns are not usable at 375px, decide explicitly between a contained table scroll and a mobile-specific stacked representation rather than allowing accidental wrapping.
7. Verify 200% zoom does not clip actions, status labels, or progress information.

### Phase 5 — Validate and document

Run:

```bash
pnpm --filter eggcelerate-ui typecheck
pnpm --filter eggcelerate-ui test
pnpm --filter eggcelerate-ui build
git diff --check
```

Then recapture both list views at the same viewport and compare:

- page header and toolbar baseline;
- filter and sort control alignment;
- table frame width and top position;
- header typography and color;
- row height and separators;
- status badge treatment;
- pagination placement and behavior;
- keyboard focus order and visible focus ring.

Record completed phases and intentional exceptions in this plan; the original
table audit was a local-only artifact and is not in the tracked documentation set.

## Optional follow-up: higher-level `DataTable`

Do not introduce a generic `DataTable` abstraction before the Candling migration. First make both screens follow the same primitive contract.

After migration, consider a shared `DataTable` shell only if the same frame, pagination placement, header style, and responsive behavior are still duplicated in three or more screens. The abstraction should accept content-specific columns and cell renderers without hiding semantic table markup.

## Acceptance criteria

- [x] Incubators and Candling Logs list modes use the same table primitive family.
- [x] Candling Logs uses native table semantics rather than a grid of `<article>` rows.
- [x] Both list modes use the shared pagination behavior for multi-page results.
- [ ] Search, filters, sorting, and Open log navigation retain their current behavior.
- [ ] Candling-specific progress, checkpoint, journal, and status information remains visible.
- [ ] Table frame, header, borders, row spacing, status colors, and action buttons use the same visual roles.
- [ ] No duplicate “All incubators” heading or standalone result-count section is reintroduced.
- [ ] The Candling grid/card view remains diary-like and functionally unchanged.
- [ ] Keyboard, screen-reader, 375px, desktop, and 200% zoom checks pass.
- [ ] Typecheck, tests, production build, and `git diff --check` pass.

## Non-goals

- Do not change Candling domain calculations, checkpoint rules, or journal data.
- Do not redesign the Summary tiles, search controls, FilterBar, or ViewToggle in this refinement.
- Do not force the Candling grid/card view to look like a table.
- Do not add a new color palette, font family, or table component family.
- Do not change the Incubators page’s operational columns or pagination behavior unless the shared contract requires a bug fix.

## Definition of done

The two pages read as one coherent product system in list mode: users see the same table language and controls, assistive technology receives real table semantics, and each page still exposes the information specific to its workflow.
