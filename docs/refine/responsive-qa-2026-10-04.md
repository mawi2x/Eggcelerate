# Responsive frontend QA — October 4, 2026

Completed locally against the current working tree in Chromium, using the Vite development server and fixture repository. The UI/UX review focused on wrapping, container fit and usable dialogs. No physical-device or deployed-service verification is implied.

## Coverage and findings

| Check | Coverage | Result |
| --- | --- | --- |
| Route/viewport matrix | Overview, Incubators, Candling, Trends, Alerts, Settings and chamber detail; widths 320, 375, 639, 640, 767, 768, 900, 1023, 1024 and 1440px at 800px height; each route also at 1024×480 | 77 cases; no document horizontal overflow or uncaught JavaScript errors |
| Visual review | Captured all seven routes at 320/900/1440px; inspected representative narrow screens and Trends tablet layout | Confirmed Trends title/control overlap at 320px and crowded toolbar actions at tablet width |
| Corrected Trends header | All 10 widths above | Title and metric control rectangles no longer overlap; no document overflow |
| Synthetic long chamber name | 320/375/768/1024px at 480px height | Name wraps without document overflow; text injected into browser DOM only, never persisted |
| List view | 768/1024px | No document overflow; mobile intentionally uses cards without the list toggle |
| Add Incubator dialog | 320/375/768/1024px at 480px height | Dialog stays within viewport; Escape dismisses it; mobile and tablet screenshots inspected |
| Automated regressions | Dashboard controls, mobile operation and screen rendering | 17 tests across 3 files passed |
| Build checks | Typecheck, production build, asset budgets | Passed; initial JS gzip 188,222 bytes |
| Sizing audit | Refreshed source hashes and occurrence tables | Passed; 409 direct pixel occurrences unchanged |

## Fix

`TrendsScreen.tsx` now lets the chart title and metric selector wrap onto separate rows when their combined width exceeds the card. A flexible title basis preserves a readable text column; target-range text can wrap. The toolbar action group can also wrap, and the readings button uses a minimum height so a longer caption can grow without clipping.

The first resize captures were taken before the sidebar's 200ms layout transition finished and showed transient narrow content. Repeated captures wait 400ms after resize; the settled Incubators layout is correct. No sidebar change was needed.

## Reproduction

Start the local fixture-mode frontend at `http://127.0.0.1:5176`, open a Playwright CLI session, then run:

```sh
playwright-cli run-code --filename=docs/refine/repro/responsive-qa.js
playwright-cli run-code --filename=docs/refine/repro/responsive-stress-qa.js
```

The scripts save screenshots under `output/playwright/`. Examples: `trends-fixed-320.png`, `trends-fixed-900.png`, `long-name-320.png`, `add-dialog-320.png` and `add-dialog-768.png`. This directory contains local artifacts, not release evidence from real devices.

This closes the representative responsive QA batch. Browser zoom/text scaling, fractional breakpoint edges, every nested tab/modal and every API failure state were not exhaustively exercised here. Broader operator journeys and cross-browser/device qualification remain part of M9. The documented 640–767px typography tier is preserved.
