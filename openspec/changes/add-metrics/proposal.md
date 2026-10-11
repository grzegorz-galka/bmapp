## Why

The first thing a board meeting does is compare each metric's value with what was expected and show whether it is in the green. BMAPP has teams and, with `add-meetings`, the meetings to attach values to, but nothing to measure.

The board that runs today (a stand-alone HTML tool, preceded by an Excel sheet) shows that a fixed acceptable min/max with red/green is not enough. Expectations move: in six months its revenue threshold changed once, its utilisation threshold four times, and its headcount plan every month. Each past meeting has to be judged against the threshold that applied then. A middle state, amber for "off, but within tolerance", is what the team uses most to steer.

## What Changes

- New **metrics** on a team's board. Each has:
  - a name, and a unit written as free text (`%`, `mln zł`);
  - the number of decimals to show;
  - a direction: higher is better, lower is better, or within a band;
  - an optional group label and a display position;
  - an optional owner, who is a member of the team.

  A metric with recorded values is **retired**, never deleted. Its history stays.
- New **thresholds**, kept as an append-only history of versions. Each version gives the green and amber zones and the date it takes effect from. It records a mandatory reason and who made the change. A version may be back-dated. A value is judged against the version in force on its meeting's date.
- New **metric values**. One number per metric per meeting, entered in the metric's unit, as it is shown, with no hidden scaling. A value has an optional comment and an optional **manual colour**, which requires a comment and is marked as set by hand on the board.
- **Status** is computed when read, never stored: green, amber, red, no data, or no threshold.
- **Editing window.** Values can be recorded and changed only at the team's latest meeting dated today or earlier and at its first meeting dated after today. Older meetings are frozen. An administrator may correct a frozen value with a mandatory reason, and each correction is logged.
- **BREAKING** (to the `add-meetings` behaviour, before it is released): a meeting with recorded values can no longer be moved or deleted.
- The **board page** at `/teams/:teamId` shows one meeting's metrics as grouped tiles: value, colour, the change since the previous meeting, the threshold in force and a sparkline. It has a meeting navigator.
- A **recording view** shows "12 of 14 recorded" for a meeting and who is still missing, and takes values, comments and manual colours.
- A **metric detail** shows the full trend chart with the threshold steps, the recent values with their comments, and the threshold and correction history.
- A **metrics settings page** lets the leader manage metrics and thresholds.
- **Documentation.** CLAUDE.md's "acceptable min/max" and "red or green" wording, its domain table and its glossary change. The numeric term is **threshold**. **Target** stays a prose declaration that never drives a colour.

## Capabilities

### New Capabilities

- `metrics`: A board's metric definitions, their versioned thresholds, and the rule that turns a value and a threshold into a status.
- `metric-values`: The values recorded for a board's metrics at its meetings. Covers the editing window, manual colours, administrator corrections, and the board, recording and trend views over them.

### Modified Capabilities

- `meetings`: Moving and deleting a meeting are refused once values are recorded at it.
- `authorization`: The leader or an administrator configures metrics and thresholds. Members record values within the editing window. Only administrators correct frozen values. The interface offers these controls only to those permitted.

## Impact

- **Order**: depends on `add-meetings`, which must be implemented and archived first. Its `meetings` spec, and its version of the authorization interface requirement, are what this change modifies.
- **Data**: migration `0004` adds the `metrics`, `metric_thresholds`, `metric_values` and `metric_value_corrections` tables. All numbers are exact decimals.
- **API**: new endpoints under `/teams/{team_id}/metrics` and `/teams/{team_id}/meetings/{meeting_id}/…`, listed in design.md. The meeting move and delete endpoints gain a `meeting.has_values` rejection.
- **Dependencies**: **Recharts** (frontend), the charting library CLAUDE.md already names, used here for the first time. No backend dependency.
- **Tests**: the status rule becomes the project's first pytest-bdd feature.
- **Non-goals**:
  - computed metrics (pulse average, weighted project status);
  - per-unit breakdowns (OTIF per organizational unit);
  - extra fields on a value;
  - showing a value as a gap to plan;
  - monthly series;
  - flywheel stage tags;
  - importing the legacy tool's history;
  - problems and tasks;
  - Excel export;
  - making the hub's readiness figures real.

  Each is a later change.

## Assumptions

- **A metric's direction is fixed when it is created.** Changing what "better" means would invalidate every threshold version. A different direction is a new metric.
- **Values are stored as entered.** A percentage is typed as `95,3`, not `0.953`, and revenue in `mln zł` as `165,36`. An importer from the legacy tool, which stored fractions and whole złoty, would rescale.
- **The change since the previous meeting compares with the team's immediately preceding meeting.** If that meeting has no number for the metric, no change is shown, rather than reaching further back.
- **Threshold versions and corrections are never edited or deleted.** A mistake is fixed by a newer version or a newer correction, so the log stays complete.
