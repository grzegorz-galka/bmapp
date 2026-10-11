## Context

This change builds on `add-meetings`, which must be implemented and archived first (see proposal.md, Impact). It adds:

- `meetings(team_id, starts_at, …)`, unique per team and local Europe/Warsaw date;
- `ORGANIZATION_TZ` in `app/core/`;
- the meetings page;
- the reserved route `/teams/:teamId` for the board.

`app/services/authz.py` already has `may_configure_the_board` and `may_record_meeting_data`. Status rules were settled in exploration against the legacy single-team HTML tool:

- three colours;
- thresholds versioned by an effective-from date, set by the leader or an administrator with a reason, and allowed to be back-dated;
- a colour set by hand needs a comment;
- an editing window of the latest held meeting and the next one;
- administrators correct frozen values.

The legacy tool already shows the shape this produces, and its data is a useful fixture. 14 metrics over 26 weekly meetings cover all three directions. One threshold changed four times, one monthly, and one was back-dated.

## Goals / Non-Goals

**Goals:**

- One pure function decides a status. The API, the board and the trend all call it, and the BDD feature exercises it directly.
- History stays honest. Thresholds and corrections are append-only, a status is computed and never stored, and so a back-dated threshold recolours the past visibly rather than silently.

**Non-Goals:**

- Caching or materialising statuses. At around 15 metrics × 50 meetings a year per team, computing on read is trivially cheap.
- The legacy tool's other metric shapes (computed, per-unit, extra fields, gap display, monthly series). The model below does not preclude any of them (see Risks).

## Decisions

### Threshold versions store zone bounds; direction lives on the metric

`metric_thresholds(id, metric_id, effective_from date, green_lo, green_hi, amber_lo, amber_hi numeric NULL, reason text, recorded_by_email, recorded_at)`. The bounds used depend on direction:

| Direction | Green zone | Amber zone | Stored |
|---|---|---|---|
| higher is better | `v >= green_lo` | `amber_lo <= v < green_lo` | `green_lo`, `amber_lo` |
| lower is better | `v <= green_hi` | `green_hi < v <= amber_hi` | `green_hi`, `amber_hi` |
| within band | `green_lo <= v <= green_hi` | inside `[amber_lo, amber_hi]`, outside green | all four |

The API takes the friendlier `{green, amber}` for one-sided metrics and `{green_lo, green_hi, amber_lo, amber_hi}` for bands, and maps them onto these columns. A check constraint per row enforces the ordering (`amber_lo <= green_lo <= green_hi <= amber_hi` wherever both sides are present), as a backstop to the validator that raises `threshold.order_invalid`. Amber equal to green gives an empty amber zone, which is how a plain red/green metric is expressed with no extra flag.

The in-force version is `ORDER BY effective_from DESC, recorded_at DESC LIMIT 1 WHERE effective_from <= :date`. For the trend, the service loads a metric's versions once and resolves each meeting in Python.

Alternatives considered:

- **Target plus tolerance**, as the legacy tool does with `target`, `gap` and an optional `green`. That takes three fields to express two boundaries, and the meaning shifts with direction.
- **Direction on the version.** It would allow "better" to flip mid-history, which makes deltas and trends unreadable. The direction stays fixed on the metric (`metric_direction.immutable`).
- **Effective-from as a meeting reference.** Thresholds have to be set for meetings not yet opened, such as a monthly plan entered a year ahead. A date works for any meeting.

### The status function is pure and shared

`status_of(direction, value, manual_status, threshold) -> Status` lives in `app/services/metric_status.py`. It does no I/O and imports nothing from SQLAlchemy. `Status` is a `StrEnum` of `green`, `amber`, `red`, `no_data` and `no_threshold`, plus a separate `set_by_hand: bool` on the read model. Everything that shows a colour calls this function. The frontend never recomputes a status: it renders what the API returned.

### Numbers are `numeric`, stored as entered

Values and bounds are `NUMERIC(21, 6)`, giving 15 integer digits and 6 decimal places. That covers `174122665` and `0.71`. Pydantic parses them as `Decimal`, and JSON carries them as strings, so binary floating point never touches a boundary comparison. 71.0 against a boundary of 71 must be green, not 70.99999. `decimals` on the metric only affects display.

The frontend parses the active language's format: Polish `95,3`, English `95.3`. It sends the canonical decimal string.

Alternative considered: `float`. It is simpler on the wire, but makes inclusive boundary checks unreliable, and the status rule is the one thing that must be exact.

### Values, the editing window and corrections

`metric_values(metric_id, meeting_id, value numeric NULL, manual_status NULL, comment text, recorded_by_email, recorded_at)` has the primary key `(metric_id, meeting_id)` and is written with an upsert. The service checks that the metric and the meeting belong to the same team. A mismatch reports `meeting.not_found`, so a guessed id says nothing about another team.

The editing window is a pure function, `editable_meetings(meeting_dates, today) -> {latest_held, next}`, with `today` taken in `ORGANIZATION_TZ` and injected for tests. A write outside the window takes one of two paths. A non-administrator gets `metric_value.meeting_frozen` (409). An administrator must supply a `reason`, or gets `metric_value_reason.blank`. The administrator's write updates the value and appends a row to `metric_value_corrections(id, metric_id, meeting_id, old_value, old_manual_status, old_comment, new_…, reason, corrected_by_email, corrected_at)` in the same transaction.

The 409 for a frozen meeting is a domain rule rather than a permission refusal, which is why it is not `auth.forbidden`. An administrator is allowed through it, but only along the correction path.

Alternative considered: logging every change, not only corrections. That is more history than was asked for. Inside the window the latest value is what matters, and `recorded_by_email` and `recorded_at` already say who touched it last.

### `meeting.has_values` is enforced in the service, with an FK backstop

Moving a meeting's date, or deleting a meeting, first checks `EXISTS (SELECT 1 FROM metric_values WHERE meeting_id = …)` and raises `MeetingHasValuesError`. `metric_values.meeting_id` is `ON DELETE RESTRICT`, so a bypass still fails. The date-change rule has no database backstop because the date is derived from `starts_at`, and the service is the only writer.

### Endpoints

| Method and path | Body | Success | Guard |
|---|---|---|---|
| `GET /teams/{team_id}/metrics` | — | 200, `MetricRead[]` | any token |
| `POST /teams/{team_id}/metrics` | `MetricCreate` | 201, `MetricRead` | `may_configure_the_board` |
| `PATCH /teams/{team_id}/metrics/{metric_id}` | partial, including `retired` | 200, `MetricRead` | `may_configure_the_board` |
| `DELETE /teams/{team_id}/metrics/{metric_id}` | — | 204 | `may_configure_the_board` |
| `GET /teams/{team_id}/metrics/{metric_id}/thresholds` | — | 200, `ThresholdRead[]` | any token |
| `POST /teams/{team_id}/metrics/{metric_id}/thresholds` | `ThresholdCreate` | 201, `ThresholdRead` | `may_configure_the_board` |
| `GET /teams/{team_id}/metrics/{metric_id}/trend` | — | 200, `MetricTrend` | any token |
| `GET /teams/{team_id}/meetings/{meeting_id}/board` | — | 200, `MeetingBoard` | any token |
| `PUT /teams/{team_id}/meetings/{meeting_id}/values/{metric_id}` | `{value, manual_status, comment, reason?}` | 200, `MetricValueRead` | `may_record_meeting_data`, then the window rule |

`MeetingBoard` is `{meeting, editable, completeness: {recorded, total, missing: [{metric_id, name, owner}]}, metrics: [{metric, threshold, value, status, set_by_hand, comment, previous, change, improvement, sparkline: [{meeting_id, date, value, status}]}]}`. This is one request per board view. The 12-meeting sparkline is computed from a single query over the team's last 12 meetings and their values.

`PUT` on the value is a replace of the meeting's entry for that metric, not a partial update. The recording view always sends all three fields, so there is no absent-or-null ambiguity.

### New domain errors and codes

| Code | Status | Field |
|---|---|---|
| `metric_name.blank` / `.too_long` / `.duplicate` | 422 / 422 / 409 | `name` |
| `metric_unit.too_long` | 422 | `unit` |
| `metric_decimals.out_of_range` | 422 | `decimals` |
| `metric_owner.not_member` | 409 | `owner_employee_id` |
| `metric_direction.immutable` | 409 | `direction` |
| `metric.not_found` | 404 | none |
| `metric.retired` | 409 | none |
| `metric.has_values` | 409 | none |
| `threshold.order_invalid` | 422 | none |
| `threshold_reason.blank` | 422 | `reason` |
| `metric_value.out_of_range` | 422 | `value` |
| `metric_value.comment_required` | 422 | `comment` |
| `metric_value.meeting_frozen` | 409 | none |
| `metric_value_reason.blank` | 422 | `reason` |
| `meeting.has_values` | 409 | none |

`metric_name.duplicate` comes from a unique index on `(team_id, lower(name))`, the same pattern as team names.

### Frontend

- `features/board/`: `BoardPage` at `/teams/:teamId`, with a meeting navigator, grouped tiles and a "Record values" switch into `RecordingView` for the shown meeting; and `MetricDetail` as a dialog over the board.
- `features/metrics/`: `MetricSettingsPage` at `/teams/:teamId/metrics`, listing the metrics with their properties, an add or edit form, retire and delete actions, and a "Change threshold" dialog with the effective date and reason.
- Charts use **Recharts**: `LineChart` for the detail with a `step` line or `ReferenceArea` band for thresholds, and a minimal `LineChart` for sparklines. Dot colours come from the theme tokens. A new `--status-green`, `--status-amber` and `--status-red` set is added to `theme.css` for both palettes and checked by `contrast.test.ts`. Every coloured mark also carries its status in text or `aria-label`, because colour is never the only signal.
- Number input and display go through new `parseLocalizedDecimal` and `formatMetricValue(value, decimals, unit, language)` in `i18n/format.ts`.
- Recording saves each field when it loses focus, as the legacy tool does and the team is used to, with an inline "saved" or error state per row. There is no form-wide submit.
- After installing Recharts, the container needs `docker compose up -d --build --renew-anon-volumes frontend`, per CLAUDE.md.

### Polish vocabulary added to the glossary

| English | Polish |
|---|---|
| Metric | Wskaźnik (already fixed) |
| Threshold | Próg |
| Green / Amber / Red | Zielony / Żółty / Czerwony |
| Set by hand | Kolor ręczny |
| No data / No threshold | Brak danych / Brak progu |
| Record values | Uzupełnij wyniki |
| Correction | Korekta |
| Retire / Bring back | Wycofaj / Przywróć |
| Effective from | Obowiązuje od |

### Testing

- **BDD:** `tests/features/metric_status.feature`, the project's first, with one scenario per scenario of *The status of a value*, through `status_of`, and of *The threshold in force at a meeting*, through the resolver. Step definitions live in `tests/features/steps/`.
- **Unit:** `editable_meetings` covers every scenario of the window requirement. Threshold-order validation covers every direction. Decimal parsing is tested at the boundaries.
- **Integration:** one module per remaining requirement, one test per scenario, named after it, as before. That includes the modified `meetings` scenarios and the new authorization scenarios.
- **Vitest:** board tiles, recording view (Polish number entry, frozen read-only), metric detail (threshold step), settings, and the interface-permission scenarios.
- **Playwright:** `record-meeting-metrics.spec.ts` and `configure-metrics.spec.ts`. These are two of the main flows CLAUDE.md lists.

## Risks / Trade-offs

- [Back-dated thresholds recolour history] → Intended. It was agreed in exploration, and the threshold history and the trend's steps make it visible. The board does not flag recoloured meetings individually. If that is wanted, it is a display addition, not a model change.
- [Two open changes modify the same authorization requirement] → This change's MODIFIED block is written on top of `add-meetings`' version. Archive `add-meetings` first. If `add-meetings` is revised before then, this block must be re-based.
- [Decimals as JSON strings] → Clients have to parse them. The only client is this frontend, and the API types say so.
- [Later metric shapes] → None is precluded. Computed metrics add a source to the value. Per-unit breakdowns add child values keyed by unit. Gap display is a presentation flag. Monthly series are threshold versions plus values at monthly meetings. Each gets its own change.
- [Recording saves per field] → Two members typing into the same metric is last-write-wins. Acceptable at a team's scale, and `recorded_by_email` shows who won.

## Migration Plan

1. `0004_add_metrics` creates `metrics`, `metric_thresholds`, `metric_values` and `metric_value_corrections`:
   - foreign keys: `metrics.team_id` cascade; `metric_values.meeting_id` and `.metric_id` restrict; `owner_employee_id` restrict;
   - the per-row check constraints;
   - the unique name index;
   - an index on `metric_thresholds(metric_id, effective_from)`.
2. No backfill. Downgrade drops the four tables.
3. Docs: CLAUDE.md's domain table and glossary move from "acceptable min / max" and "red or green" to thresholds and red/amber/green, its *Current state* is updated, and the Testing section notes that the first BDD feature now exists.

## Open Questions

- Should a tile flag that its colour changed because of a back-dated threshold? Display only, as noted under Risks.
