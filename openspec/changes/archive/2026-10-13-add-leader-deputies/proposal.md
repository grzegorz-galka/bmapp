# Proposal

## Why

A team has exactly one leader, and only that leader (or an administrator) may
configure the board, set the schedule and manage members. When the leader is
away, nobody on the team can add a metric, fix a threshold or add a new
colleague, and the work waits for an administrator. Teams want to name one or
more **leader deputies** (*zastępca lidera*) who can stand in for the leader.

## What Changes

- A team MAY have any number of **leader deputies**, each one of its own
  members. The leader is never a deputy.
- A deputy is permitted everything the leader is permitted on that team:
  configuring the board (metrics, thresholds, copying, global metrics, the
  schedule) and adding and removing ordinary members.
- Two things stay above a deputy: **who leads** the team (still an
  administrator's decision, as today) and **who the deputies are**. Only the
  team's leader or an administrator appoints and revokes a deputy, and only
  they remove a member who is a deputy.
- New endpoints: `PUT /teams/{team_id}/deputies/{employee_id}` appoints,
  `DELETE /teams/{team_id}/deputies/{employee_id}` revokes. New error codes
  `team_deputy.not_member` and `team_deputy.is_leader`.
- A team's member now carries `is_deputy` beside `is_leader`. The dashboard's
  team role gains the code `deputy`. Both are additions; existing fields keep
  their meaning.
- Handing the leadership to a deputy makes them the leader and no longer a
  deputy.
- The members page marks deputies by a word ("Leader deputy" / "Zastępca
  lidera") and offers appoint and revoke actions to whoever may use them. The
  board, meetings and metric settings pages offer their configuration
  controls to deputies as well as to the leader.
- The glossary in `CLAUDE.md` gains **Leader deputy**, and the permission
  table in `SECURITY.md` gains the deputy column and the two new endpoints.

## Capabilities

### New Capabilities

None. Deputies are part of a team's membership and its permissions.

### Modified Capabilities

- `team-membership`: a member may be a leader deputy; deputies are appointed
  and revoked; reading a team reports them; a handover clears the new
  leader's deputy flag; the members page shows and manages them.
- `authorization`: the relationship to a team gains *deputy*; a deputy may
  configure the board, set the schedule and manage ordinary members; only the
  leader or an administrator appoints, revokes or removes a deputy; the
  interface offers deputies the leader's controls.
- `dashboard`: the viewer's role on a team may be *leader deputy*.

## Impact

- **Database**: one Alembic migration adding `team_members.is_deputy`
  (boolean, default false) with a check that a member is not both leader and
  deputy. No data changes.
- **Backend**: `app/models/employee.py`, `app/services/authz.py`
  (`Relationship.DEPUTY`, new `may_appoint_deputies`),
  `app/api/dependencies.py` (`relationship_to`), `app/services/teams.py`,
  `app/api/teams.py`, `app/schemas/team.py`, `app/schemas/dashboard.py`,
  `app/services/dashboard.py`, `app/core/exceptions.py`.
- **API**: two new endpoints, two new error codes, one new field on a
  member, one new value of the dashboard team role. Additive; no client
  breaks.
- **Frontend**: `api/teams.ts`, `api/dashboard.ts`, `TeamMembersPage.tsx`,
  the three `mayConfigure` checks in `BoardPage.tsx`,
  `TeamMeetingsPage.tsx`, `MetricSettingsPage.tsx`, `TeamsPanel.tsx`, both
  catalogues.
- **Docs**: `CLAUDE.md` (glossary, authorization summary), `SECURITY.md`
  (permission table).
- **Dependencies**: none.
- **Ordering**: independent of `polish-gui` and `add-metric-groups`; the
  members page is not touched by either.
