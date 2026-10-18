# Proposal

## Why

The host of a board meeting does three things each week: plans the next
meeting and names who hosts it, makes sure every pulse answer and metric
value is in before the meeting starts, and starts it. A usability review of
the frontend found that the application gets in the way of all three.

- **Planning** takes about six actions. "Plan next meeting" hides the date it
  proposes until it is chosen, the host cannot be named when the meeting is
  opened, so the meeting has to be found again and changed, and no meeting
  row on the meetings page leads to its board.
- **Chasing** has no single place to look. The members still owing a pulse
  answer are named only in the board's pulse check view. The metrics still
  without a value, with their owners, are named only in the recording view.
  The dashboard says how many metrics are recorded, but for the pulse check it
  shows only whether the viewer has answered. Nothing turns the gaps into a
  list of people to write to.
- **Starting** the meeting usually means sharing a screen. Hiding names lasts
  only while the pulse check view is open: switching to the metrics and back,
  or to another meeting, shows every name again. It never covers the people
  named in the problem and task lists.

## What Changes

- **Readiness panel on the board.** For a meeting that still takes values and
  is dated today or later, the board's metrics view opens with a readiness
  panel. It lists the metrics still without a value, each with its owner or
  "no owner", and the members who have not answered the pulse check. It
  states how many people still owe data and offers "Copy addresses", which
  puts their distinct emails on the clipboard separated by `; `. A viewer who
  may not see who answered the pulse check sees only its count, and the panel
  says its address list holds metric owners only.
- **Dashboard cue.** Each meeting row on the dashboard also reads how many
  members have answered the pulse check out of how many, and how many people
  still owe data, with "Check readiness" leading to the panel. Every member
  sees it, and it gives counts only, never names. The row of a meeting the
  viewer hosts is marked "You host".
- **Planning the next meeting.**
  - "Plan next meeting" names the date and start time it proposes before it
    is chosen.
  - Without a schedule, the form says why its fields are empty.
  - A host may be named in the same form, and opening a meeting accepts an
    optional host. The API stays compatible: leaving the host out opens a
    meeting with none, as today.
  - Each meeting on the meetings page leads to the team's board at that
    meeting.
- **Hiding names covers the whole board.** The switch moves from the pulse
  check view to the board and stays on across the board's views and its
  meetings until the page is left. While it is on, the pulse check view, the
  readiness panel and the problem and task lists name no one. It is still not
  remembered and still changes only the viewer's own screen.

### Out of scope

The review's other findings are separate changes:

- confirming destructive actions;
- guiding a leader through setting up a team;
- focus, feedback and other accessibility fixes;
- letting owners find and step their own problems and tasks.

Sending reminders by email or notification is not proposed. The copied
address list stands in for it until a decision says otherwise.

## Capabilities

### New Capabilities

- `meeting-readiness`: how ready a coming meeting is. It covers which metric
  values and pulse answers are still missing, the people who owe them, the
  readiness panel on the board and the address list taken from it.

### Modified Capabilities

- `dashboard`: meeting rows carry the team's pulse check progress, the number
  of people still owing data, a "Check readiness" link and a "You host" mark.
  The single summary carries the new counts.
- `meetings`: opening a meeting takes an optional host. The meetings page
  shows the proposed date on its planning control, names the host when
  planning, explains an empty proposal, and leads from each meeting to its
  board.
- `pulse-check`: hiding names becomes a switch on the board. It persists
  across the board's views and meetings and also covers the readiness panel
  and the problem and task lists.

## Impact

- **Backend:**
  - `app/services/meetings.py` and `app/schemas/meeting.py`: an optional
    `host_employee_id` on opening a meeting, validated as naming a host is
    today.
  - `app/services/dashboard.py` and `app/schemas/dashboard.py`: three new
    per-meeting fields, computed as aggregates over all listed meetings at
    once, so the summary keeps a fixed number of statements.
  - The board of a meeting (`app/services/metric_values.py` or wherever its
    completeness is built) reports how many people owe data, computed by the
    same function as the dashboard's figure, so the two cannot disagree.
- **Frontend:**
  - A new readiness panel in `features/board/`.
  - `BoardPage.tsx` holds the hide-names state, used by `PulseView`,
    `PulseCards`, `PulseAnswers` and the item lists.
  - `MeetingsTile.tsx` and the API types change, and so does
    `TeamMeetingsPage.tsx`.
  - Both language catalogues get the new strings.
- **API:**
  - The meeting-opening request takes an optional field, a backwards
    compatible addition.
  - `GET /dashboard` gains per-meeting counts of pulse answers, members and
    people owing data, and a meeting's board gains the count of people owing
    data. All are additive; their names are settled in `design.md`.
  - No new error codes.
- **Tests:**
  - Integration tests for the new dashboard counts and for opening with a
    host.
  - Vitest for the panel, the address list, the cue and hiding names across
    views.
  - A Playwright flow covering planning with a host, checking readiness and
    copying the addresses.
- **Dependencies:** none.
