# M5 loading and CI handoff — October 3, 2026

Status: **complete locally** for the protected dashboard pilot. Evidence applies
to `experiment` at `cc188ea` plus the uncommitted M0–M5 working tree. This batch
changes frontend loading and verification configuration; no API schema, device
firmware, deployment, or production data changes were performed.

## Delivered behavior

- Settings and Incubators load on demand through the existing recoverable lazy
  loader. Each has a Suspense fallback inside the screen recovery boundary;
  navigation, session behavior, and feature-error recovery are preserved.
- The vendor matcher now selects exact `react`, `react-dom`, and `scheduler`
  package paths. Previously it also matched packages such as `react-smooth`,
  loading chart-related code before Trends was opened. That code now stays lazy.
- Baloo 2 and Nunito variable WOFF2 files are served locally with the original
  supported weight ranges and all supplied Unicode subsets. Their upstream SIL
  Open Font Licenses and provenance are included. The Google Fonts stylesheet
  request chain and external font-service dependency are removed.
- Image/icon review found the app logo was already a 4.14 kB WebP, unused source
  images were not emitted as eager imports, and the selected icons were tree-shaken.
  The measured savings came from route imports, the vendor matcher, and font
  delivery. Browser-selected public icons are included in asset measurement.
- Production builds emit the Vite manifest and module-size report. The asset gate
  follows static dependency closures, CSS resources (including public files), and
  HTML-linked assets, deduplicates shared files, and measures incremental lazy-route
  costs. Missing files/routes, excessive sizes, and unbudgeted external resources fail.
- The web CI job runs the full Vitest suite once with coverage, retaining the
  seven-screen coverage gate. It separately runs Node asset-guard tests, builds,
  checks budgets, and publishes coverage/loading reports for 14 days. The API job's
  live HTTP contract gate is retained. Vitest uses two workers and discovers only
  `src/tests` TS/TSX suites, avoiding discovery of the separate Node suites.

## Bundle measurements

Values below are decimal kB; gzip sizes are computed per file, not a production
server compression measurement. Route figures include additional static imports
above the initial closure, so shifting dependencies between chunks stays visible.

| Measurement | Before M5 | After M5 |
| --- | ---: | ---: |
| Main JS, minified / gzip | 594.46 / 162.17 kB | 487.80 / 136.95 kB |
| Vendor JS, minified / gzip | 183.89 / 58.39 kB | 143.50 / 45.98 kB |
| Total initial JS, minified / gzip | 778.35 / 220.57 kB | 631.30 / 182.94 kB |
| Initial CSS, minified / gzip | 95.81 / 18.04 kB | 98.28 / 18.65 kB |
| Settings incremental gzip | Eager | 17.70 kB |
| Incubators incremental gzip | Eager | 24.11 kB |
| Trends incremental gzip | 117.59 kB | 129.30 kB |
| Detail incremental gzip | 45.33 kB | 55.14 kB |
| Candling incremental gzip | 7.97 kB | 13.39 kB |

Initial JS gzip decreased by **17.1%**. Some route costs increased because shared
code moved out of the initial payload. No JS chunk exceeds 500 kB; the prior Vite
warning is resolved rather than silenced by raising its threshold.

## Browser loading measurement

Firefox, cold contexts, viewport 393×852, default mock repository with 350 ms
latency. Profile injects 150 ms per-request latency and a shared 200,000 bytes/s
download allowance (1.6 Mbit/s). Loopback previews serve uncompressed assets;
real request overhead is additional. Repeated identical resources are cached in
the harness because Playwright interception disables normal browser HTTP caching.
CPU is not throttled and this is not a physical-phone or deployed-Azure test.

| Cold overview measurement | Before M5 | After M5 |
| --- | ---: | ---: |
| Complete response bodies, including used fonts/icons | 1,016,949 bytes | 857,199 bytes |
| Distinct requests | 10 | 9 |
| Overview heading ready, two runs | 5.66 / 5.93 s | 5.01 / 4.94 s |
| Fonts loaded + network idle, two runs | 6.45 / 6.78 s | 5.39 / 5.36 s |
| Runtime/request errors | 0 | 0 |

Observed bodies decreased by **15.7%**. Timings are two local samples, not a latency
SLA or percentile claim. Baseline external font requests also incur external fetch
latency. The optimized checks requested no external assets.

Reproduction: [loading harness](repro/m5_browser_loading.js) and
[route/recovery checks](repro/m5_browser_routes.js), invoked through Playwright CLI
`run-code --filename`. Save the pre-change `dist` to ignored `output/m5/baseline`
before rebuilding, serve it on loopback 5177, and serve the current build on 5176.
Run the browser checks in Firefox. Local JSON evidence is in ignored `output/m5/`;
it is not a committed release artifact.

## Engineering budgets

Limits are recorded in `apps/web/asset-budgets.json`, chosen from these measurements
with modest regression headroom. They are implementation guardrails within the
authorized M5 scope, not independently agreed product latency requirements.

| Guard | Current | Limit |
| --- | ---: | ---: |
| Main JS gzip | 136,952 bytes | 145,000 |
| Total initial JS gzip | 182,936 bytes | 195,000 |
| Initial CSS gzip | 18,647 bytes | 22,000 |
| All initial assets, conservative transfer estimate | 591,150 bytes | 620,000 |
| Any minified JS chunk | Largest 487,800 bytes | 500,000 |
| Settings / Incubators incremental gzip | 17,701 / 24,111 bytes | 30,000 each |
| Trends / Detail incremental gzip | 129,303 / 55,143 bytes | 160,000 / 65,000 |
| Candling incremental gzip | 13,388 bytes | 22,000 |
| Onboarding steps 2 / 3 incremental gzip | 1,936 / 2,132 bytes | 10,000 each |

The conservative initial estimate includes all nine declared font subsets and all
HTML-linked icons, even though the measured overview requested only two font
subsets and selected icons. Binary files are counted raw; JS/CSS/HTML use gzip.
API data, HTTP headers, and different deployment compression are outside this gate.

## Verification and failure disposition

- **281 frontend tests across 38 files passed** with coverage and all seven screen
  modules included. Existing coverage thresholds were not lowered.
- **2 Node asset-report tests passed**, covering cyclic/shared imports, lazy
  exclusion, binary/public CSS assets, excessive budgets, missing routes/files,
  and external-resource rejection.
- Biome lint, TypeScript, production build, asset budgets, and diff whitespace checks pass.
- Firefox direct navigation to Settings, Incubators, Trends, Candling, and chamber
  detail passed at mobile width, with no runtime errors or external asset requests.
- A deliberately blocked Settings chunk retained the shell, displayed recovery,
  and recovered via explicit retry/reload. Subsequent navigation and browser Back passed.
- An initial run discovered the Node test as a Vitest suite, exposed an assertion
  that Settings recovery was synchronous, and had timing failures during high
  parallel contention. Separate discovery, waiting for the lazy Settings input,
  a bounded lazy-Trends wait, and two workers resolved these without removing
  tests or weakening coverage. The final full coverage run passed in 59.35 s.

No backend behavior changed, so API, migration, and live-contract suites were not
rerun for M5; their latest evidence remains the M4 checkpoint. CI configuration
and commands were verified locally; GitHub runner results and required-check
enforcement still require external evidence. Reports omit secrets; font downloads
are committed assets, not build-time network dependencies.

## Next action and rollback

Next: M6 module/database maintainability and write-scale measurement. M0 firmware
source/inventory details, M7 Azure operations, M8 approved device integration,
and M9 pilot acceptance remain open.

Rollback this batch by restoring eager Settings/Incubators imports, the prior
vendor rule and font delivery, and the prior build/CI scripts/configuration. No
database downgrade is needed. Use a fresh page load after changing hashed bundles.
