## Context

`add-metrics` gave every metric exactly one board: `metrics.team_id` is non-null,
and the board-specific properties — `position`, `group_label`,
`owner_employee_id`, `retired` — sit on the same row as the definition (`name`,
`unit`, `decimals`, `direction`). Name uniqueness per board is decided by the
unique index `uq_metrics_team_name_lower (team_id, lower(name))`.
`metric_values` is keyed `(metric_id, meeting_id)`, and a meeting belongs to one
team, so a value already identifies its team without a `team_id` of its own.

Every board-side read and write goes through `services.metrics.get_metric(session,
team_id, metric_id)`, which checks `metric.team_id == team_id`: the settings list,
change, delete, threshold endpoints, `record_value`, `build_board` and
`build_trend`. Authorization is a pure function per action in `services/authz.py`;
`may_configure_the_board` covers metrics.

The answers that shaped this design (see proposal.md):
a global metric is **one shared definition**, not a locked copy; a board sets
only its **placement** (position, group label, owner, retirement on the board);
copying takes **definition and thresholds**; global metrics are **created
directly** by an administrator, never promoted from a board.

## Goals / Non-Goals

**Goals:**

- One code path for "a metric on a board", whether the board owns it or includes
  it. The board, the recording view, the trend and the settings list do not branch
  on the kind of metric except where the spec says the behaviour differs.
- The existing API shape of a board metric survives, so the board and recording
  views need no change beyond showing the global mark.
- A global metric's values never mix across teams, by construction rather than by
  filtering discipline.

**Non-Goals:**

- A cross-team view of a global metric. The data allows it (all values share one
  `metric_id`); presenting it is a later change.
- Per-board threshold overrides of a global metric. If a team needs different
  thresholds, it defines a metric of its own; a global metric cannot be copied.
  That is deliberate: a global metric exists to be judged the same way everywhere.

## Decisions

### A placement table: `board_metrics`

New table `board_metrics(team_id, metric_id, position, group_label,
owner_employee_id, retired, created_at)`, primary key `(team_id, metric_id)`.
`team_id` → `teams` `ON DELETE CASCADE`; `metric_id` → `metrics` `ON DELETE
CASCADE`; `owner_employee_id` → `employees` `ON DELETE RESTRICT` (as today).
`position`, `group_label`, `owner_employee_id` move here from `metrics`; so does
board retirement.

`metrics` keeps the definition plus:

- `team_id` becomes **nullable**: the owning board for a board's own metric, `NULL`
  for a global metric. A check-free invariant kept by the service: an own metric
  has exactly one placement, on `metrics.team_id`.
- `retired` stays, and now means **retired in the catalogue**. A check constraint
  `team_id IS NULL OR NOT retired` keeps it false for own metrics, whose retirement
  lives only on the placement.

A metric is shown on a board when its placement exists, `board_metrics.retired` is
false and `metrics.retired` is false. The read model's `retired` is that
disjunction.

`get_metric(session, team_id, metric_id)` becomes `get_board_metric(...)`,
returning the placement with its metric joined (`lazy="joined"`), raising
`MetricNotFoundError` when no placement exists — which is exactly the "another
team's metric" case today, and now also "a global metric this board does not
include". `record_value`, `build_board`, `build_trend`, `list_metrics` and the
threshold reads select placements for the team and read the definition through
the join. Values need no change: they are already per meeting, hence per team.

Alternatives considered:

- **A separate inclusion table for global metrics only**, leaving own metrics as
  they are. Smaller migration, but every board read becomes a union of two shapes
  and every board write branches. The placement table makes the global case the
  ordinary case.
- **Locked copies** (one `metrics` row per board, flagged read-only, synced from a
  template). Rejected with the user: changes would have to be fanned out and
  could drift, and thresholds would be duplicated per board.
- **Drop `metrics.team_id` and add a `global` boolean.** The per-board unique name
  index would then need a denormalised name on the placement. Keeping `team_id`
  keeps that index working unchanged for own metrics.

### Read models: `scope` rather than `global`

`MetricDefinitionRead` (and so `MetricRead`, the board tile and the trend) gains
`scope: "board" | "global"`. `team_id` in it remains the board being read, so the
existing shape holds for global metrics too. A field literally named `global` is a
Python keyword and would need an alias on every model; `scope` reads as well and
leaves room without a rename.

It also gains `retired_in_catalogue`, always false for a board's own metric.
`retired` stays the effective value — retired on the board *or* in the
catalogue — but the settings page must not offer "bring back" for a metric an
administrator retired, since the board's switch cannot undo that; it needs to
tell the two apart. (Added during implementation.)

The catalogue has its own `GlobalMetricRead`: `id, scope` (always `global`),
`name, unit, decimals, direction, retired, threshold` (in force today) and
`boards` (the number of placements). No placement fields.

### Names unique across own and included global metrics

Three uniqueness rules, two enforced by indexes and one by the service under a
lock:

1. Own metrics on a board — the existing `uq_metrics_team_name_lower`, unchanged
   (`team_id` is non-null for them; PostgreSQL treats NULLs as distinct, so global
   rows do not collide in it).
2. Global metrics among themselves — new partial unique index
   `uq_metrics_global_name_lower ON metrics (lower(name)) WHERE team_id IS NULL`.
3. An own metric against a global metric the same board includes — spans two
   tables, so the service checks it. To keep the "two concurrent writes cannot
   both pass" property the existing index gives, every write that can create such
   a clash first takes `SELECT … FOR UPDATE` on the affected `teams` row(s):
   adding, renaming or copying an own metric locks its team; including a global
   metric locks the team; renaming a global metric locks every team that includes
   it, in id order so two renames cannot deadlock.

Every case reports `metric_name.duplicate` — against `name`, or against
`global_metric_id` when including. One code for one meaning: "that name is taken
where it would appear".

Alternative considered: a denormalised `name_key` on `board_metrics` with a unique
`(team_id, name_key)` index, kept in sync on every rename. It makes the database
decide every case, but duplicates the name and turns a global rename into a
fan-out update; the lock is less machinery for a write that happens a few times a
year.

### What a board may change about a global metric

`PATCH /teams/{team_id}/metrics/{metric_id}` keeps one request model. For a global
metric, a request carrying `name`, `unit`, `decimals` or `direction` with a value
**different** from the definition is rejected with `global_metric.read_only`
against that field; equal values are accepted, as an unchanged `direction` already
is. Placement keys and `retired` apply to the placement. `POST
/teams/{team_id}/metrics/{metric_id}/thresholds` for a global metric is rejected
with `global_metric.read_only` regardless of who asks: an administrator records
global thresholds in the catalogue, so the board route never becomes a back door
and a threshold is always recorded where the spec says it lives.

`DELETE /teams/{team_id}/metrics/{metric_id}`: for an own metric, as today
(deletes metric and placement, refused with `metric.has_values`). For a global
metric it deletes the placement only, refused with `metric.has_values` when
`EXISTS (metric_values JOIN meetings WHERE metric_id = :m AND meetings.team_id =
:t)`.

`global_metric.read_only` is a 409: it is a rule about the resource, not about the
person, so it is not `auth.forbidden` (the same reasoning as
`metric_value.meeting_frozen`).

### Endpoints

| Method and path | Who | Purpose |
|---|---|---|
| `GET /global-metrics` | signed in | the catalogue, by name |
| `POST /global-metrics` | admin | add (`name, unit, decimals, direction`) |
| `PATCH /global-metrics/{id}` | admin | change `name, unit, decimals`, `retired`; `direction` only to be refused |
| `DELETE /global-metrics/{id}` | admin | delete when no value anywhere; cascades placements |
| `GET /global-metrics/{id}/thresholds` | signed in | history |
| `POST /global-metrics/{id}/thresholds` | admin | record a version |
| `POST /teams/{team_id}/metrics/inclusions` | configurer | `{global_metric_id, position, group_label, owner_employee_id}` → `MetricRead`, 201 |
| `POST /teams/{team_id}/metrics/copies` | configurer | `{source_metric_id, name?, position?}` → `MetricRead`, 201 |

Existing `/teams/{team_id}/metrics…` endpoints accept a global metric's id where
the board includes it, with the behaviour above. Threshold history via the board
(`GET …/{metric_id}/thresholds`) returns the global history, so the metric detail
needs no second source.

`authz.may_define_global_metrics(*, is_admin)` decides the catalogue writes;
inclusion and copy use `may_configure_the_board` on the target team only.

### New error codes

| Code | HTTP | Field | When |
|---|---|---|---|
| `global_metric.read_only` | 409 | the offending field, or none for a threshold | a board changes a global definition or records its threshold |
| `global_metric.already_included` | 409 | `global_metric_id` | included twice in one board |
| `metric_copy.source_global` | 409 | `source_metric_id` | the copy source is a global metric |

Reused: `metric_name.*`, `metric_unit.too_long`, `metric_decimals.out_of_range`,
`metric_direction.immutable`, `metric_owner.not_member`, `metric.not_found`,
`metric.retired` (including a retired global metric; recording against one),
`metric.has_values`, `threshold.*`. Each new code gets an English and a Polish
message.

### Copying: one transaction, thresholds re-recorded in order

`copy_metric(session, team_id, source_metric_id, name, position, actor_email)`:

1. Load the source; `metric.not_found` if absent, `metric_copy.source_global` if
   `team_id IS NULL`. A retired source may be copied; the copy is active.
2. Lock the target team, check name uniqueness (rule 3 above; rule 1 by index).
3. Insert the new `metrics` row and its placement, taking `group_label` from the
   source's placement and `position` from the request (default 0, as when adding).
   No owner: the source's owner belongs to another team.
4. Insert one `metric_thresholds` row per source version, in the source's
   `(effective_from, recorded_at)` order, with `recorded_by_email` the copier and
   `recorded_at` set explicitly to the copy time plus *i* microseconds. The
   in-force rule breaks same-date ties by `recorded_at`; setting it explicitly,
   rather than relying on `clock_timestamp()` across a multi-row insert, is what
   guarantees the copy has the same version in force on every date as the source.

The reason is copied verbatim; the copy event is logged at INFO with the source
and the new metric's ids. There is no stored link to the source (non-goal), so
later changes on either side do not reach the other.

Alternative considered: keep the original `recorded_by_email`/`recorded_at`. That
would present the copier's board as having been configured by someone who never
touched it, and the threshold history is an audit trail of *this* metric.

### Frontend

- `api/metrics.ts`: `scope` on `MetricDefinition`; `copyMetric`,
  `includeGlobalMetric`. New `api/globalMetrics.ts` for the catalogue.
- New `features/globalMetrics/GlobalMetricsPage.tsx` at `/global-metrics`, linked
  from the header for everyone. It reuses the metric definition fields and the
  threshold dialog and history from the settings page; those are extracted from
  `MetricSettingsPage.tsx` into components that take the save callback, rather
  than duplicated.
- `MetricSettingsPage`: two new actions beside "Add metric" for configurers —
  *Copy from another board* (choose a team, then one of its own metrics, optional
  new name) and *Include a global metric* (active global metrics not yet on the
  board). A global row shows a global mark, offers only placement editing,
  retire/remove, and the threshold history read-only with a line saying it is set
  in the catalogue.
- Board tile and metric detail: a global mark as an inline SVG icon plus visually
  hidden or visible text, so colour or a glyph is never the only signal.
- Polish: *wskaźnik globalny* / *wskaźniki globalne*; "Kopiuj z innej tablicy";
  "Dołącz wskaźnik globalny". Following the glossary fixed in `add-i18n-en-pl`.

## Risks / Trade-offs

- [Removing a global metric's placement has no database backstop against values
  recorded at that team's meetings: `metric_values` references the metric, not the
  placement.] → The service is the only writer and checks `EXISTS` in the same
  transaction; an integration test covers it. Adding `team_id` to `metric_values`
  for an FK would duplicate what the meeting already says.
- [An administrator's change to a global metric (rename, a back-dated threshold)
  recolours or relabels every including board at once, possibly mid-meeting.] →
  That is the point of one definition. Threshold versions keep their reason and
  author, and the metric detail shows the history on every board.
- [Lock-based name check is easier to get wrong than an index.] → Confined to one
  helper used by every write that can clash; integration tests for each clash
  path, including a global rename against an including board.
- [Migration moves columns out of `metrics`.] → Data is copied into placements
  before columns are dropped, in one migration; tested on an empty database and on
  a database seeded with the `add-metrics` fixtures.

## Migration Plan

Migration `0005_add_board_metrics_and_global_metrics`:

1. Create `board_metrics`.
2. `INSERT INTO board_metrics SELECT team_id, id, position, group_label,
   owner_employee_id, retired, created_at FROM metrics`.
3. Drop `position`, `group_label`, `owner_employee_id` and
   `ix_metrics_owner_employee_id` from `metrics`; set `metrics.retired = false`.
4. Make `metrics.team_id` nullable; add `uq_metrics_global_name_lower` and the
   `ck_metrics_global_only_retired` check.

Downgrade reverses the steps and refuses (raises) if any global metric exists,
since there is no board column for it to go back to. Deployment is the usual
`alembic upgrade head`; the API and web app ship together.

## Open Questions

- Whether the global metrics page should list which boards include a metric, not
  only how many. The count is enough for deciding whether a retire or delete is
  safe; a list can be added without changing the API's other shapes.
