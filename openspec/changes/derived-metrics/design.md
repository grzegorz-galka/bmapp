# Design

## Context

See `proposal.md` for why. What already exists and shapes the approach:

- **Values belong to meetings.** A value is `(metric_id, meeting_id)`. It is
  editable only at the team's latest held and next meeting, and frozen
  otherwise, except for an administrator's logged correction
  (`metric-values`).
- **Meetings are per team**, at most one per date. Teams meet on different
  weekdays. CKI-P has moved between Monday and Tuesday, and Zarząd meets on
  Wednesday. Wall-clock dates are on Europe/Warsaw (`app/core/time.py`).
- **"Previous meeting"** already has a meaning: the board's change since
  the previous meeting is the team's meeting immediately before, with no
  look-back when it has no number (`metric_values.py`, the board of a
  meeting).
- **The recording view saves a row when a field loses focus**
  (`RecordingView.tsx`, `save()` on blur). Its states are idle, saving,
  saved, not a number and failed.
- **Placement and definition** are separate: `metrics` is the definition
  and `board_metrics` the placement on a board. A global metric's
  definition is read-only on a board (`global_metric.read_only`).
- **Depends on `metric-target-values`** for the delta tile (target value 0,
  range) and the hidden base metric.

## Goals / Non-Goals

**Goals:**

- One function decides which meeting a source is read at, and the same
  rule serves the derived number and the explanation shown beside it.
- Deriving is a read. It records nothing, so `metric-values` is untouched.
- Adding a fourth kind later is one enum value, one function and its
  scenarios.

**Non-Goals:**

- Live or scheduled computation.
- Detecting cycles between derived metrics. Values are snapshots, so a
  cycle is harmless: each side reads what the other last saved.
- Checking that sources share a unit. A sum of percentages is the
  configurer's call.

## Decisions

### 1. A closed list of kinds, not code in the configuration

The derivation is `kind ∈ {mean, sum, delta}` plus ordered sources.

**Alternatives:**

- **Python snippets in the metric's configuration.** Whoever configures a
  board (a leader or a deputy) would run arbitrary code on the on-prem API
  server. Sandboxing Python is a project in itself, an open formula has no
  finite set of scenarios to map to tests, and only three shapes are known.
  Rejected.
- **A restricted expression language** (an AST whitelist of `+ − × ÷`,
  `mean()`, `sum()` and `prev()` over named sources). It is safe and
  flexible, but it is a parser, an evaluator and an editor UI for needs
  nobody has stated. If a formula outside the three kinds appears, this is
  the next step, and the source table below carries over unchanged.

### 2. Data model

```
metrics.derivation_kind   VARCHAR(20) NULL, check IN ('mean','sum','delta')
  ck_metrics_derivation_own: derivation_kind IS NULL OR team_id IS NOT NULL

metric_derivation_sources
  metric_id         FK metrics ON DELETE CASCADE      -- the derived metric
  position          INT                                -- 0..n-1
  source_team_id    FK teams   ON DELETE RESTRICT
  source_metric_id  FK metrics ON DELETE RESTRICT
  PK (metric_id, position)
  UNIQUE (metric_id, source_team_id, source_metric_id)
  INDEX (source_metric_id, source_team_id)             -- "is this a source?"
```

- **The kind lives on the definition.** The derivation describes how the
  number is obtained, not where it is shown. Only own metrics are derived,
  and an own metric has exactly one placement.
- **The source count is checked in the service**, not the database. A
  per-kind count across rows needs a trigger.
- **Self-reference.** A metric is its own source only when the source
  metric is the derived metric and the source team is its own team. The
  service refuses it with `derivation_source.self`. The database cannot
  check this cheaply, because the team is on the other table.
- **Validity of a source.** The source metric must be placed on the source
  team's board (`board_metrics`). Retired is allowed: retiring a source
  later is allowed too, so refusing it at definition time would be
  inconsistent.
- **RESTRICT on the source.** The service checks first and refuses with
  `metric.derivation_source`, so the constraint is only a backstop.

### 3. Which meeting a source is read at

A pure function, given the meeting being recorded `M` and the source team's
meetings:

```
if source_team == M.team:          S = M
else:                              S = latest meeting of source_team with
                                       isocalendar(date)[:2] == isocalendar(M.date)[:2]
delta only:                        S_prev = the source team's meeting immediately before S
```

- **Dates.** Meeting dates are already wall-clock dates on Europe/Warsaw,
  so the ISO week is taken from the date alone.
- **Two meetings in a week.** "Latest" covers a team with two meetings
  that week.
- **Strict previous meeting.** A missing number at `S` or `S_prev` refuses
  the derivation. Nothing reaches further back, matching the board's
  change since the previous meeting.

**Alternatives:**

- **The latest meeting on or before `M.date`.** It breaks when the source
  team meets later in the week, and it would silently pick last week's
  number.
- **A window of ±3 days.** It crosses week boundaries for teams meeting on
  Monday and Friday.

The ISO week is what "in the same week" means in the board meeting
practice.

### 4. The derive endpoint

`GET /teams/{team_id}/meetings/{meeting_id}/metrics/{metric_id}/derivation`
lives in the `metric_values` router, beside `/board` and `/values`.

- **Response:**

  ```
  { "value": "93.833333",
    "kind": "mean",
    "sources": [ { "team": {id, name}, "metric": {id, name},
                   "meeting_id", "date", "value",
                   "previous": {meeting_id, date, value} | null } ] }
  ```

- **Refusals.** A refusal is a normal error response with one entry per
  missing piece:
  - `field: "sources[i]"` with `derivation.source_missing`;
  - `derivation.previous_missing` for a delta's previous meeting.

  HTTP 409, as the derivation cannot be satisfied in the current state. The
  message names the team and metric for developers. The frontend builds its
  own sentence from the source names it already has.
- **Rounding.** `mean` is quantised to 6 places with `ROUND_HALF_EVEN`,
  the storage scale. `sum` and `delta` are exact. A result that does not fit
  `NUMERIC(21, 6)` is refused with `metric_value.out_of_range`, the code
  the value write already uses.
- **Reading is open.** Any valid token may call it, as for every read. The
  response carries only numbers that are already readable.
- **Statement count.** The derived metric with its sources, the source
  teams' meetings for the ISO week (and their predecessors), and their
  values: three statements whatever the number of sources.

### 5. The recording view

- **The button.** A derived metric's row gets a "Derive" button
  (`controls.module.css` `.button`) beside the number field. It is shown
  only when the field is editable. That includes an administrator's
  correction mode, where the save still asks for the reason as today.
- **On success:**
  1. Set the field to the returned value, formatted for the language and
     shown with the metric's decimals.
  2. Call the row's existing `save()`. A value derived but never saved
     would be the worst outcome.
  3. Show a one-line note under the row naming the numbers used, e.g.
     "Mean of 6: 90 · 97 · 87 · 83 · 105 · 101".
- **On refusal:** leave the field and show the missing names in the row's
  message area. The existing `failed` state is for a failed save, so this
  is a new state, `notDerived`.
- **Formatting.** Saving the 6-place value keeps it exact, and display
  formatting already rounds to the metric's decimals.

### 6. Derivations only on a board's own metrics

**Why not global metrics:**

- A global metric is defined once, but its values are per team. A
  derivation in the catalogue would need sources relative to the board
  recording it ("this team's X"), which is a second source model.
- No known case needs it. The demo has no global metrics, and its three
  derivations are all a board's own.

Including a global metric as a **source** is supported, because the
source is `(team, metric)` and a global metric's values are per team.

### 7. Rules that touch other capabilities stay in this one

Defining, copying, deleting and removing metrics belong to `metrics` and
`global-metrics`, which `metric-target-values` is modifying now. The
derivation-specific rules are stated as requirements of `derived-metrics`:
the copy drops the derivation, and a source cannot be deleted or removed.
That avoids two in-flight changes rewriting the same requirement blocks.

### 8. The settings page

- **Where:** a "Derivation" section in the create-metric dialog and in the
  change form of an own metric. An included global metric shows none.
- **Kind:** a select of None, Mean, Sum, "Change since previous meeting".
- **Sources:** an ordered list. Each row is a team select (every team,
  the board's own first) and a metric select (that team's placed metrics,
  loaded on choosing the team), with remove, and up and down to reorder.
  For `delta` the list is capped at one.
- **Reading:** the metric row reads "Mean of 6 metrics" with the sources
  on expand. A source on another team reads "Metric (Team)".

## Risks / Trade-offs

- **[Risk] The source team meets later in the week than the recording
  team.** The value is not there when "Derive" is pressed. → The refusal
  names the source. The member derives again after that team's meeting,
  while the meeting is still editable (latest held or next).
- **[Risk] A mean rounded by a person differs from the derived one** (the
  demo's 95 vs 94.83). → The derived number is exact to 6 places and shown
  with the metric's decimals. A member who wants the old rounding types it.
- **[Trade-off] Snapshot over live.** A corrected source does not update
  the derived value. → This is the spec ("A derived value is an ordinary
  value"). The member derives again if the meeting is editable, or an
  administrator corrects the value with a reason.
- **[Trade-off] No record that a value was derived.** → Out of scope.
  The comment field is available, and recording provenance would be an
  addition to `metric-values`.

## Migration Plan

1. Alembic `0011_add_metric_derivations` adds the column and the table.
   No data changes, and the downgrade drops both.
2. The demo is configured by hand after deploy, not by a script:
   - "OTIF E" (Zarząd) = `mean` of its six units;
   - "OTIF E: CKI-P" = `mean` of CKI-P's "OTIF-Etap";
   - a hidden "Zatrudnienie" with a `delta` tile, if wanted.
