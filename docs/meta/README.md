# docs/meta — Project Meta Documentation

> Authoritative, code-verified documentation for the **Eggcelerate UI** prototype.  
> Created: 2026-08-21 · Location: `docs/meta/` · Scope: current working tree (`src/`, `docs/`, `flow/`, `vite.config.ts:1`, `package.json:1`, `tsconfig.json:1`)

This folder is the **single source of truth** for high-level project understanding. It consolidates and supersedes fragmented prior docs (`docs/frontend-review.md:1`, `docs/tech-stack.md:1`, `docs/glossary.md:1`, `flow/EGGCELERATE_Final_Dashboard_Specification.md:1`) with evidence linked by `file:line`.

## Why `meta`?

| Problem before | What `meta` fixes |
|---|---|
| Docs drifted from `package.json:11` (listed removed MUI, wrong deps) | Every table cites `package.json` + `src/` |
| 6+ review docs in `review/` + `docs/codex/README.md:1` + `flow/` with overlapping verdicts | One indexed review + roadmap in `docs/meta/review.md` + `docs/meta/roadmap.md` |
| Domain rules scattered across `src/app/data/mockData.ts:1` + `src/app/domain/cycle.ts:1` + `flow/EGGCELERATE_Final_Dashboard_Specification.md:1` | Consolidated in `docs/meta/domain.md` |
| No UI inventory / design-token map | `docs/meta/ui-design-system.md` |
| `docs/` was gitignored (`.gitignore:30`) so knowledge was invisible to contributors | `.gitignore:36` now keeps `docs/meta/**` tracked |

## Contents

| # | Document | Purpose | Primary sources |
|---|---|---|---|
| 0 | `README.md` (this file) | Index + maintenance contract | — |
| 1 | `review.md` | Code-verified project review — what works, what doesn't, with file:line evidence | `src/app/App.tsx:1`, `src/app/data/mockData.ts:1`, `src/app/domain/cycle.ts:1`, all screens |
| 2 | `architecture.md` | Frontend + system architecture, data flow, build pipeline | `src/main.tsx:1`, `src/app/App.tsx:36`, `vite.config.ts:7`, `src/styles/theme.css:1` |
| 3 | `domain.md` | Domain model, cycle phases, severity, candling, hatchability, data contracts | `src/app/domain/cycle.ts:1`, `src/app/data/mockData.ts:13`, `flow/EGGCELERATE_Final_Dashboard_Specification.md:6` |
| 4 | `ui-design-system.md` | Component inventory, design tokens, theming, accessibility notes | `src/styles/theme.css:3`, `src/app/components/ui/`, `src/app/components/AppSidebar.tsx:1` |
| 5 | `roadmap.md` | Gaps, risks, production checklist, phased delivery | `docs/codex/README.md:146`, `src/app/data/mockData.ts:188` |

## How to use

1. **New contributor?** Read `review.md` → `architecture.md` → `domain.md` in order. Each is self-contained and cross-linked.
2. **Building a feature?** Check `domain.md` for the type/contract and `ui-design-system.md` for the token/component to reuse.
3. **Planning integration?** `architecture.md:1` + `roadmap.md:1` define the backend boundary (REST + WS, DTOs, state layer).
4. **Updating docs?** Edit only `docs/meta/*`. Older docs under `docs/` and `flow/` are historical — do not duplicate edits there.

## Maintenance contract

- **Verification:** claims cite `file:line`. If you change code, update the corresponding `meta` file in the same commit.
- **Review cadence:** re-verify `review.md` after any screen, `mockData.ts:1`, or `cycle.ts:1` change.
- **Git:** `docs/meta/**` is tracked via `.gitignore:36`. All other `docs/*` remain ignored except `docs/README.md:1`.

## Quick links

- Entry: `src/main.tsx:1` → `src/app/App.tsx:1`
- Strict TS: `tsconfig.json:15`
- Tokens: `src/styles/theme.css:3`
- Mock boundary: `src/app/data/mockData.ts:188` + `src/app/data/account.ts:1`
- Spec source of truth: `flow/EGGCELERATE_Final_Dashboard_Specification.md:1` (896 lines, 38 sections)

## Related external docs

- ADRs: `docs/adr/ADR-001-iot-communication-protocol.md:1` … `ADR-007-telemetry-schema.md`
- Latest code review: `docs/codex/README.md:1` (2026-08-15)
- Guidelines template: `docs/Guidelines.md:1`
