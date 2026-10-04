---
name: yuce-category-opportunity-report
description: Analyze one Yuce 一级类目 from supplied monthly Excel workbooks or NAS/yccli data, prepare a local Excel cache for the rolling 24-month first-/second-/third-category market, and create a self-contained HTML research-priority report. Use for 预策一级类目机会研究、类目月度补数与白牌选品方向初筛; not for product/shop ranking deep dives or stocking decisions.
---

# Yuce Category Opportunity Report

Produce a research-priority report for one 一级类目. The Skill has a portable core and a bundled HTML template; ordinary execution does not require `compact-commerce-ui` or any other HTML Skill. Its creation-time visual system follows the compact business-report design, while `assets/report-template.html` and `scripts/build_report.py` own reproducible runtime output.

## I → S → O

- **Input:** one exact Yuce 一级类目 name or source Excel workbooks from which it can be identified uniquely; optional output directory and ending month. Two input routes are supported: supplied `.xlsx` monthly files, or the authorized NAS/yccli collection flow. The analysis window is 24 consecutive completed calendar months, ending at the latest available complete source month unless the user specifies an earlier end.
- **Strategy:** choose the input route → validate and merge raw first-/second-/third-level monthly rows → create one local data-only Excel cache → read that cache for the two-year comparison → diagnose the current category's capacity distribution → create relative large/medium/small-capacity bands → output all three independent research queues with route-specific metrics → preserve a scale benchmark and watch/defer counterexamples → present a concise reading-first judgment page before the detailed evidence views → render and inspect the full report. Only the NAS route checks warehouse coverage, collects gaps, and attempts additive import before cache creation.
- **Output:** one new local Excel cache, preliminary/final analysis JSON, a self-contained HTML report, and a concise receipt recording source coverage, quality findings, and limitations. The NAS route may also create yccli JSON files and a `tbcli db yuce export` snapshot.
- **Authority:** use only the current user's authorized Yuce session and warehouse role. Database writes are limited to the user's requested category-month incremental import through `tbcli`; no ranking data, schema rewrite, or existing-value replacement is implied.

## Runtime Entry And Dependencies

The canonical Skill is bundled in Taobao AI operations. Resolve it with `taobao-ai-ops skill source --name yuce-category-opportunity-report --json`, probe local dependencies with `taobao-ai-ops doctor --node category-research --mode excel --json`, and execute its builder through `taobao-ai-ops script category-research build_report.py ...`. Suite-managed platform commands use `taobao-ai-ops tool run TOOL ...`, preserving the command arguments below. The NAS route still requires its live feature, access and consent checks; Excel remains independently usable.

The local cache builder and report reader require Python 3 and `openpyxl>=3.1`, installed in a stable runtime. Check the actual interpreter/import before running. For the NAS route only, resolve `yccli` and `tbcli` from the executing environment and run their live `--version` and `capabilities --json` before relying on commands. Require `yccli` monthly first/second/third collection and `tbcli db yuce coverage|export`, `yuce categories validate|import`, and database access/write checks. The portable capability contract is in `capabilities.json`; load the current platform adapter. A missing required feature returns `CAPABILITY_UNAVAILABLE`, not an improvised browser/API/database implementation. The supplied-Excel route does not require either CLI, NAS, VPN, or a browser session.

Use raw values from Yuce Excel, yccli JSON, or the tbcli snapshot as source evidence. `scripts/build_report.py` converts the chosen sources to one `.xlsx` cache with only `类目月度缓存` as a data sheet; all analysis calls then use `--cache-xlsx` and never query NAS. Source filenames and SHA-256 hashes travel in cache row columns, not a `元数据` sheet. The Skill itself contains no credentials, company database address, author-machine path, or category-specific facts.

## Main Line

### 1. Resolve Scope And Preflight

Record the exact 一级类目, source mode, 24-month inclusive window, output directory, and new file names. Check existence and metadata before each write. Never overwrite an existing report, cache, source JSON, or database export. If the user supplies Excel workbooks, use those files as the explicit input route: read their data sheets, identify the unique 一级类目, choose the latest complete 24-month source window at or before the previous calendar month, and continue directly to Step 4A. If multiple candidate sets overlap, select the complete 24-month set by actual sheet contents and report which files were selected; never rely on a filename alone. Mixed 一级类目, ambiguous windows, or incomplete first-level data require clarification or a scoped failure. Do not contact NAS or yccli merely to refresh a user-supplied Excel analysis.

If the user supplies no Excel source, continue through the NAS path below. The latest completed calendar month is its proposed end; if Yuce does not offer it, report the available period and ask before shifting the window.

For the NAS path, check `tbcli db network --json`, then `tbcli db status --json` and `tbcli db access-check --json`. If the route or connection fails, perform at most one bounded retry after inspecting the reported network state. Put a finite timeout on the preflight and coverage/export commands; a successful status probe does not establish that a later read completed. Do not change credentials, network configuration, or database roles as part of this Skill.

**Mandatory stop:** if the database still cannot be read, tell the user that the database connection failed and that the next step would collect the full latest 24 months from Yuce. Ask whether they agree. Do not call `yccli` for collection until the user explicitly agrees in this run. If they decline or do not answer, return `DATABASE_UNAVAILABLE_AWAITING_CONSENT` and stop. After consent, enter Step 3 with an empty database snapshot.

### 2. Map Database Coverage (NAS Route)

When the database is readable, run:

```text
tbcli db yuce coverage --category '<一级类目>' --start-month YYYY-MM --end-month YYYY-MM --json
tbcli db yuce export --category '<一级类目>' --start-month YYYY-MM --end-month YYYY-MM --out '<new-snapshot.json>' --json
```

Use full category paths, not only the database's overall min/max month. Record first-level gaps, the union of second-level gaps, and third-level gaps under each known second-level parent. If the 一级类目 is absent, its initial 24-month window is entirely missing. Database coverage cannot prove that Yuce has no newly introduced category; newly collected paths must be compared with the snapshot.

If coverage or export loses the database connection before collection, apply the same bounded retry and mandatory consent stop from Step 1. A successful status probe alone is not sufficient authorization to continue gathering data after the warehouse becomes unreadable.

### 3. Collect Missing Months With yccli (NAS Route)

Run `yccli auth status --json` and let the user complete visible login if needed. Read `references/data-contract.md` at this collection node; it defines command handoffs, contiguous-range grouping, and completeness checks. Use the stable commands only:

```text
yccli industry first-category-monthly --category '<一级类目>' --start-month YYYY-MM --end-month YYYY-MM --out '<new.json>' --json
yccli industry second-category-monthly --category '<一级类目>' --start-month YYYY-MM --end-month YYYY-MM --out '<new.json>' --json
yccli industry third-category-monthly --category '<一级类目>' --second-category '<二级类目>' --start-month YYYY-MM --end-month YYYY-MM --out '<new.json>' --json
```

Collect first-level missing ranges, then second-level missing ranges (one request covers all second categories in that period). Discover the second-level parents from database plus new source rows. For each parent with third-level children, collect the union of known third-child missing months; if that parent has no third-level history, collect its full 24-month range. Keep each CLI call to a contiguous range and preserve every successful file. Do not fetch product or shop rankings in this Skill.

If Yuce reports an unavailable period, verification challenge, category mismatch, or changed report contract, follow yccli's stop behavior. Never bypass login, request pacing, or platform validation. A partial collection may be retained as evidence but cannot be reported as a complete 24-month market.

### 4. Attempt Incremental Database Import (NAS Route)

When database access and maintainer writes are available, run `tbcli db write-check --json`; require the rolled-back probe and zero residue. Initialize the Yuce schema only if it is absent and the maintainer check passed. Validate each new yccli JSON with `tbcli yuce categories validate`, then import in hierarchy order: first, second, each third. The importer inserts missing rows, preserves identical overlaps, and rejects changed existing values. Do not use `upsert`, `replace-range`, or generic `db import` as an automatic repair. After successful import, rerun coverage and export a fresh snapshot for analysis.

If database write access fails or any import fails, record the affected file, reason, and inserted/unchanged counts. Continue the current research from the read snapshot plus verified yccli files; database write success is not a report prerequisite. If the database was unavailable with user consent, skip this step and analyze the full downloaded set.

### 4A. Prepare The Local Excel Cache (Both Routes)

Read `references/data-contract.md` for the exact source and cache columns. For supplied Excel, pass every selected original `.xlsx` file with `--excel`. For the NAS route, pass the latest local tbcli snapshot plus each newly collected yccli JSON; if the post-import snapshot is complete, it may stand alone. Create a new cache file:

```text
python3 <skill-root>/scripts/build_report.py --category '<一级类目>' \
  --start-month YYYY-MM --end-month YYYY-MM \
  [--excel '<source.xlsx>' ...] [--db-snapshot '<snapshot.json>'] [--yc-json '<source.json>' ...] \
  --cache-out '<new-local-cache.xlsx>'
```

Check the cache has exactly one data sheet, 24 first-level months, the expected full category paths at levels 2–3, no conflicting category-month values, and source identity columns. Preserve the original files. Missing lower-level months must be explicit in the next analysis; never fill them with zero. The cache is the only input to Step 5, regardless of how its source data arrived.

### 5. Analyze Market Signals

At this first judgment-heavy node, read `references/SCHEMA.md`, `references/index.md`, recent `references/log.md`, then `references/queries/assess-category-opportunity.md` and only its linked topic page. The method separates user-confirmed research intent, traceable domain knowledge, and provisional ranking heuristics.

First compute a preliminary analysis sidecar without rendering:

```text
python3 <skill-root>/scripts/build_report.py --category '<一级类目>' \
  --start-month YYYY-MM --end-month YYYY-MM --cache-xlsx '<local-cache.xlsx>' \
  --analysis-out '<new-preliminary-analysis.json>' --analysis-only
```

The script reconciles duplicate category-month keys, rejects conflicting amounts, requires 24 complete first-level months, computes two comparable 12-month periods, month-matched year-over-year growth, recent-six-month year-over-year growth, all 24 monthly amounts for every path, and parent/child differences. It surfaces incomplete child histories. Research queues are quantitative signals, not judgments that a white-label seller can profitably enter. The initial run produces relative capacity bands and all three routes for review against this category's distribution.

Inspect the full analysis JSON and its `marketRoutes`. Use the actual distribution of complete, positive-GMV 三级 paths within this 一级类目: count, median, p10/p90, top-decile GMV share, ties, missingness, and ±5-percentage-point boundary sensitivity. Capacity is relative to this population, never a fixed currency cutoff or copied kitchen threshold. Default P40/P70/P90 is a provisional starting point: below P40 is the small-capacity watch area; P40–P70 is medium-small; P70–P90 is medium; P90 and above is large. Quantile boundaries use linear interpolation, ties stay together and boundary values enter the higher band. Sparse/tied populations may produce empty routes. Diagnose whether taxonomy breadth, skew or the user's sales ambition calls for different quantile positions; record the evidence and review rather than claiming automatic economically optimal bands. A statistical middle market is not necessarily commercially sufficient.

Write a new `--strategy-config` JSON with only these fields (all except `why` may retain defaults):

```json
{
  "capacityQuantiles": [0.4, 0.7, 0.9],
  "minYoy": 0.2,
  "minSixMonthYoy": 0.2,
  "minPositiveMonths": 10,
  "shortlistLimit": 6,
  "why": "Explain the observed distribution, sensitivity, user objective and why these relative boundaries are suitable."
}
```

No absolute-money capacity override is accepted. Small numeric boundary changes must be justified, not tuned to include a favorite product. The growth defaults remain provisional, not universal. Rerun using the same cache, `--strategy-config '<new-policy.json>'`, `--analysis-out '<new-final.json>'`, and `--html-out '<new-report.html>'`. Old `--decisions` single-queue files require explicit migration; never reuse a prior absolute floor. Preliminary and final files are separate. Do not hand-edit calculated metrics.

Always output all three routes, even if one is empty:
- **Large-market increment:** capacity in the relative top band; rank by `100 × max(annual increment,0) / root annual GMV × positive-month count / 12`.
- **Medium-capacity sustained growth:** capacity in the middle band; rank by `100 × min(annual YoY, recent-six-month YoY) × positive-month count / 12`.
- **Medium-small-capacity growth:** capacity in the lower selected band; same growth-strength metric, ranked independently from medium markets.

All routes require complete 24 months, positive annual GMV, calculable base-period growth, both reviewed growth floors and positive-month coverage. Mixed “其他/其它” buckets stay in the all-category table but require decomposition before shortlist selection. Rank with full precision, tie-break by positive-month count and full path; retain all pool paths and take up to N per route. Never mix unlike metric values into a global winner list. The flattened candidatePaths is a route-ordered union for rendering, not an overall ranking. Keep the largest complete class as a scale benchmark, plus measured watch/defer counterexamples.

For each leaf calculate capacity band, midpoint-tie percentile, independent route rank, both indices, first-half and last-half same-period YoY, their percentage-point difference, and largest-three-month positive-increment share. These are descriptions, not causal predictions. Annual and six-month comparisons overlap; they are not independent confirmations. Concentrated increments may reflect normal seasonality. Missing/zero-base comparisons remain unknown, not fabricated zeroes.

Category monthly totals support research prioritization only. Keep brand competition, white-label access, differentiation and profitability unverified. Before costly product deep-dives recommend a lightweight, separately authorized product/shop-ranking check, with sample coverage and brand classification uncertainty. Smaller markets are not presumed to have weaker brands.

### 6. Audit And Deliver

Every table region must provide independent **Table / Chart** views, defaulting to Table. This includes opening route previews, full route shortlists, market structure, monthly series, matched-month comparisons, watch/defer and the full category table. Render charts from embedded full-precision source arrays, never by parsing rounded display strings. Monthly comparisons use lines with explicit month labels and gaps for missing values; categorical comparisons use grouped bars with a zero baseline, including negative values. Separate metric/unit groups via a selector, with series visibility controls; unlike ranking indices remain separate even if both use points. Provide axis units, legend and exact-value point/bar tooltips. Missing values remain missing; empty filters and hidden series have explicit messages.

Charts track the same table rows, filters and sort order. Paginate long category charts with visible range/total and previous/next controls; never silently chart only top rows. Preserve the full table and its exact-number access, navigation links and existing filtering/sorting. Charts are self-contained SVG with no remote runtime/assets. On narrow screens chart canvases scroll within their own region; keyboard controls have labels and visible focus. Print all tables and any actively selected chart with its visible-page range. Test every table has a valid chart spec and identical numeric evidence, negative/zero/missing cases, group/series/view controls, pagination and filter/order synchronization. If browser access is blocked, report visual/real-browser interaction checks as unverified, independently of deterministic tests.

The report starts with three plain-language market judgments and **all three route summaries**; each route shows its capacity range derived from this dataset, population → growth pool → shortlist counts, metric, and linked candidate comparisons. Keep formulas/distribution detail expandable. Different users can compare/select markets without changing data or silently hiding another route.

Preserve market-structure and 24-month first/second-level tables; a complete shortlist for each route; one submenu/detail page per shortlisted category plus benchmark with numbered interpretations and 12 matched-month rows; measured watch/defer cases; and one unified sortable/searchable table of every third-level path. The all-category table supports second-parent, coverage, and capacity-route filters and shows both metrics, route rank, relative percentile, trend change, concentration, and exclusion reasons. Incomplete and below-boundary paths remain visible. Empty routes explicitly state why. Amounts are displayed for interpretation but never define reusable segmentation constants.

Verify each selected path is the route's actual top N with no manual insertion. Check a scaled copy of the data has the same assignments/rankings; validate ties, small populations, empty/declining/zero-base cases, missing months, malformed policy and absolute-cutoff rejection. Confirm all three route summaries, unique all-category rows, exact pool membership, linked detail pages, numeric sorting, search, mobile navigation and print visibility. Do not call a main run a clean regression.

Deliver HTML, cache link, analysis JSON and reviewed policy; report coverage, all-route counts, distribution rationale, sensitivity and missing competition evidence. NAS receipts retain the existing collection/import boundary. Clean-context regression requires an explicit user request.

## Branches And Return Points

- **Database connection fails before collection:** stop and ask for consent as in Step 1. Consent returns to Step 3; refusal ends the run.
- **Supplied Excel:** enter Step 4A directly and return to Step 5 after cache QA. Database/yccli errors and consent gates do not apply because this route performs no live collection or import.
- **Database readable, target empty:** collect the full 24 months and return to Step 4.
- **Database write fails:** preserve local JSON, mark `IMPORT_DEFERRED`, return to Step 5.
- **Overlapping source conflict:** preserve both sources, mark `SOURCE_CONFLICT`, stop report synthesis until the category-month value is resolved. Never silently replace warehouse history.
- **Incomplete source or parent/child anomaly:** identify exact paths and months; withhold unsupported growth comparisons. A complete first-level window is mandatory. Return to Step 3 if a supported missing range can be collected; otherwise report partial evidence and stop.
- **HTML template or renderer fails:** preserve data and analysis, report `OUTPUT_CONTRACT_FAILED`; do not hand-edit the generated HTML.

## QA And Evolution

The bundled `scripts/market_routes.py`, `scripts/build_report.py`, `assets/report-template.html` and `assets/chart-views.js` implement the calculation/rendering contract `yuce-category-opportunity@2.0`. Keep the local-cache and source-conflict safeguards. Report changes belong in these reusable resources rather than hand-edited output. Development tests verify relative segmentation, policy provenance, route ranking, evidence completeness and UI interactions. Run the Python tests plus `node tests/test_navigation.cjs` and `node tests/test_chart_views.cjs` from the Skill directory; Node is a development-test dependency, while delivered HTML needs no external library or service. Synthetic DOM checks do not establish actual browser layout quality. Capacity/growth thresholds remain reviewable hypotheses. Agent/platform runtime compatibility and clean-regression evidence must be reported separately.
