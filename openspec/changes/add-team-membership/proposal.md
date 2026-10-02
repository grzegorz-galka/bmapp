## Why

A team in BMAPP today is only a name and a board. Nobody belongs to it and nobody leads it. Yet every capability still to come depends on people: the hub shows "your teams", problems and tasks have a responsible employee, and authorization lets the team leader configure the board and members edit its problems and tasks. Employees, team membership and the team leader are the next root entities. Without them, every later capability would invent its own notion of who someone is.

## What Changes

- Introduce **employees**, identified by email, as the identity BMAPP keys on. An employee is created the first time their email is assigned to a team. There is no separate employee screen and no employee endpoint. The later OIDC login matches on the same email.
- Introduce **team membership**: a team has many members and an employee may belong to many teams.
- Introduce the **team leader**: every team has exactly one leader, and the leader is always one of its members. One employee may lead several teams.
- **BREAKING**: registering a team now requires the leader's email alongside the name. The leader becomes the team's first member. `POST /teams` without `leader_email` is rejected.
- The team list now carries each team's leader and member count. A new team detail carries the full member list.
- New operations: add a member by email, remove a member, and hand the leadership to another member. The leader cannot be removed until someone else leads.
- The team page at `/teams` gains the leader field in its registration form, and each listed team links to a new members page at `/teams/:teamId/members`. That page lists the members, adds and removes them, and flags the leader.
- New stable error codes for the email, membership and leadership rejections, translated in both catalogues.
- The `team-board` Purpose stops referring to indicators, which `CLAUDE.md` excludes from the domain.

## Capabilities

### New Capabilities

- `team-membership`: Employees identified by email and created on first assignment; the members of a team; and its single leader, drawn from those members. Covers adding and removing members, handing over leadership, and reading a team with its members.

### Modified Capabilities

- `team-board`: Registering a team requires a leader, who becomes its first member. The team list returns each team's leader and member count.

## Impact

- **Data**: new `employees` and `team_members` tables in migration `0002`. Existing `teams` rows cannot be given a leader automatically, so the migration refuses to run against a database that already holds teams. That only affects local development databases, since nothing is deployed. They are reset with `docker compose down -v`.
- **API**: `POST /teams` changes shape (breaking). `GET /teams` gains fields. New endpoints: `GET /teams/{team_id}`, `POST /teams/{team_id}/members`, `DELETE /teams/{team_id}/members/{employee_id}` and `PUT /teams/{team_id}/leader`.
- **Frontend**: `src/api/teams.ts`, the `teams` feature, a new route in `routes.tsx`, `en.ts`/`pl.ts`, and the `register-a-team` end-to-end spec, which must now supply a leader.
- **Dependencies**: none added. Email validation is a small explicit rule rather than `email-validator`.
- **Unchanged**: the hub still serves placeholder data. Replacing its "your teams" slice needs a signed-in identity, which arrives with authentication.
- **Non-goals**: authentication and authorization; renaming or deleting teams; employee names or any personal data beyond email; editing or deleting employees; the board schedule; and an employee directory or search.

## Assumptions

- **Anyone may manage membership for now.** Every endpoint stays open, as team registration already is. Who may add members or change the leader (the leader, an administrator, or both) is decided by the authorization change. Until then nothing is deployed.
- **Emails are compared and stored in lower case**, after trimming. ADFS and most mail systems treat the local part case-insensitively in practice, and two records for `Jan.Kowalski@` and `jan.kowalski@` would split one person in two.
- **Removing a member never deletes the employee.** An employee who belongs to no team stays on record, because problems and tasks will later reference employees, and archived items must keep resolving to someone.
- **Leadership changes hands only between members.** Making a non-member the leader takes two steps: add them, then make them leader. That keeps "the leader is a member" a single rule.
