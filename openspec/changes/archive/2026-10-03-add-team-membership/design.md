## Context

The only persisted entities are `teams` and `board_definitions` (migration `0001`). `app/services/teams.py` creates a team and its board in a single commit and turns the case-insensitive unique index into `DuplicateTeamNameError`. Every failure leaves the API in one `{field, code, message}` shape: `DomainError` subclasses and `PydanticCustomError` both feed the two handlers in `app/main.py`. The frontend has a single team page (`features/teams/TeamsPage.tsx`) that registers and lists teams through TanStack Query, and it translates error codes through `i18n/apiErrors.ts`.

There is no authentication, so no request knows who is making it. The hub's "your teams" slice therefore stays placeholder. See proposal.md for the motivation and scope.

## Goals / Non-Goals

**Goals:**

- Make "a team has exactly one leader, who is a member" hold at all times, including under concurrent requests, without relying only on the order of service calls.
- Keep the data model small enough for authorization to read later: who leads team X, and which teams does employee Y belong to.

**Non-Goals:**

- Any notion of the current user. The members page acts on behalf of whoever opens it.
- Pagination of members or teams. Teams are tens of people.

## Decisions

### Leadership is a flag on the membership row, not a column on the team

`team_members(team_id, employee_id, is_leader, created_at)` has the primary key `(team_id, employee_id)`. A partial unique index `ON team_members (team_id) WHERE is_leader` lets the database guarantee **at most one** leader per team. The service guarantees **at least one**:

- registration always inserts the leader's membership with `is_leader = true`;
- removing the leader is rejected;
- a handover changes both rows in one transaction.

"The leader is a member" then holds by construction, because the leader *is* a membership row.

Alternatives considered:

- `teams.leader_id NOT NULL` → `employees`, plus a composite FK `(id, leader_id)` → `team_members(team_id, employee_id)`. This makes the database enforce "exactly one, and a member". But the team and its first membership reference each other, so the constraint has to be `DEFERRABLE INITIALLY DEFERRED`, and every insert depends on that. It is too clever for what it buys, given the KISS rule.
- `teams.leader_id` with no composite FK. Membership and leadership could then drift apart, with a leader who is not a member, and only the service would stand between the data and that state.

### A handover locks the team first

A handover runs `SELECT ... FROM teams WHERE id = :id FOR UPDATE`, then unsets the old leader's flag, flushes, and sets the new leader's flag. The flush between the two updates matters: the partial unique index is checked per statement, so setting the new flag first would collide with the old one. The row lock serialises two concurrent handovers on the same team. Without it, two transactions could each unset a flag the other has already moved, and the second commit would fail on the index rather than apply cleanly. The concurrent-handover scenario runs two sessions on separate connections to prove this.

Alternative considered: `SERIALIZABLE` isolation for the request. It works, but it would introduce retry handling into a codebase that has none, for one endpoint.

### Employees are found or created with `INSERT ... ON CONFLICT DO NOTHING`

`employees(id, email, created_at)` has a unique constraint on `email` and a check `email = lower(btrim(email))`, so a non-normalised email can never be stored. To get an employee by email, the service runs `INSERT ... ON CONFLICT (email) DO NOTHING`, then a `SELECT`. Two concurrent first assignments of the same email therefore both end up with the one row, rather than one of them failing. The unique index on `teams` was chosen for the same reason: no read-then-write check.

Normalisation (trim, lower-case) happens in the Pydantic validator, matching how team names are trimmed. The check constraint is the backstop.

Alternative considered: a unique index on `lower(email)` while storing the email as typed, as `teams` does for names. A team name is shown as the team wrote it. An email is an identity key that the OIDC login will match against, and a single canonical spelling is simpler for every later join.

### Email validation is a short explicit rule, not `email-validator`

Pydantic's `EmailStr` needs the `email-validator` package. Its full RFC handling (internationalised domains, deliverability checks) removes no code that BMAPP needs: the addresses are corporate mail addresses entered by colleagues. The rule in the spec (one `@`, a non-empty local part, a dotted domain, no whitespace, at most 254 characters) is a few lines in the validator and maps cleanly onto three codes. The project's rule on dependencies decides this.

### Endpoints, and mutations return the team detail

| Method and path | Body | Success |
|---|---|---|
| `POST /teams` | `{name, leader_email}` | 201, `TeamRead` |
| `GET /teams` | — | 200, `TeamRead[]` |
| `GET /teams/{team_id}` | — | 200, `TeamDetail` |
| `POST /teams/{team_id}/members` | `{email}` | 201, `TeamDetail` |
| `DELETE /teams/{team_id}/members/{employee_id}` | — | 200, `TeamDetail` |
| `PUT /teams/{team_id}/leader` | `{employee_id}` | 200, `TeamDetail` |

`TeamRead` gains `leader: {id, email}` and `member_count`. `TeamDetail` is `{id, name, board, members: [{employee_id, email, is_leader}]}`.

Every mutation returns the whole `TeamDetail`, so the members page can replace its cached query data with the response. There is no invalidate-and-refetch round trip and no client-side merging, and a team has few enough members that the payload is small. The leader is a `PUT` on a sub-resource because a team always has exactly one leader, which makes it a property being replaced rather than something created.

Alternative considered: `PATCH /teams/{team_id}/members/{employee_id}` with `{is_leader: true}`. It suggests that `is_leader: false` is meaningful, but unsetting the only leader is never allowed.

### New domain errors and codes

| Code | Status | Field | Raised by |
|---|---|---|---|
| `employee_email.blank` / `.too_long` / `.invalid` | 422 | `leader_email` or `email` | Pydantic validator |
| `team.not_found` | 404 | none | service |
| `team_member.duplicate` | 409 | `email` | service, from the primary-key violation |
| `team_member.not_found` | 404 | none | service |
| `team_member.is_leader` | 409 | none | service |
| `team_leader.not_member` | 409 | `employee_id` | service |

Each is a `DomainError` subclass in `app/core/exceptions.py`, or a `PydanticCustomError`, so no router decides a status. `team_member.duplicate` is detected from the primary-key violation, the same way `team_name.duplicate` is detected from its index.

### Registration creates team, board, employee and leadership in one commit

`register_team(session, name, leader_email)` builds the team and board as it does today. It then finds or creates the employee and adds the leader's membership, all before the single commit. A duplicate name therefore rolls back an employee row that was just inserted, which is what the scenario "no employee is created" requires. Because of that, the find-or-create runs inside the same transaction, never in a separate commit.

### Frontend: a members page under `/teams/:teamId/members`

- `/teams` keeps registration and the list. The form gains a leader email field. Each list entry shows the leader's email and member count, and links to the members page.
- `/teams/:teamId/members` is a new `TeamMembersPage` in `features/teams/`, with its own `useTeam(teamId)` query keyed `['teams', teamId]`. The three mutations write their `TeamDetail` response into that key with `setQueryData`, and invalidate `['teams']` with `exact: true` so that the list's member counts follow. Without `exact`, the prefix match would also refetch the detail it has just written.
- The bare `/teams/:teamId` is deliberately left free: in the glossary, a team's page *is* its board, and the board capability will want that address.
- `api/teams.ts` gains the types and the four calls. `translateErrorCode` already handles any code that has a catalogue entry, so the new codes only need entries in `en.errors` and `pl.errors`.

### Polish vocabulary added to the glossary

| English | Polish |
|---|---|
| Employee | Pracownik |
| Member | Członek zespołu |
| Leader | Lider zespołu |
| Make leader | Ustaw jako lidera |
| Remove (member) | Usuń z zespołu |

These extend the glossary in the `add-i18n-en-pl` design. Later capabilities, such as the responsible employee on problems and tasks, inherit them.

### Testing

- One integration test module per requirement, one test per scenario, named after it, as `test_register_a_team_with_its_board.py` does today. The concurrent-handover test opens two connections outside the per-test rollback fixture and cleans up after itself.
- Unit tests for the email validator: every boundary case in the email scenarios, without I/O.
- Vitest for every scenario of "Members are managed from the team page".
- Playwright extends `register-a-team.spec.ts` with a leader email, and adds `manage-team-members.spec.ts`: register, add two members, hand over, remove the previous leader, and the same flow read in Polish.
- No BDD. The leader rule is a structural invariant tested at the API. It is not one of the plain-language business rules that CLAUDE.md reserves pytest-bdd for.

## Risks / Trade-offs

- [Breaking `POST /teams`] → The only client is the frontend in this repository, updated in the same change. The e2e spec is updated in the same change too.
- [Migration `0002` refuses to run over existing teams] → It cannot invent a leader, and leaving teams without one would break the invariant from the first read. Nothing is deployed, so the cost is resetting local volumes. The migration's error message names the command (`docker compose down -v`), and the README notes it.
- [Lower-casing the whole address, including the local part] → In theory RFC 5321 allows case-sensitive local parts. Neither ADFS nor Exchange behaves that way, and treating case as significant would split people in two. If the identity broker ever returns a differently cased claim, it matches anyway, which is the outcome we want.
- [Anyone can change any team's leader] → This is accepted only while nothing is deployed, the same as team registration. The authorization change decides who may do it. The membership table is shaped so that "is the caller this team's leader?" is a single indexed lookup.
- [Employees accumulate with no way to correct a mistyped email] → A typo creates a stray employee who belongs to no team after removal. That is harmless for now. Editing employees is a candidate for the authorization or admin change.

## Migration Plan

1. `0002_add_employees_and_team_members` first checks `SELECT count(*) FROM teams`. If it is non-zero, it raises with a message explaining that existing teams have no leader and naming `docker compose down -v`.
2. Otherwise it creates `employees` and `team_members`, with the FKs: `team_id` → `teams` `ON DELETE CASCADE` and `employee_id` → `employees` `ON DELETE RESTRICT`, so an employee who still belongs to a team can never vanish. It also creates the partial unique index and an index on `team_members(employee_id)` for "teams of an employee".
3. Downgrade drops both tables. It does not need to touch `teams`.

## Open Questions

- Should the members page show when someone joined? `created_at` is stored on the membership either way, so the answer changes only the display.
