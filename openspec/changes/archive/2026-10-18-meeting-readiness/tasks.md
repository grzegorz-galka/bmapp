# Tasks

Every scenario in the delta specs maps onto one named test, given in the task
that implements it. Backend integration tests follow the existing convention:
one file per requirement (`test_<requirement>.py`) and one function per
scenario (`test_<scenario>`).

## 1. Who owes data (backend)

- [x] 1.1 Add `owing_by_meeting(session, meeting_ids) -> dict[uuid, int]` to
  `app/services/metric_values.py` per design decision 1. It is one statement:
  the distinct employees among the owners of active placements with no value
  at the meeting, UNION the current members with no pulse answer.
  - Verify with `tests/integration/test_who_still_owes_data_for_a_meeting.py`:
    `test_a_person_with_two_gaps_counts_once`,
    `test_a_metric_without_an_owner_adds_no_one`, `test_everything_is_in`,
    `test_a_former_member_is_not_chased_for_the_pulse_check`.
- [x] 1.2 Add `owing: int` to the board's completeness schema and fill it
  from `owing_by_meeting`. Mirror the field in `frontend/src/api/metrics.ts`.
  - Verify with `tests/integration/test_a_meetings_board_reports_how_many_owe_data.py`:
    `test_the_board_and_the_dashboard_agree` (complete it in 2.1),
    `test_a_viewer_from_outside_the_team_gets_the_figure`.
  - Verify `npm run typecheck`.

## 2. The dashboard summary (backend)

- [x] 2.1 Add `pulse_answers`, `members` and `owing` (each `int | None`,
  None on a proposed row) to `DashboardMeeting`, filled in
  `app/services/dashboard.py` by grouped statements over all listed meetings
  (design decision 2). Mirror them in the frontend's dashboard API types.
  - Verify in `test_the_dashboard_lists_the_viewers_board_meetings.py`: extend
    `test_todays_and_the_next_meeting_are_listed` and
    `test_a_proposed_date_is_listed_as_not_yet_opened`, and add
    `test_the_people_owing_data_are_counted_not_named`.
  - Verify that the summary's statement-count test still passes with only
    its expected constant raised.
  - Complete `test_the_board_and_the_dashboard_agree`.

## 3. Opening a meeting with its host (backend)

- [x] 3.1 Add an optional `host_employee_id` to `MeetingOpen`. Make
  `open_meeting` check membership before inserting, as `change_meeting` does
  (design decision 3). Mirror the field in `frontend/src/api/meetings.ts`.
  - Verify in `test_open_a_meeting.py`: `test_a_meeting_is_opened_with_its_host`
    and `test_a_meeting_is_opened_with_a_host_from_outside_the_team`.
  - Verify that `test_a_meeting_is_opened` still passes.
  - Run `uv run ruff check . && uv run mypy app`.

## 4. Hiding names across the board (frontend)

- [x] 4.1 Lift `hideNames` from `PulseView` into `BoardPage` and move the
  switch to the board's toolbar (design decision 6). Pass it to `PulseView`,
  `PulseCards`, `PulseAnswers` and the item lists. With it on, the item rows
  show no responsible member. Move the switch's strings in `en.ts`/`pl.ts` if
  their keys change.
  - Verify in `BoardPage.test.tsx`: `it('Names are hidden')` (moved from
    `PulseView.test.tsx`), `it('Hidden names stay hidden across views')`,
    `it('Leaving the board forgets the switch')`.

## 5. The readiness panel (frontend)

- [x] 5.1 Create `features/board/ReadinessPanel.tsx` per the
  `meeting-readiness` spec and design decision 4.
  - It is a `<details>`, open by default, at the top of the metrics view, for
    a meeting that takes values and is dated today or later.
  - It lists the missing metrics with their owner or "no owner", the members
    who have not answered, and `completeness.owing`.
  - Add its strings to both catalogues.
  - Verify in `ReadinessPanel.test.tsx`: `it('The panel lists what is missing')`,
    `it('A complete meeting says so')`, `it('A past meeting has no panel')`,
    `it('The panel stays current')`.
- [x] 5.2 Open the panel from `#readiness`, scrolled into view as
  `ItemLists` does for `#problems`.
  - Verify with `it('The panel is opened from its address')`.
- [x] 5.3 Add "Copy addresses" (design decision 5). It copies the merged
  distinct emails in email order, joined by `; `, with an `aria-live` status
  stating the count, and falls back to a selected read-only field when the
  clipboard is refused. Metric owners are always in it. Pulse names are in
  it only when `pulse.missing` is not null; otherwise the panel shows the
  "metric owners only" note.
  - Verify: `it('The addresses are copied')`, `it('Copying fails')`,
    `it('A viewer from outside the team')`.
  - Verify in the same file `it('The merged names match the reported count')`
    (design risk 1).
- [x] 5.4 Make the panel respect hiding names.
  - Verify in `BoardPage.test.tsx` with
    `it('The readiness panel and the item lists name no one')`.

## 6. The dashboard cue (frontend)

- [x] 6.1 In `MeetingsTile.tsx`, add to each opened row "Pulse check {a} of
  {b}" and "{n} people still owe data", plus "Check readiness" as an ordinary
  action linking to `/teams/:id?meeting=…#readiness`. A proposed row shows
  neither. Add the strings with plural forms to both catalogues.
  - Verify in `MeetingsTile.test.tsx`:
    `it('Recording progress and the pulse check are stated in words')`
    (updated), `it('The people owing data are counted, not named')`,
    `it('The readiness of a coming meeting is checked')`,
    `it('Every member is offered it')`, `it('A proposed row does not offer it')`.
- [x] 6.2 Show "You host" in place of the viewer's own email as host, on the
  dashboard tile and on My meetings (design decision 8).
  - Verify in `MeetingsTile.test.tsx` and `MyMeetingsPage.test.tsx`:
    `it('The host sees their meeting marked')` and
    `it('Another member\'s meeting is not marked')`.

## 7. The meetings page (frontend)

- [x] 7.1 Caption the planning control with the proposal, add the
  no-schedule hint (with a "Set schedule" link for whoever may configure the
  board), and add the optional host select to the planning form (design
  decision 7).
  - Verify in `TeamMeetingsPage.test.tsx`:
    `it('The planning control names the proposal')`,
    `it('Preparing a meeting without a schedule')` (updated),
    `it('The host is named while planning')`.
- [x] 7.2 Make each meeting row's date a link to the board at that meeting,
  carrying its origin in location state.
  - Verify with `it('A meeting leads to its board')`, and that the board's
    back link names the meetings page.

## 8. End to end and gates

- [x] 8.1 Extend `e2e/prepare-a-meeting.spec.ts` with the host's loop:
  1. plan the next meeting with a host from the meetings page;
  2. as another member, answer the pulse check;
  3. as the host, open "Check readiness" from the dashboard;
  4. check that the panel lists the remaining gaps;
  5. copy the addresses (grant clipboard permission in the context);
  6. turn on hiding names and switch views, and check that no email shows.

  Verify that the flow passes against `docker compose up`.
- [x] 8.2 Update `CLAUDE.md` "Current state":
  - the readiness panel and its `#readiness` address;
  - the dashboard's new counts;
  - the host named when opening;
  - hiding names as board state.

  Verify that it matches the shipped behaviour.
- [x] 8.3 Run the gates and verify all pass:
  - backend: `uv run pytest --cov=app` (coverage not below its current
    figure), then `uv run ruff check . && uv run ruff format --check . && uv run mypy app`;
  - frontend: `npm run lint && npm run typecheck && npm run test`.
- [x] 8.4 Run `openspec validate meeting-readiness --strict` and verify that
  it reports the change valid.

## Workflow follow-up

- Sync and archive the change after the pull request is merged.
