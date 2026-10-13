# Design

## Context

Leadership is a flag on the membership row: `team_members.is_leader`, with a
partial unique index `uq_team_members_one_leader` keeping it to one per team
(`app/models/employee.py`). Every permission is a pure function in
`app/services/authz.py` over `is_admin` and a `Relationship` (`STRANGER`,
`MEMBER`, `LEADER`), which `relationship_to` in `app/api/dependencies.py`
reads from that row. The frontend repeats the "leader or admin" check in four
places: `TeamMembersPage.tsx` (by comparing emails) and `mayConfigure` in
`BoardPage.tsx`, `TeamMeetingsPage.tsx` and `MetricSettingsPage.tsx` (from the
viewer's `is_leader`). The dashboard derives `role` (`leader`/`member`) from
the same flag in `app/services/dashboard.py`.

See proposal.md for why deputies are wanted.

## Goals / Non-Goals

**Goals:**

- Deputies get the leader's authority through the existing `Relationship`
  mechanism, so every router that already asks `may_configure_the_board` or
  `may_manage_membership` grants it with no router change.
- The "no roles" principle holds: deputyship is read from the team's own
  records, per team.

**Non-Goals:**

- A cap on the number of deputies, or a deputy order of precedence.
- Notifying anyone when a deputy is appointed.
- Letting a deputy act as leader for anything outside this capability's
  permission table (for example the pulse check, which is per person).
- An audit history of who was deputy when; the INFO log line is the record.

## Decisions

### D1. A second boolean on `team_members`, not a role column

Add `is_deputy BOOLEAN NOT NULL DEFAULT false` with
`CHECK (NOT (is_leader AND is_deputy))`.

- *Alternative: replace `is_leader` with an enum `position`
  (`leader`/`deputy`/`member`).* Cleaner in the abstract, but it rewrites the
  one-leader partial index, every query and test that reads `is_leader`, and
  the published `is_leader` field, for no behavioural gain. An enum also
  reads like the "role" the project deliberately refuses to have.
- *Alternative: a separate `team_deputies` table.* Needs its own foreign key
  to the membership to keep "a deputy is a member" true by construction;
  the flag gets that for free, the same reason leadership is a flag.

The check constraint is the database backstop; the service rejects the leader
with `team_deputy.is_leader` before it is reached.

### D2. `Relationship.DEPUTY`, and authority by set membership

`relationship_to` returns `LEADER` if `is_leader`, `DEPUTY` if `is_deputy`,
else `MEMBER`. The rules change as follows:

| Rule | Before | After |
|---|---|---|
| `may_configure_the_board` | admin, LEADER | admin, LEADER, DEPUTY |
| `may_manage_membership` (add, remove an ordinary member) | admin, LEADER | admin, LEADER, DEPUTY |
| `may_appoint_deputies` (new: appoint, revoke, remove a deputy) | — | admin, LEADER |
| `may_change_the_leader` | admin | admin (unchanged) |
| `may_record_meeting_data`, `may_read_pulse_answers`, `may_answer_the_pulse_check` | LEADER, MEMBER | LEADER, DEPUTY, MEMBER |

The last row matters: forgetting `DEPUTY` there would silently lock a deputy
out of their own team's meetings. A unit test parametrised over every
relationship pins each row so a missed set fails loudly.

### D3. A deputy does not choose deputies

Decided (the user left it open): appointing, revoking and removing a deputy
belong to the leader and administrators only. A deputy may add a member and
remove an ordinary one, but not touch another deputy, nor revoke themselves.

- *Alternative: deputies are full peers of the leader here too.* Then any
  deputy could appoint more deputies or remove the others, and the leader
  would no longer decide who stands in for them. That is the same reasoning
  that keeps the handover with administrators: the circle of authority is
  set from above it, not from inside it.
- A deputy who wants to step down asks the leader. Accepted as rare.

Removing a deputy from the team is gated by `may_appoint_deputies`, because
otherwise "remove, then re-add" would be a deputy's way round D3. The router
for `DELETE /teams/{id}/members/{employee_id}` therefore looks at the target
member: ordinary → `may_manage_membership`; deputy → `may_appoint_deputies`.
That is the one place the decision needs a fact about the target, not only
the actor, so it is done in the router after reading the team, with the
`authz` functions staying pure.

### D4. Endpoints: `PUT`/`DELETE /teams/{team_id}/deputies/{employee_id}`

Both idempotent, both return `TeamDetail` like the other membership writes.

- *Alternative: `PATCH /teams/{id}/members/{employee_id}` with
  `{is_deputy}`.* One endpoint, but it would also suggest `is_leader` is
  patchable there, which it is not (it has its own administrator-only
  `PUT /leader`). A resource of its own mirrors `/leader`.

Revoking a non-deputy member succeeds unchanged (idempotent `DELETE`);
revoking for a non-member is `team_member.not_found`, reused rather than a
new code because it is the same fact as in removal.

### D5. A handover clears the new leader's deputy flag; the old leader is not made deputy

`change_leader` sets `is_deputy = false` on the new leader in the same flush
that clears the old leader. The previous leader becomes an ordinary member,
as today. If the organization wants them to stand in, the new leader appoints
them. Automatically making them deputy would be a decision taken on the new
leader's behalf.

### D6. Read models

- `MemberRead` gains `is_deputy: bool`. `TeamRead` (the team list) is
  unchanged: it carries only the leader.
- `TeamRole` becomes `Literal["leader", "deputy", "member"]`; the frontend's
  `TeamRole` follows, and `myTeams.role_deputy` is added to both catalogues.

### D7. The frontend asks one helper

The four duplicated checks are replaced by a small `teamAuthority(team,
email, isAdmin)` in `features/teams/` returning `{configure, manageMembers,
chooseDeputies, handOver}`, mirroring D2's table. This is the second time the
same rule is needed (configuration on three pages, membership on one), which
is when the coding standards allow the abstraction. The server still decides;
the helper only hides controls.

### D8. Names

English "Leader deputy", Polish "Zastępca lidera", code `deputy`. Actions:
"Make deputy" / "Mianuj zastępcą", "Revoke deputy" / "Odwołaj zastępcę".
Error codes `team_deputy.not_member`, `team_deputy.is_leader`, each with a
message in both catalogues.

## Risks / Trade-offs

- [A `Relationship` set is updated in one rule and missed in another] → the
  parametrised unit test over every `Relationship` value for every rule.
- [A deputy removes another deputy through the member endpoint] → D3's
  target-aware check, with an integration test for exactly that request.
- [Clients that treat `role` as a two-value enum] → only our frontend
  consumes it, and it is updated in the same change; `tsc` catches a missing
  translation for the new value.
- [A leader with no deputies is still a single point] → unchanged from
  today; deputies are optional.

## Migration Plan

Migration `NNNN_add_team_deputies`, numbered after whatever is the head when
this is applied (`add-metric-groups` adds a migration too, and they must not
both claim `0008`): add the column with a server default of
`false`, then the check constraint. Every existing row satisfies it. The
downgrade drops the constraint and the column; deputies recorded meanwhile
are lost, which is acceptable because they confer only permissions, not data.
Deploy order does not matter: the old code ignores the column.
