## Why

A board meeting does two things beside reading the metrics: it names what stands in the team's way (**problems**) and agrees who does what by when (**tasks**). BMAPP records meetings, metric values and the pulse check, but not these, so teams still keep them in the legacy board (`samples/Boardmeeting_offline_2026-10-10.html`, views `vBoard` and `vPT`). The hub's problem/task funnel and its "assigned to me" list are still invented figures for the same reason.

## What Changes

- New **problems** of a team: a summary, a reason (root cause), a solution proposal, an optional responsible member, an optional due date, an optional metric of the board it concerns, and a progress stage.
- New **tasks** of a team: a summary, details, an optional responsible member, an optional due date, an optional metric, an optional problem of the same team it was raised from, and a progress stage.
- **Progress is a PDCA stage**, as in the legacy board: *not started*, *plan*, *do*, *check*, *act – closed*. A new item starts at *not started* unless given another stage. Any member moves an item to any stage, forwards or back, until it reaches *act*.
- **Closing archives.** An item that reaches *act* is closed and archived. An archived item is read-only: it cannot be changed, reopened or deleted. No item is ever deleted.
- **Items are tied to meetings.** Each item records the meeting at which it was raised and, once closed, the meeting at which it was closed. That meeting is the one the team's board opens at when the change is made — its first meeting dated today or later, or else its latest — or none if the team has no meetings. Items can be added and changed at any time, not only while a meeting is open for values.
- **The board shows the active problems and tasks** beside the metric tiles: summary, responsible, due date with an overdue mark, the stage as a PDCA ball that can be moved on, a "new" mark for items raised at the meeting shown, and the count of items closed at it. Adding and editing happen in a dialog; a problem offers "Task from this problem".
- **The board gains an *Archived* view** (`?view=archived`) listing closed problems and tasks with the meetings at which they were raised and closed.
- **The hub's funnel and "assigned to me" list come from the recorded items**, across the viewer's teams. The rest of the hub stays placeholder.
  - **BREAKING** (hub API, still provisional): an assigned item's `summary` becomes plain text rather than English and Polish, `progress` (0–100) becomes `stage` (a PDCA code), and it gains `team_id`.
  - **BREAKING** (hub API): the funnel's `scope_meetings` becomes `scope_teams`. The figures are all-time, across the viewer's teams.
  - The hub stops guaranteeing an overdue and an on-time assigned item.

## Capabilities

### New Capabilities

- `problems-and-tasks`: A team's problems and tasks, their PDCA progress, the meetings at which they were raised and closed, archiving, and how the board and its *Archived* view present them. Problems, tasks and archiving are one capability rather than three: they share one lifecycle, one set of permissions and one place on the board, and separate specs would repeat each other.

### Modified Capabilities

- `hub`: The funnel and the assigned items are computed from the recorded problems and tasks of the viewer's teams. An assigned item carries its stage instead of a percentage, and its summary as typed. The funnel's scope is the viewer's teams.
- `authorization`: A team's members, its leader and administrators add and change its problems and tasks; nobody changes an archived one. The board offers adding, editing and moving a stage only to such a viewer.

## Impact

- **Order**: builds on `add-pulse-check`, which is nearly complete on this branch and should be archived first. This change modifies no requirement that change touches; its authorization additions are separate requirements.
- **Data**: migration `0007` adds the `problems` and `tasks` tables.
- **API**: `GET/POST /teams/{team_id}/problems`, `PATCH /teams/{team_id}/problems/{problem_id}`, the same for `tasks`. `GET /hub` changes shape as above. New error codes, listed in design.md.
- **Frontend**: a problems-and-tasks section on `BoardPage`, the item dialog, the PDCA ball, the *Archived* view, and the hub's `FunnelPanel` and `AssignedItems` on the new shape. New strings and codes in `en.ts` and `pl.ts`.
- **Dependencies**: none.
- **Non-goals**:
  - a per-team running number ("Lp", "nr 3") for items;
  - reopening an archived item, or deleting an item added by mistake;
  - the legacy "registered in SW" flag and its free-text comment on a problem;
  - turning a pulse answer into a task;
  - a history of an item's stage over meetings;
  - search and filters on the board's lists;
  - the hub's preparation counts, which stay placeholder;
  - importing the legacy board's problems and tasks.

  Each is a later change.

## Assumptions

- **The responsible person is one member of the team, and is optional**, as is the due date. The legacy board allows an item without either ("bez odpowiedzialnego"). A person who leaves the team stays responsible for their items until someone changes it. "Anna / Michał" style shared ownership is not supported: one item, one person.
- **A responsible person is shown by email**, as everywhere else in BMAPP.
- **Every member may change every item of the team**, not only the responsible person, as in the legacy board and as for metric values.
- **Overdue** means a due date before today, Europe/Warsaw, on an active item.
- **The board's lists are the team's active items now**, whichever meeting is shown: an item's stage has no history to show it as it was at an older meeting.
- **Limits**: summary required, up to 500 characters; the other texts optional, up to 4000 characters each.
- **A task's problem** must be a problem of the same team, active when the task is raised from it. The link stays when either is closed.
- **A linked metric** must be on the team's board when linked. It stays linked if later retired or removed from the board, and the link is cleared if the metric is deleted.
- **A meeting can still be deleted** when items were raised or closed at it; those items then record no meeting. Meetings are deleted only when opened by mistake, and an item must not hold one in place.
