# Design

## Context

See `proposal.md` - Why. What exists now:

- A metric's placement on a board is a `board_metrics` row
  (`team_id`, `metric_id`, `position`, `group_label`, `owner_employee_id`,
  `retired`), introduced by migration `0005`. `group_label` is free text of at
  most `METRIC_GROUP_MAX_LENGTH` (200) characters; `position` is an integer
  the client types and is not unique.
- `list_metrics` in `app/services/metrics.py` and the board read in
  `app/services/metric_values.py` both order by `position`, then name.
  `_PLACEMENT_KEYS` lets a patch change `group_label`, `position` and owner,
  including on an included global metric.
- `BoardPage.tsx` (`Tiles`) groups tiles by `group_label` into a `Map` in
  order of first appearance, with `board.noGroup` for metrics without a label;
  so the order of the groups follows whichever metric has the lowest position.
- `MetricForm.tsx` carries `group_label` and `position` as text and number
  fields, also for an included global metric (`PLACEMENT_FIELDS`). The copy
  dialog sends a `position`; a copy takes the source's `group_label`.
- `scripts/import_legacy_board.py` sets `group_label` from the legacy KPI's
  group.
- `polish-gui` reworks `MetricSettingsPage.tsx`: creation moves to a "Create
  new metric" dialog, three buttons sit in the top row, and the Board and
  Meetings buttons go. This change lays the groups out on that page and must
  be applied after it.
- Who may configure a board is decided by one helper (`_require_configurer` in
  `app/api/metrics.py`, the authz function behind it). `add-leader-deputies`
  widens that helper; this change only calls it.

## Goals / Non-Goals

**Goals:**

- Groups that exist on their own, before and after the metrics in them.
- One explicit order for groups and, inside each, for metrics, shared by the
  settings page, the board, the dashboard's counts and the API.
- Dragging on the settings page, with an equivalent for the keyboard.

**Non-Goals:**

- Groups in the global-metric catalogue, or a group shared between boards.
- Nested groups, group colours or collapsing groups on the board.
- Dragging tiles on the board itself; the board stays a reading surface.
- Touch-screen dragging (see Risks).

## Decisions

### 1. Groups are a board-level table, not a cleaned-up label

New table `metric_groups(id, team_id → teams ON DELETE CASCADE, name,
position, created_at)` with a unique index on `(team_id, lower(name))`.
`board_metrics` gains `group_id → metric_groups ON DELETE SET NULL`, nullable,
and loses `group_label`.

- *Alternative: keep `group_label` and add a `board_metric_groups(team_id,
  label, position)` ordering table keyed by label.* Renaming would then mean
  rewriting every placement's label, and an empty group would be a row with no
  placements pointing at it by string - the same thing as a table, with the
  integrity left to the code.
- *Alternative: keep the label and derive group order from metric order.*
  That is today's behaviour, and it is what the request is about.

A group belongs to a board (team) because a placement does; a global metric
included in two boards can sit in a different group on each.

### 2. Positions are dense per container, and a layout is replaced whole

`metric_groups.position` is 0..n-1 per board. `board_metrics.position` is
0..n-1 per container, where a container is one group or the board's ungrouped
set. Retired placements keep their place, so bringing one back puts it where it
was.

The only way to reorder is `PUT /teams/{team_id}/metric-layout`:

```json
{
  "groups": [
    {"id": "<group>", "metric_ids": ["<metric>", "<metric>"]},
    {"id": "<group>", "metric_ids": []}
  ],
  "ungrouped": ["<metric>"]
}
```

The service locks the board's placements and groups (`SELECT … FOR UPDATE`),
checks the submitted ids equal the board's sets exactly, each once, and
rewrites `position` and `group_id` in one transaction. Any mismatch is
`metric_layout.stale` (409): the client's view is outdated, and a partial
apply would leave an order nobody chose.

- *Alternative: a "move" endpoint (`metric X to group G at index i`).* Every
  drop is one small request, but two leaders dragging at once interleave into
  an order neither saw, and index arithmetic with retired placements in the
  list is where off-by-one bugs live. A drag produces a whole new order
  anyway; sending it is simpler and makes the stale case explicit.
- *Alternative: fractional or gapped positions.* Avoid renumbering, but only
  matter for large lists; a board has tens of metrics.

Adding, including, copying and moving a metric to another group via `PATCH`
append it at the end of the target container (`max(position) + 1`). Deleting a
group appends its metrics, in order, after the ungrouped ones, in the same
transaction (done in the service, not left to `ON DELETE SET NULL`, which would
leave duplicate positions). Removing or deleting a metric leaves a gap that the
next layout closes; readers order by position, so a gap is harmless.

### 3. The API shape

- `MetricDefinitionRead` drops `group_label`; carries
  `group: {id, name, position} | null` and keeps `position` (now within the
  container). `MetricRead` and the board's metrics inherit it.
- `MetricCreate`, `GlobalMetricInclusion`, `MetricCopy` drop `position` and
  `group_label`; take `group_id: uuid | null`. `MetricUpdate` drops both and
  takes `group_id` (explicit `null` ungroups). `_PLACEMENT_KEYS` becomes
  `{group_id, owner_employee_id}`.
- `GET /teams/{team_id}/metric-groups` lists the board's groups in order (the
  settings page needs empty ones, which the metric list cannot show);
  `POST` adds (`{name}`), `PATCH /{group_id}` renames, `DELETE /{group_id}`
  deletes (204). The board read (`GET …/meetings/{id}/board`) needs no group
  list: it shows only groups with metrics.
- Error codes: `metric_group_name.blank`, `metric_group_name.too_long`,
  `metric_group_name.duplicate`, `metric_group.not_found` (404),
  `metric_layout.stale` (409), all on `DomainError` subclasses with an English
  `message`, translated in both catalogues.
- Ordering everywhere is `(group.position NULLS LAST, placement.position,
  lower(name))`: one SQL expression, used by `list_metrics`, the board read
  and the dashboard's counts if they order.

The routers live in a new `app/api/metric_groups.py` (groups and layout are a
resource of their own); the logic goes in `app/services/metrics.py`, next to
the placement code it shares.

### 4. Copying takes no group from its source

The source's group belongs to another board. The copy dialog names a group of
the target board (default: none). Matching by name was considered - it would
quietly create groups or depend on spelling across teams, which is the problem
this change removes.

### 5. Native HTML5 drag and drop, plus explicit move controls

The settings page uses the browser's own `draggable` / `dragstart` /
`dragover` / `drop` events: a metric row and a group header are draggable; a
group body and the ungrouped section are drop targets, with an insertion line
showing where a dropped item lands. On drop, the page computes the new layout
locally, applies it optimistically to the query cache, and `PUT`s it; on
`metric_layout.stale` it shows the message and refetches.

The keyboard alternative is not drag emulation but ordinary controls on each
row: "Move up", "Move down" and a "Move to group" menu for a metric, "Move up"
and "Move down" for a group, each with an `aria-label` naming its subject. The
same layout function handles both paths. A polite `aria-live` region announces
"Morale moved to Quality, position 3 of 3".

- *Alternative: `@dnd-kit/core` + `@dnd-kit/sortable`.* Better touch support,
  smooth sorting animation and a built-in keyboard sensor. But CLAUDE.md admits
  a dependency only when it removes meaningful code: the move controls are
  needed anyway (a keyboard drag is a poor interface for "move to group 4"),
  the drop logic is the layout function both paths share, and what dnd-kit
  saves is the event wiring - a few dozen lines. Its keyboard sensor and
  measuring also depend on layout boxes jsdom does not compute, which would
  push its behaviour out of Vitest into Playwright only.
- *Alternative: keyboard controls only, no dragging.* Does not meet the
  request.

### 6. Permission

Every new write calls the same configurer check as the metric writes. Nothing
here names the leader; whoever `add-leader-deputies` (or the current rule)
permits to configure the board may arrange it.

### 7. Migration `add_metric_groups`

Numbered after whatever is head when this is applied (`add-leader-deputies`
may add one first).

1. Create `metric_groups`; add `board_metrics.group_id`.
2. Per team, take the distinct trimmed non-null `group_label`s; merge those
   equal regardless of case (keep the spelling of the lowest-positioned
   metric); insert one group each, positioned in order of
   `min(position), min(lower(name))` of their metrics - the order the board
   shows them in today.
3. Set each placement's `group_id`; renumber `position` densely within each
   container by `(position, lower(name))`, preserving today's order.
4. Drop `group_label`.

Downgrade restores `group_label` from the group's name and drops the table;
group order and empty groups are lost, which is acceptable for a rollback.

## Risks / Trade-offs

- [Native drag and drop does not work on touch screens] → The move controls
  work everywhere, including touch; configuring a board is a desk task.
- [Two leaders arrange the same board at once] → The second `PUT` is refused as
  stale, the page reloads the current layout; no silent merge.
- [Breaking API change] → The frontend is the only client and changes in the
  same PR; the OpenAPI document and `src/api/metrics.ts` change together.
- [Legacy labels differing only by case or spaces become one group] → Intended;
  noted in the migration test.
- [Large boards renumber on every drop] → A board has tens of metrics; one
  `UPDATE … FROM (VALUES …)` statement per drop.

## Migration Plan

Apply the migration with `alembic upgrade head`; it runs in one transaction and needs
no downtime beyond the deploy. Ship the backend and frontend together (the
Compose stack and the Railway demo both build both). Rollback is `alembic
downgrade -1` plus the previous images; groups collapse back to labels.
