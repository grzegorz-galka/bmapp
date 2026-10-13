# Proposal

## Why

A board's metrics are grouped today by a free-text group label typed into each
metric's form, and ordered by a number typed into its position field. A
leader cannot create a group before a metric is in it, cannot rename a group
without retyping it on every metric, gets a second group from a typo, and
cannot set the order of the groups at all: the board shows them in the order
their first metrics happen to fall. Leaders asked to define a board's groups
and arrange the metrics in them by dragging them on the metric settings page.

## What Changes

- A board gets **metric groups** of its own: named, ordered, unique on the
  board regardless of case. A group may be empty. Whoever configures the board
  adds, renames, reorders and deletes them; deleting a group moves its metrics
  to the end of the ungrouped ones, and never touches a metric's values.
- A metric's placement on a board belongs to **at most one group**, with a
  position inside it. Metrics in no group are shown under "Ungrouped", after
  every group.
- The metric settings page arranges the board by **drag and drop**: a metric
  can be dragged within its group, into another group or out of every group,
  and a group can be dragged to a new place. Every move can also be made from
  the keyboard, without dragging.
- The whole arrangement is saved as **one layout** — every group in order, and
  every metric of the board in order inside its group or among the ungrouped
  ones — and a layout made against an outdated board is refused rather than
  half-applied.
- **BREAKING (API)**: `group_label` and `position` leave the metric payloads.
  A metric read carries its `group` (id, name, position) or none and its
  position within it; adding, including or copying a metric names an optional
  `group_id` and puts the metric at the end of that group; a placement change
  can move a metric to another group, again at its end. The free-text group
  field leaves the metric form. The frontend is the only client and changes in
  the same change.
- Copying a metric no longer takes the source's group label: groups are a
  board's own, so the copy lands in the group the copier names.
- The board shows its groups in the board's order, each metric in its order
  inside the group, and the ungrouped metrics last.
- A migration turns each board's existing distinct group labels into groups,
  ordered as the board shows them today, and keeps every metric's relative
  order.

This change **builds on `polish-gui`**, which reworks the same metric settings
page: it moves metric creation into a "Create new metric" dialog behind three
buttons in the top row and removes the Board and Meetings buttons there. The
groups and their drag-and-drop arrangement are laid out on that reworked page.

## Capabilities

### New Capabilities

None. Groups are part of how a board's metrics are defined and shown, which the
`metrics` capability already owns.

### Modified Capabilities

- `metrics`: groups are added (define, rename, reorder, delete); defining,
  listing, changing and copying a metric place it by group rather than by a
  label and a typed position; the board's layout is saved as a whole; the
  metric settings page arranges groups and metrics by drag and drop with a
  keyboard alternative.
- `global-metrics`: including a global metric and changing its placement name
  a group instead of a group label and a position; the catalogue still has no
  group of its own.
- `metric-values`: the board page shows tiles under the board's groups in the
  board's order, the ungrouped ones last.
- `authorization`: arranging a board's groups and metrics is part of
  configuring it, permitted to whoever configures the board and refused to
  anyone else.

## Impact

- **Database**: a new `metric_groups` table; `board_metrics` gains a nullable
  `group_id` and loses `group_label`. One Alembic migration with a data step.
- **API**: new `/teams/{team_id}/metric-groups` (add, rename, delete) and
  `PUT /teams/{team_id}/metric-layout`; changed payloads on
  `/teams/{team_id}/metrics` (create, inclusions, copies, patch, read) and on
  the board of a meeting. New error codes: `metric_group_name.blank`,
  `metric_group_name.too_long`, `metric_group_name.duplicate`,
  `metric_group.not_found`, `metric_layout.stale`.
- **Backend**: `app/models/metric.py`, `app/schemas/metric.py`,
  `app/services/metrics.py`, `app/services/metric_values.py`,
  `app/api/metrics.py`, a new router module for groups and layout,
  `scripts/import_legacy_board.py`.
- **Frontend**: `src/api/metrics.ts`, `features/metrics/` (settings page,
  form, copy and include dialogs), `features/board/BoardPage.tsx`, both i18n
  catalogues.
- **Dependencies**: none. Dragging uses the browser's native drag and drop;
  see `design.md`.
- **Depends on**: `polish-gui` (the reworked metric settings page). The
  parallel `add-leader-deputies` widens who configures a board; this change
  refers to that permission rather than to the leader by name, so either may
  land first.
