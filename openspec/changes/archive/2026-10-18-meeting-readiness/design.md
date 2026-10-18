# Design

## Context

See `proposal.md` for why. What already exists and shapes the approach:

- **The board's completeness.** A meeting's board already returns
  `completeness: {recorded, total, missing[]}`, where each missing metric
  carries its owner (`app/services/metric_values.py`). An owner lives on the
  placement (`board_metrics.owner_employee_id`) and keeps resolving after
  leaving the team.
- **The pulse results.** They return `members`, `answered`, `missing_count`
  and `missing[]`. `missing[]` is `null` for a viewer who may not read
  individual answers (`app/schemas/pulse.py`), and it lists current members
  only.
- **The dashboard summary.** `GET /dashboard` is built in a fixed number of
  statements (`app/services/dashboard.py`: `_recorded`, `_answered` and so
  on, each one grouped query over every listed meeting). A row carries
  `recorded`/`total` and the viewer's own `pulse_answered`.
- **Opening a meeting.** `MeetingOpen` takes only a date and a start time.
  `change_meeting` already validates a host with `MeetingHostNotMemberError`.
- **Hide names.** It is local state in `PulseView`, so it is lost when that
  view unmounts.
- **Board addresses.** The board already opens a list from its hash
  (`#problems`, `#tasks`, scrolled into view by `ItemLists`).

## Goals / Non-Goals

**Goals:**

- One rule for who owes data, computed in one backend function. The board
  and the dashboard both report its result.
- The readiness panel is built from data the board already loads, plus one
  count.
- No new endpoint and no new error code.

**Non-Goals:**

- Sending reminders.
- Storing anything about readiness. It is computed when read, like status.
- Changing who may read individual pulse answers.

## Decisions

### 1. Owing is counted on the server, and the names are merged on the client

- **The count.** A backend function `owing_by_meeting(session,
  meeting_ids) -> dict[meeting_id, int]` counts, in one statement, the
  distinct employees in:
  - the owners of active placements on the meeting's board with no number
    recorded at that meeting, UNION. A row that holds only a comment or a
    colour set by hand still leaves its metric missing, as
    `completeness.missing` and the dashboard's `recorded` already count it.
  - the current `team_members` of the meeting's team with no `pulse_answers`
    row at that meeting.

  Two callers use it. The dashboard calls it for all listed meetings, which
  adds one statement, so the count stays fixed (7 → 8). The board of a
  meeting also gains one statement (6 → 7). The board of a meeting calls
  it for that one meeting and returns `completeness.owing`.
- **The names.** The panel's list of names is the union, by lower-cased
  email, of `completeness.missing[].owner.email` and `pulse.missing[].email`.

The count comes from the server because a viewer who may not read pulse
names cannot compute a distinct count without them, and the spec requires the
board and the dashboard to agree. The names are merged on the client because
both lists are already loaded and already carry the right privacy rule. The
alternatives considered:

- **A new `GET …/meetings/:id/readiness` endpoint returning the people.**
  It is one source for both, but it is a third place deciding pulse privacy,
  and an endpoint the panel would load in addition to data it already has.
  Rejected.
- **Counting on the client only.** The dashboard has no lists to count from,
  and an outside viewer can't de-duplicate. Rejected.

A test asserts that, for a member, the number of names the panel merges
equals `completeness.owing`. That pins the two definitions together.

### 2. The field names

| Where | Field | Type | Meaning |
|---|---|---|---|
| `DashboardMeeting` | `pulse_answers` | `int \| None` | answers from the team's current members; None if proposed |
| `DashboardMeeting` | `members` | `int \| None` | current members of the team; None if proposed |
| `DashboardMeeting` | `owing` | `int \| None` | people owing data; None if proposed |
| board `completeness` | `owing` | `int` | the same figure |
| `MeetingOpen` | `host_employee_id` | `uuid \| None` | optional, default None |

The dashboard's existing `pulse_answered: bool` stays and keeps its meaning,
which is the viewer's own answer. The new count is named `pulse_answers`
rather than `pulse_answered_count` so that the two don't read as one field.
`members` is counted per team, but it travels on the meeting row because the
row is what the tile renders. `pulse_answers` counts only current members'
answers, so a row can never read more answers than members. The pulse view's
`answered` still counts every answer, including those of members who have
since left, so the two can differ by the number of departed respondents.
That is deliberate: the dashboard asks "who of us is still to answer", while
the pulse view reports the meeting's results.

### 3. Opening with a host reuses the host check

`open_meeting` takes an optional `host_employee_id` and runs the same
membership check before inserting, so a rejected host opens nothing and
reports `meeting_host.not_member` against `host_employee_id`. The dashboard's
"an action on a proposed date opens the meeting first" path sends no host
and is unchanged.

### 4. Where the panel sits and how it is addressed

The panel sits at the top of the board's metrics view, above the tiles, for
a meeting that takes values and is dated today or later. Its address is the
board's address with `#readiness`, scrolled into view the way `ItemLists`
handles `#problems`. "Check readiness" on the dashboard links to
`/teams/:id?meeting=…#readiness`.

The alternative was a separate `view=readiness` tab. A tab is easy to miss
the day before the meeting, and it splits up the gaps and the values that
close them. The panel and the tiles sit together, so a member who records a
missing value sees it leave the list. The panel can be collapsed, a `<details>`
open by default, and the collapsed state is not remembered.

The recording view's own "Still missing" line stays, because it is what a
member typing values reads. The panel is what the host reads.

### 5. Copying uses the async Clipboard API, with a visible fallback

`navigator.clipboard.writeText(list.join('; '))`. On failure (the page not
in a secure context, or permission denied) the panel shows the list in a
read-only text field, selected, and the failure message. The result is
announced through an `aria-live="polite"` status beside the button.

The separator is `; ` because Outlook, assumed to be the organization's mail
client, splits on semicolons. Commas would also work there but would break in older
clients.

### 6. Hiding names becomes board state

`BoardPage` owns `hideNames` in React state and passes it to the pulse view,
the readiness panel and the item lists. The switch moves from the pulse view
to the board's toolbar, beside the meeting navigator, so it is reachable from
every view.

- **Survives:** view and meeting changes, because `BoardPage` stays mounted
  across them; only `?meeting` and `?view` change.
- **Is dropped:** when the page is left.

Two more places name people and follow the switch: the recording view's
"Still missing" line drops the owners, and the archived table shows "Name
hidden" for the responsible member. The item dialog's responsible select
still lists members: it is a form opened on purpose, not something on show.

It stays out of the URL and out of storage, as before: a link shared from a
screen-shared board must not carry a "names hidden" flag that a recipient
didn't choose, and the old reason, "about the screen right now", still holds.

The alternative was a query parameter. It survives a reload, but then it
travels in copied links and in the back links' recorded origin. Rejected.

### 7. The meetings page

- **Planning control caption.** It reads "Plan next meeting: {date},
  {time}" when there is a proposal, and "Plan next meeting" without one.
- **Empty form.** It gains a hint that nothing is proposed because the board
  has no schedule. A viewer who may configure the board also gets a "Set
  schedule" button that opens the schedule editor on the same page; it is a
  button, not a link, because it navigates nowhere.
- **Host select.** The form gains an optional host `<select>` listing the
  team's members, empty by default. The members query is already loaded on
  that page for the host editor.
- **Row links.** Each meeting row's date becomes a link to
  `/teams/:id?meeting=…`, carrying the origin in location state as other
  team links do.

### 8. "You host"

The comparison uses the dashboard summary's `current_user.email` against the
row's `host`, both lower-cased. My meetings reads the same summary and the
per-team meetings, so it uses the same comparison. No new field is needed.

## Risks / Trade-offs

- **[Risk] The board's count and the panel's merged names drift apart**, for
  example if pulse `missing` starts including former members. → Mitigation:
  an integration test builds the case behind each spec scenario and asserts
  `completeness.owing == len(merged names)` for a member viewer.
- **[Risk] The owing statement is slow on large histories.** → Mitigation:
  it is restricted to the listed meeting ids, at most a handful per viewer,
  and joins on indexed foreign keys (`ix_board_metrics_owner_employee_id`,
  and the meeting ids on `metric_values` and `pulse_answers`).
- **[Trade-off] Hiding names now hides the responsible member in the item
  lists too.** A host who wants to read out "who owns this" while sharing has
  to turn the switch off. Accepted, because the switch exists to keep names
  off a shared screen.
- **[Risk] The Clipboard API is unavailable over plain HTTP.** On-premise
  deployments may serve without TLS. → Mitigation: the selectable-text
  fallback in decision 5.

## Migration Plan

Nothing to migrate. Every API addition is optional or additive, and no table
changes. Rollback is reverting the pull request.
