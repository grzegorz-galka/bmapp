## Why

Every metric today belongs to exactly one board and is typed in from scratch. Two
needs follow from running more than one team on BMAPP:

- A leader setting up a new board wants to start from what another team already
  measures — same name, unit, direction and thresholds — and adjust it, rather
  than retype it.
- The organization wants some metrics measured the same way on every board that
  tracks them (for example an availability or a security-findings metric). If each
  team keeps its own copy, the definitions and thresholds drift and the boards stop
  being comparable. Those metrics must be defined once, by an administrator, and a
  team leader must not be able to change them.

## What Changes

- **Copy a metric from another board.** A team's leader copies a regular metric of
  any board onto their own: its name (which may be changed on the way in), unit,
  decimals, direction, group label and every threshold version with its effective
  date and reason. The owner and the recorded values are not copied. The copy is an
  ordinary metric of the target board, independent of its source from then on, and
  the leader may change it like any other.
- New **global metrics**, a company-wide catalogue maintained by administrators on a
  new page at `/global-metrics`. A global metric is **one shared definition**: name, unit,
  decimals, direction and its threshold history are set by an administrator and
  apply on every board that includes it. Administrators add, change, retire and
  delete global metrics and record their threshold versions, under the same rules a
  board metric follows.
- **Include a global metric in a board.** A team's leader includes any active global
  metric in their board. On that board the leader sets only its **placement** —
  position, group label and owner — and may remove it again (or retire it there
  once values are recorded at that team's meetings). Its definition and thresholds
  are read-only on the board, to the leader and to an administrator alike: they are
  changed in the catalogue.
- **Values of a global metric stay per team.** Each team records the global metric
  at its own meetings, under the same editing window and corrections as any metric;
  its trend runs along that team's meetings.
- **Names stay unique on a board.** A global metric included in a board takes part in
  the board's name uniqueness, both when it is included and when its name or a board
  metric's name later changes.
- The board, the metric settings page and the metric detail **mark a global metric**
  as global, and the settings page offers no control to change its definition or
  thresholds.
- Metric reads gain a `global` flag. **BREAKING** (internal, before release): a
  metric's position, group label, owner and retirement on a board move from the
  metric definition to the metric's placement on the board. The API shape of a
  board metric is unchanged apart from the added flag.
- **Documentation.** CLAUDE.md's glossary gains **Global metric**; its domain table
  and *Current state* are updated.

## Capabilities

### New Capabilities

- `global-metrics`: The company-wide catalogue of metrics defined by administrators,
  their inclusion in boards, and what a board may and may not change about them.

### Modified Capabilities

- `metrics`: A board's metrics are its own metrics plus the global metrics it
  includes; names are unique across both; a metric can be copied from another
  board; changing, retiring or deleting a metric on a board, and recording a
  threshold there, distinguish an included global metric from a board's own.
- `metric-values`: A value may be recorded for a metric only while it is active both
  in its definition and on the board; a global metric's values belong to the team
  whose meeting they were recorded at.
- `authorization`: Only an administrator defines global metrics and their
  thresholds; a team's leader includes them and copies metrics into their board;
  the interface offers those controls only to those permitted.

## Impact

- **Data**: migration `0005` adds a `board_metrics` placement table (team, metric,
  position, group label, owner, retired) and moves those columns out of `metrics`,
  whose `team_id` becomes nullable — null marks a global metric. Existing metrics
  are migrated into one placement each. No metric value moves.
- **API**: new `/global-metrics` resource (with `/thresholds`), new
  `POST /teams/{team_id}/metrics/copies` and `POST /teams/{team_id}/metrics/inclusions`;
  existing `/teams/{team_id}/metrics` endpoints accept a global metric's id and
  refuse definition changes for it. New error codes listed in design.md.
- **Backend**: `services/metrics.py`, `services/metric_values.py` (board and trend
  read placements), a new `services/global_metrics.py`, `authz.py`, schemas,
  exceptions, routers.
- **Frontend**: a global metrics page for administrators, a header link to it,
  copy and include dialogs and read-only rendering on the metric settings page, a
  global marker on the board and in the metric detail, and both i18n catalogues.
- **Dependencies**: none.
- **Non-goals**:
  - promoting an existing board metric to a global one;
  - a link from a copy back to its source, or propagating later changes of the
    source to its copies;
  - copying recorded values;
  - copying a whole board's metrics in one action;
  - a cross-team comparison view of a global metric;
  - global targets (targets are prose and a separate capability).
