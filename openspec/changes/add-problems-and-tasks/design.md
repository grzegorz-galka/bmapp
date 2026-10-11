## Context

See proposal.md for why. What this builds on:

- `meetings`: a meeting belongs to a team and has a date on the Europe/Warsaw clock. `editable_meetings(meeting_dates, today)` in `app/services/metric_values.py` and `team_meeting_dates` already read a team's meeting dates; `today()` lives in `app/services/meetings.py`.
- `authz.may_record_meeting_data(is_admin, relationship)` already names problems and tasks in its docstring: anyone on the team, or an administrator. `relationship_to` in `app/api/dependencies.py` reads the relationship.
- A metric sits on a board through `board_metrics` (team, metric, position, group, owner, retired). A metric can be deleted only while it has no values; a global metric can be removed from a board.
- `board_metrics.owner_id` is the precedent for "a member of the team, by employee id": `metric_owner.not_member`, `RESTRICT` on the employee.
- `GET /hub` is built from constants in `app/services/hub.py` with no database session. Its `Funnel` and `AssignedItem` are the slice this change replaces.
- `BoardPage` keeps the meeting shown in `?meeting=` and a view in `?view=pulse`; it already reads the team's members to decide what to offer.
- The legacy board (`vBoard`, `vPT`, `itemModal`, `ball()` in the sample) is the agreed behaviour: lists beside the tiles, a PDCA ball that steps the stage on, a modal with the fields, "Zadanie z problemu".

## Goals / Non-Goals

**Goals:**

- One lifecycle rule — the stage, closing, the meeting attribution, the archive guard — written once and used by both kinds of item.
- Archived is a fact derived from the stage, not a second field that could disagree with it.

**Non-Goals:**

- A stage history. The legacy board has none either; `raised_at`, `closed_at` and the two meetings are what the board and the archive need.
- Pagination of the archive. A team closes a handful of items a week; years of them are a few hundred rows.

## Decisions

### Two tables, one shape

```
problems(id uuid PK, team_id → teams CASCADE,
         summary varchar(500) NOT NULL, reason text NOT NULL DEFAULT '', solution text NOT NULL DEFAULT '',
         responsible_id → employees RESTRICT NULL, due_on date NULL, metric_id → metrics SET NULL NULL,
         stage pdca_stage NOT NULL DEFAULT 'not_started',
         raised_at timestamptz NOT NULL, raised_meeting_id → meetings SET NULL NULL,
         closed_at timestamptz NULL, closed_meeting_id → meetings SET NULL NULL,
         updated_at timestamptz NOT NULL,
         CHECK ((stage = 'act') = (closed_at IS NOT NULL)),
         CHECK (char_length(reason) <= 4000), CHECK (char_length(solution) <= 4000))

tasks(... the same, with details text in place of reason and solution,
      problem_id → problems RESTRICT NULL)
```

`pdca_stage` is a PostgreSQL enum, mapped like `Direction` in `app/models/metric.py`. Indexes: `(team_id, closed_at)` for the two lists, and a partial index on `responsible_id WHERE closed_at IS NULL` for the hub. Migration `0007_add_problems_and_tasks.py`.

- **Archived is `closed_at IS NOT NULL`**, and the check constraint ties it to `stage = 'act'`, so the database cannot hold a closed item at `do` or an open one at `act`.
- **`SET NULL` on the meetings**, so deleting a meeting opened by mistake is not blocked by a task someone raised that Monday. The proposal records this as an assumption.
- **`SET NULL` on the metric**: a metric is deletable only while it has no values, which means it was added by mistake; the link should not hold it in place. Retiring or removing it from the board leaves the row, so the link stays.
- **`RESTRICT` on the problem**: problems are never deleted, so this never fires; it states that rule in the schema too.

Alternatives considered:

- **One `items` table with a `kind` column** and nullable reason/solution/details/problem columns. Fewer tables, but the kind-specific columns need conditional checks, a task's problem needs a self-reference that must point at a row of the other kind, and every query filters on `kind`. Two tables of the same shape are plainer, and the code shares the lifecycle through one module rather than through one table.
- **A boolean `archived` beside the stage.** Two fields for one fact.

### The lifecycle is a pure module

`app/services/item_lifecycle.py`, no I/O:

- `Stage` (`StrEnum`: `not_started`, `plan`, `do`, `check`, `act`) in `app/core/item_enums.py`, beside `metric_enums.py`.
- `meeting_of_the_moment(meetings: list[MeetingDate], today) -> MeetingDate | None`: the first dated today or later, else the latest, else none. The same rule the board page uses to choose the meeting it opens at; the frontend's copy stays where it is.
- `apply_stage(current_closed_at, new_stage, now, meeting) -> (closed_at, closed_meeting)`: closing sets both; staying active leaves them none.
- `is_overdue(due_on, closed_at, today) -> bool`.

The problems and tasks services (`app/services/problems.py`, `app/services/tasks.py`) each load and lock the row (`SELECT … FOR UPDATE`), refuse an archived one, validate the references, apply the fields and call `apply_stage`. Locking makes "check it is active, then close it" atomic when two members close the same item at once; the second gets `…archived`.

Alternatives considered:

- **The client names the meeting**, as the board page knows which one it shows. But the stage can also be moved from the hub later, and the meeting shown can be any old one; the server's rule gives one answer wherever the change comes from.
- **Only while a meeting is open** (the metric-values window). The user chose edits at any time; an owner should be able to tick a task off on Friday.

### The API

| Method | Path | Body / result | Guard |
|---|---|---|---|
| `GET` | `/teams/{team_id}/problems?state=active\|archived` | `[ProblemRead]` | signed in |
| `POST` | `/teams/{team_id}/problems` | `ProblemCreate` → `ProblemRead`, 201 | `may_record_meeting_data` |
| `PATCH` | `/teams/{team_id}/problems/{problem_id}` | `ProblemChange` → `ProblemRead` | idem |
| `GET`, `POST`, `PATCH` | `/teams/{team_id}/tasks…` | the same for tasks | idem |

`state` defaults to `active`. No `DELETE` route exists, so FastAPI answers 405.

`ProblemRead`: `id, team_id, summary, reason, solution, responsible: {employee_id, email} | null, due_on, metric: {id, name} | null, stage, archived, overdue, raised_at, raised_meeting: {id, date} | null, closed_at, closed_meeting: {id, date} | null, updated_at`. `TaskRead` replaces reason and solution with `details` and adds `problem: {id, summary} | null`.

`ProblemChange` is a partial body: only fields present in `model_fields_set` change; `null` clears an optional field; `summary: null` is `item_summary.blank`. The frontend sends only what changed, so two members editing different fields of one item at once do not overwrite each other. `stage` is the target stage, never "advance", so a double click or two members stepping the same ball land on the same stage.

The router checks the team exists (`team.not_found`), then the permission (`auth.forbidden`), then the service raises `…not_found` or `…archived`: a stranger never learns more than that they may not.

Alternatives considered:

- **`POST …/advance`** for the ball. Not idempotent: two members stepping a stale view move the item two stages.
- **One `/items` resource with a `kind`.** The two bodies differ; two resources keep the OpenAPI types exact.

### Error codes

| Code | HTTP | Field | Where |
|---|---|---|---|
| `item_summary.blank` | 422 | `summary` | `PydanticCustomError`, after trimming |
| `item_summary.too_long` | 422 | `summary` | idem, over 500 |
| `item_text.too_long` | 422 | `reason` / `solution` / `details` | idem, over 4000 |
| `item_responsible.not_member` | 409 | `responsible_employee_id` | `ItemResponsibleNotMemberError(DomainError)` |
| `item_metric.not_on_board` | 409 | `metric_id` | `ItemMetricNotOnBoardError` |
| `task_problem.not_found` | 409 | `problem_id` | `TaskProblemNotFoundError` |
| `task_problem.archived` | 409 | `problem_id` | `TaskProblemArchivedError` |
| `problem.not_found` / `task.not_found` | 404 | — | `ProblemNotFoundError` / `TaskNotFoundError` |
| `problem.archived` / `task.archived` | 409 | — | `ProblemArchivedError` / `TaskArchivedError` |

An unknown stage or a malformed date is `request.invalid_field`, as an unknown direction is for metrics. Codes are shared by kind where the rule is shared (`item_*`), and per kind where the message names the thing (`problem.archived`).

### The hub reads the two tables

`build_hub_summary` gains a `Session`. Two queries, both through `team_members` for the caller's employee:

- the funnel: `SELECT kind, bucket, count(*)` over a `UNION ALL` of problems and tasks of the caller's teams, with `bucket = CASE WHEN closed_at IS NOT NULL THEN 'archived' WHEN stage = 'not_started' THEN 'open' ELSE 'in_progress' END`;
- the assigned items: active problems and tasks with `responsible_id` the caller's, joined to the team for its name, ordered by due date with none last.

A caller with no employee record gets zeros and no items. Schema changes, all in `app/schemas/hub.py`:

- `Funnel.scope_meetings` → `scope_teams: int`;
- `AssignedItem.summary: LocalizedText` → `str`; `progress: int` → `stage: Stage`; add `team_id`.

`provisional` stays `True`: the declarations, teams, preparation counts and in-session flag are still invented. The hub's team list remains placeholder while the funnel's scope counts real memberships, so the two can disagree on a fresh system; this lasts until the hub's teams are made real.

### The board: a section beside the tiles, a third view

New `features/board/items/`:

- `ItemLists.tsx` — the problems list and the tasks list, as the sample's `.side` aside: number of items, "Add" buttons, one `ItemEntry` per item, the empty state, "closed at this meeting: n".
- `ItemEntry.tsx` — summary (opens the dialog), responsible email, "due 14 Oct" or "overdue 13 Oct" in words, "new" when `raised_meeting.id` is the meeting shown, the task's problem, the metric's name, and the `PdcaBall` as a button.
- `PdcaBall.tsx` — the sample's `ball()` as inline SVG, stage named in its accessible label and in visible text beside it; colours from new `--pdca-*` tokens in `theme.css`, held to 3:1 by `contrast.test.ts`.
- `ItemDialog.tsx` — one native `<dialog>` for both kinds, fields per kind; the responsible person from the team's members, the metric from the board's active metrics, a native date input as the meetings page uses; a "Raise a task from this problem" action that reopens it as a new task with `problem_id` set. Moving to `act`, here or from the ball, asks for confirmation first.
- `ArchivedView.tsx` — two read-only tables: summary, responsible, due date, raised at, closed at (meeting dates, or the closing date when no meeting is recorded).
- `useItems.ts` — queries keyed `['teams', id, 'problems', state]` and `…'tasks'…`; mutations invalidate both states of that kind and `['hub']`.

`BoardPage`'s view switch gains *Archived*, kept as `?view=archived` beside `?meeting=`. The metrics view becomes a two-column grid — tiles, then the aside — collapsing to one column below 1100px, as the sample's `.board`. The board fetches the archived lists too, for the "closed at this meeting" count; the Archived view reuses the same cached queries.

The hub's `AssignedItems` replaces the progress bar with the `PdcaBall` and the stage's name, and links each item to `/teams/{team_id}`; `FunnelPanel` states its scope as "{{count}} teams".

### Strings

New keys under `items.*` (shared by the board and the hub, replacing the hub's `items.progress`), `pdca.*` and `archive.*`, plus the eleven new codes, in `en.ts` and `pl.ts`. Polish follows the `add-i18n-en-pl` glossary (Problem, Zadanie, Zarchiwizowane) and the sample's labels:

| Code | English | Polish |
|---|---|---|
| `not_started` | Not started | Nie rozpoczęte |
| `plan` | Plan | Plan |
| `do` | Do | Do – realizacja |
| `check` | Check | Check – weryfikacja |
| `act` | Act – closed | Act – zamknięte |
| reason | Reason | Przyczyna |
| solution | Solution proposal | Pomysł na rozwiązanie |
| task from problem | Raise a task from this problem | Zadanie z problemu |

## Risks / Trade-offs

- [An item closed by mistake cannot be reopened] → The dialog and the ball ask for confirmation before `act`. Reopening is listed as a follow-up if teams need it.
- [An item added by mistake cannot be deleted] → It can be closed with a summary saying so; it then sits in the archive. Accepted, because "archived, never deleted" is a stated rule.
- [Two members edit the same field at once; the later save wins silently] → Partial updates limit it to the same field; at about ten people round one board, an optimistic version check is not worth its UI.
- [The meeting attribution surprises: a task raised on Thursday, after next week's meeting is opened, counts as raised at next week's] → That is the meeting at which the team will first see it; the rule is stated in the spec and shown as "new" there.
- [The board makes four list requests] → Small, indexed, and cached; the Archived view reuses two of them.

## Migration Plan

`0007` creates the enum, the two tables, their constraints and indexes; downgrade drops them. No backfill. Deploy as usual: `alembic upgrade head`, then backend and frontend together, since `GET /hub` changes shape and the old frontend would misread `summary` and `progress`. Rolling back the code needs the frontend rolled back with it; the tables can stay.

## Open Questions

- Whether a problem's summary should be shown on its tasks' entries in full or only "from problem: …" truncated. A layout detail, settled on the page.
