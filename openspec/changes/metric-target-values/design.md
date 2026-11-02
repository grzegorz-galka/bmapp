# Design

## Context

See `proposal.md` for why. What already exists and shapes the approach:

- **Threshold versions** (`metric_thresholds`) hold four absolute boundaries,
  `green_lo`, `green_hi`, `amber_lo` and `amber_hi`, as `NUMERIC(21, 6)`.
  Which of them are set depends on the direction. Check constraints keep the
  pairs and their order consistent, and `ck_metric_thresholds_some_bound`
  requires a green boundary. Versions are append-only. Of two versions on the
  same date, the one recorded later is in force (`threshold_in_force`).
- **The status rule** is the pure `status_of(direction, value, manual,
  bounds)` in `app/services/metric_status.py`, exercised by
  `metric_status.feature`. Every reader calls it: the board, the trend, the
  recording view and the dashboard.
- **Reads draw boundaries.** `ThresholdRead` returns the four boundaries.
  The recording view prints them, and the trend chart draws them as a stepped
  line or band. No reader works out a status itself.
- **Requests are shaped by direction.** `ThresholdCreate` takes `green` and
  `amber` for a one-sided metric, or the four `*_lo`/`*_hi` fields for a
  band, and refuses the wrong shape with `request.invalid_field` against the
  field.
- **Placement properties** (group, position, owner, retirement on the board)
  live on `board_metrics`. Readers see them through `BoardMetric`'s
  properties under the names a metric read model expects.
- **The demo data** (Railway, read on 2026-11-01): 3 boards and 46 threshold
  versions. See *Migration Plan* for how each converts.

## Goals / Non-Goals

**Goals:**

- `status_of` and every reader of boundaries stay as they are. A target
  value is resolved into boundaries before anything judges or draws.
- No colour changes when the schema migration runs. A colour changes only
  through a version someone records, which the conversion script makes
  explicit.
- One new error code at most.

**Non-Goals:**

- Storing resolved boundaries. They are computed on read, like status.
- A per-metric default tolerance. Each version states its own.
- Requiring a threshold before a metric can exist. A metric with no
  version keeps `no_threshold` (decision 6).

## Decisions

### 1. The target value lives in the threshold version, not on the metric

A version gains `target_value NUMERIC(21, 6) NULL`, `green_pct
NUMERIC(21, 6) NULL` and `amber_pct NUMERIC(21, 6) NULL`.

**Why:** the target value moves over time. The legacy tool had one per week,
and "Zatrudnienie wg planu miesięcznego" changed seven times since April.
Each past meeting must be judged against the target value of its own date,
which the version mechanism already does: effective dates, back-dating,
the later-recorded version winning on the same date, and copying.

**Alternative:** a `metrics.target_value` column with its own history table.
That duplicates the versioning and leaves two dates to reconcile, the
target's and the threshold's.

### 2. The mode is implied by the target value, not stored

A version uses tolerances when it has a non-zero target value. It uses
boundaries when its target value is 0, or when it has none (decision 4).
There is no `mode` column and no `mode` request field.

**Why:** the rule agreed is "range only when the target value is 0". A
stored mode could contradict it, and a request field would be one more
thing to get wrong. The check constraints state the rule directly:

```
ck_metric_thresholds_tolerance_shape:
  (target_value IS NOT NULL AND target_value <> 0)
    = (green_pct IS NOT NULL AND amber_pct IS NOT NULL)
ck_metric_thresholds_tolerances_or_bounds:
  green_pct IS NULL OR (green_lo, green_hi, amber_lo, amber_hi all NULL)
ck_metric_thresholds_tolerance_order:  0 <= green_pct AND green_pct <= amber_pct
ck_metric_thresholds_some_bound (replaced):
  green_pct IS NOT NULL OR green_lo IS NOT NULL OR green_hi IS NOT NULL
```

The existing pair and order constraints on the four boundaries stay as they
are. They bind only where boundaries are present.

**Alternative:** an explicit `mode` enum. It was rejected for the reason
above. It would only be worth having if a non-zero target value ever needed
absolute boundaries. If that need appears, it would be a new decision.

### 3. A version resolves into boundaries; `status_of` is unchanged

A pure `bounds_of(direction, version) -> Bounds` sits beside `status_of`.
A version with tolerances becomes the four boundaries its direction uses,
with d = |T| × p / 100:

```
higher_is_better : green_lo = T - d(g)    amber_lo = T - d(a)
lower_is_better  : green_hi = T + d(g)    amber_hi = T + d(a)
within_band      : green T -/+ d(g)       amber T -/+ d(a)
```

A version with boundaries is returned as it is.

- **Callers.** Every caller that passed a version to `status_of` passes
  `bounds_of(direction, version)` instead.
- **Exact arithmetic.** It is `Decimal` throughout. Multiplying two numbers
  of at most 6 places, and dividing by 100, is exact within Python's default
  28-digit context for anything `NUMERIC(21, 6)` holds. A value is therefore
  judged against the exact boundary, never a rounded one (spec: "A tolerance
  that does not divide evenly").
- **|T|** makes a negative target value behave (eNPS), and "only the worse
  side counts" falls out of the one-sided boundaries.

**Alternative:** compute a deviation percentage per value and compare it
with the tolerances. It is equivalent, but it would need a second rule in
`status_of`, and the chart would still need boundaries to draw.

### 4. Versions recorded before this change keep their boundaries and no target value

`target_value` is nullable. A NULL target value means the version is read
as boundaries. No existing row is edited: versions are append-only, and the
spec requires that no status changes on migration. The API returns such a
version with `target_value: null`.

**Alternative:** back-fill target values in the migration. It was rejected
because it would rewrite history, and for most demo versions the target
value cannot be derived exactly (*Migration Plan*).

### 5. API shape: additive on read, one required field on write

- **`ThresholdCreate`** gains `target_value` (required), `green_pct` and
  `amber_pct`. Shape is checked in two steps:
  1. by target value: non-zero requires both tolerances and refuses every
     boundary field; zero requires the boundary fields and refuses the
     tolerances;
  2. by direction, as today, when the target value is 0.

  Each refusal is `request.invalid_field` against the field, matching the
  existing shape errors. Tolerances must fit `NUMERIC(21, 6)`.
- **Error codes.**
  - A tolerance below 0 is `threshold_tolerance.negative`, the one new code.
  - `amber_pct < green_pct` is `threshold.order_invalid`, reused because it
    is the same rule ("amber is never tighter than green").
- **`ThresholdRead`** gains `target_value`, `green_pct` and `amber_pct`.
  Its four boundary fields now carry the **resolved** boundaries, so the
  board, the recording view, the trend and the catalogue keep reading the
  same fields. Resolved boundaries may have more than 6 places. They are
  serialised exactly, like other `ExactDecimal`s, and charts plot them as
  floats.
- **`BREAKING`.** A writer that omits `target_value` is refused. The
  frontend is the only writer and changes in the same change. The legacy
  import writes through the models and is updated too.

### 6. "Every metric has a target value" means every new version has one

The requirement is met at the version level: no version can be recorded
without a target value. A metric with no version at all still exists and
reads `no_threshold`, as today.

**Why:**
- The demo has seven such metrics with values: both "Utylizacja"
  (CKI-P and CKI-P PUR) and all four of CKI-P PUR's.
- Forcing a version at creation would block the migration and the copy
  of a metric without thresholds, for no gain over the `no_threshold`
  status the board already shows.

### 7. "Hidden" is a column on the placement

`board_metrics.hidden BOOLEAN NOT NULL DEFAULT false`, surfaced as
`hidden` on the metric read models. It is settable through the existing
change-metric request, and through an optional `hidden` (default `false`)
on the three requests that add a metric to a board: create, copy and
include.

- **Global metrics.** For an included global metric it is a placement
  change, allowed alongside group, owner and retirement.
- **Copies.** A copy never takes the source's `hidden`, as it takes no
  placement properties. It is hidden only when the copy request asks.
- **The board of a meeting** still returns every active metric, hidden ones
  included, with `metric.hidden`. The board page leaves hidden metrics
  out of the tiles and out of the group headings. The recording view lists
  them. Completeness and `owing_by_meeting` already count active
  placements, so they need no change.

**Alternative:** the backend leaves hidden metrics out of the board
payload. It was rejected because the recording view and completeness read
the same payload, and a second endpoint for them is not worth it.

### 8. The frontend

- **Threshold form** (`features/metrics/thresholds.tsx`, shared by the
  settings page and the catalogue):
  - A target value field always.
  - Two tolerance fields in per cent when it is not 0, or the direction's
    boundary fields when it is 0. Switching between the two keeps what was
    typed in each.
  - The form shows the boundaries the tolerances amount to as the user
    types, computed with the same formula, for information only. The
    server's resolved boundaries are what is stored and shown afterwards.
- **`display.tsx`** reads a version as "target value 72.3 · green ±5% ·
  amber ±10%". It uses "−" for `higher_is_better`, "+" for
  `lower_is_better` and "±" for a band. A version without a target value
  reads as its boundaries, as today.
- **The metric detail** adds a stepped target-value line, drawn from
  `threshold.target_value` per point.
- **The settings page** gets a "Hidden on board" switch per metric, the
  same switch in the create, copy and include dialogs (off by default), and
  a mark on hidden rows.
- **Catalogue strings** go into both `en.ts` and `pl.ts`, with "wartość
  docelowa" for target value and "tolerancja" for tolerance.

## Risks / Trade-offs

- **[Risk] A resolved boundary with many places looks odd in the recording
  view** (e.g. 89.99999985). → The view formats boundaries with the metric's
  decimals, as it formats values. Status is decided on the server against
  the exact number, so the display rounding never changes a colour.
- **[Risk] Default conversion is mechanically exact but semantically wrong.**
  "Aneksy" from 2026-10-19 (green up to 5, amber up to 10) converts by
  default to target value 5 with tolerances 0% and 100%. The intended
  target value is 0, which keeps the range. → The conversion script takes
  per-metric overrides, and its report lists every converted version with
  its new reading for a person to check before `--apply`.
- **[Risk] Two people record versions while the conversion runs.** →
  Conversion versions are recorded with `recorded_at` at the run's time.
  A version recorded later on the same date still wins, as it should.
- **[Trade-off] A history of two versions per date after conversion** (the
  original and its target-value twin). The threshold history shows both.
  The reason "Conversion to target value" explains it, and the history stays
  honest about what judged each meeting when.

## Migration Plan

### Step 1: schema (Alembic `0010_add_threshold_target_values`)

1. Add `metric_thresholds.target_value`, `green_pct` and `amber_pct`, all
   nullable.
2. Replace `ck_metric_thresholds_some_bound`, and add the constraints of
   decision 2.
3. Add `board_metrics.hidden` with default `false`.

Existing rows satisfy every constraint unchanged, since their target value
is NULL. No status changes. Downgrade drops the columns and restores the
old constraint. It is refused while any version has a target value, because
dropping it would lose a recorded version's meaning.

### Step 2: conversion (`scripts/convert_thresholds.py`)

Run from `backend/` per database, dry-run by default:

```
uv run python -m scripts.convert_thresholds [--mapping MAPPING.csv] --actor you@pse.pl [--apply]
```

For each metric and each existing version without a target value, it
proposes a twin version with the same effective date, recorded now, with
the reason "Conversion to target value: <rule>":

1. **The mapping file wins.** A CSV with the columns `team` (empty for a
   global metric), `metric`, `effective_from` (empty meaning every version
   of the metric), `target_value`, `green_pct`, `amber_pct`,
   `green_lo`, `green_hi`, `amber_lo`, `amber_hi` and `accept_changes`
   (yes/no). Target value 0 takes boundaries; anything else takes
   tolerances.
2. **Otherwise the default:**
   - One-sided version: target value = the green boundary, green 0%, amber
     = |green − amber| / |green| × 100.
   - A green boundary of 0: target value 0 with the same boundaries.
3. **Not convertible by default:** a band, or a default amber tolerance
   that does not fit in 6 places. These are listed as needing a mapping row,
   and nothing is proposed for them.

**Verification.** For every recorded value of every affected metric, the
script computes its status under the version in force now and under the
version in force after conversion. A value whose colour would change is
listed. With `--apply` the script writes, in one transaction, only when:

- nothing is listed as needing a mapping row, and
- every listed status change belongs to a metric whose mapping row says
  `accept_changes=yes`.

Otherwise it writes nothing and exits non-zero. Values set by hand keep
their colour and are not listed.

A metric with no version gets nothing; its leader records a first version.
"Realizacja PF" is in that position in effect: its version needs a mapping
row, and the right fix is a corrected target value.

### What the demo needs

Read 2026-11-01, 46 versions:

| Outcome | Versions | Metrics |
|---|---|---|
| Converts exactly by default (gap 0: green = amber) | 26 | Przychód ×2 boards, Przychód UoP, Zatrudnienie wg planu miesięcznego (7), Zatrudnienie wg planu rocznego, Pokrycie wakatów (Apr), OTIF projektów KPI (Apr), OTIF E (May), eNPS, NPS klienta (Sep), Pracochłonność, Utylizacja Zarząd (Apr–Oct 7) |
| Target value 0, stays a range | 2 | Aneksy (Apr), Prace awansem |
| Exact by default but wrong; needs a row | 1 | Aneksy (Oct 19): target value 0, green ≤ 5, amber ≤ 10 |
| Needs a mapping row (inexact default) | 17 | OTIF projektów KPI, OTIF E and its six units (Oct 19, 95/90); Pokrycie wakatów (Oct 19, 99/97); NPS klienta (Oct 19, 30/10); Utylizacja Zarząd (Oct 19, 71.6/71); CKI-P: OTIF-Sprint, OTIF-Etap ×2, Projekty on track, Skuteczność rekrutacji, Realizacja PF |

A draft of the mapping rows to confirm is under *Open Questions*.

### Rollback

- **Step 2** is undone by recording newer versions. That is the only
  correction an append-only history allows, and it keeps the record of what
  happened.
- **Step 1** downgrades cleanly before step 2 has run anywhere.

### The legacy import

`import_legacy_board.py` writes each legacy week's rule as a version with a
target value:

- the week's target, or the KPI's fixed `green`, becomes the target value;
- for a one-sided KPI, the tolerances are green 0% and amber
  `gap / |target| × 100`, quantised to 6 places;
- a KPI whose target is 0 gets a range;
- a band KPI gets the centre of `lo..hi` as its target value, a green
  tolerance of half the band's width and an amber tolerance of that plus
  `gap`, each as a share of the centre and quantised the same way. A band
  centred on 0 gets a range.

The existing `hand_colour` step already keeps a legacy colour wherever the
rule would give another. Quantising the tolerances therefore can never
change what the imported board shows.

## Open Questions

- **The mapping rows for the demo.** These can be settled when step 2 is
  run, without changing the specs or the tasks. Proposed:

  | Metric | From | Target value | Green % | Amber % | Reads as |
  |---|---|---|---|---|---|
  | OTIF projektów KPI, OTIF E, OTIF E: <6 units> | 2026-10-19 | 100 | 5 | 10 | ≥95 green, ≥90 amber (unchanged) |
  | Pokrycie wakatów | 2026-10-19 | 100 | 1 | 3 | ≥99, ≥97 (unchanged) |
  | Aneksy | 2026-10-19 | 0 | ≤5 | ≤10 | range (unchanged) |
  | NPS klienta | 2026-10-19 | 30 | 0 | ? | 10 is 66.67% below 30; a person picks the tolerance |
  | Utylizacja (Zarząd) | 2026-10-19 | 72.3? | ? | ? | the requirement's example; today 71.6/71 |
  | CKI-P OTIF-Sprint, OTIF-Etap, Projekty on track, Skuteczność rekrutacji | as recorded | 100? | ? | ? | CKI-P's leader decides |
  | CKI-P Realizacja PF | 2026-06-01 | ? | ? | ? | green from 33,000,000 on a % metric is a data error |

- **Renaming `within_band`.** With a target value, "point value" or
  "on target" describes it better. A rename changes a published API value
  and every catalogue, so it would be its own small change.
- **Improvement for `within_band`.** A move towards the target value could
  count as an improvement, where today a band change is neither. That is a
  `metric-values` behaviour change, left for when someone asks for it.
