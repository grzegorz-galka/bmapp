## 1. Prerequisite and schema

- [x] 1.1 Confirm that `add-global-and-copied-metrics` is synced and archived, so that `openspec/specs/` holds its merged `authorization` spec, and re-base this change's MODIFIED *Anyone signed in may read* if that change touched it. Verify that `openspec validate add-pulse-check --strict` passes.
- [x] 1.2 Add the `PulseAnswer` model (columns, `UNIQUE (meeting_id, employee_id)`, the rating and text-length checks, `RESTRICT` on both foreign keys), exported from `app/models/__init__.py`. Verify that `uv run mypy app` is clean.
- [x] 1.3 Write `alembic/versions/0006_add_pulse_answers.py`. Verify that `upgrade head`, `downgrade -1` and `upgrade head` succeed on an empty database and on one holding teams, meetings and metric values, that `alembic check` reports no drift, and that inserting a rating of 6 directly in SQL is refused by the check constraint.

## 2. The results rule (pure)

- [x] 2.1 Implement `summarise` and `mood_status` in `app/services/pulse_check.py`, with no I/O and `Decimal` throughout. Verify that `tests/unit/test_the_colour_of_a_rating.py` has one test per scenario of *The colour of a rating*, and that `tests/unit/test_pulse_summary.py` covers 5,4,4,4,3,3,2 → 3.57 with its distribution, and no answers → no average, `no_data`, all zeros.

## 3. Backend: validation, errors and schemas

- [x] 3.1 Add `PulseAnswerWrite` (strict integer rating 1–5, trimmed optional texts up to 2000 characters, blank as `''`), `PulseAnswerRead` and `PulseResults` to `app/schemas/`, with decimals as strings. Verify that `tests/unit/test_pulse_schemas.py` covers a missing rating, 0, 6, 3.5 and `"4"`, a 2001-character text in each field, and a blank text, each with its published code and field.
- [x] 3.2 Add `PulseAnswerMeetingFrozenError` and `MeetingHasPulseAnswersError` to `app/core/exceptions.py`. Verify with `tests/unit/test_domain_errors.py` that each maps to 409 and its code through the existing handler.
- [x] 3.3 Add `may_read_pulse_answers` and `may_answer_the_pulse_check` to `app/services/authz.py`. Verify that `tests/unit/test_permission_is_decided_per_team_not_per_role.py` gains their rows, including that an administrator who is a stranger may read but may not answer.

## 4. Backend: services and API

- [x] 4.1 Add recording an answer (same-team meeting, membership, window via `editable_meetings`, upsert on the unique pair) and `PUT /teams/{team_id}/meetings/{meeting_id}/pulse/me`. Verify that `tests/integration/test_answer_the_pulse_check_at_a_meeting.py` and `test_only_the_latest_held_and_the_next_meeting_take_answers.py` each hold one test per scenario.
- [x] 4.2 Add the results read (summary, previous meeting with answers and change, 16-meeting trend, answers ordered by email, missing members, own answer, names withheld when the viewer may not read them) and `GET /teams/{team_id}/meetings/{meeting_id}/pulse`. Verify that `test_the_results_of_a_meeting.py`, `test_the_individual_answers_of_a_meeting.py`, `test_the_viewers_own_answer.py` and `test_the_trend_of_the_pulse_check.py` each hold one test per scenario, and that a test asserts a fixed number of SQL statements for a team of 11 with 16 meetings of answers.
- [x] 4.3 Wire the guards into both routes. Verify that `test_only_a_teams_members_and_administrators_read_its_individual_pulse_answers.py` and `test_only_a_member_answers_the_pulse_check_for_themselves.py` each hold one test per scenario, and that `test_anyone_signed_in_may_read.py` gains *Individual pulse answers are the one exception*.
- [x] 4.4 Make `delete_meeting` raise `MeetingHasPulseAnswersError`. Verify that `test_delete_a_meeting.py` gains *A meeting with pulse answers cannot be deleted* and `test_move_a_meeting.py` gains *A meeting with pulse answers can be moved*, and that their old scenarios still pass.
- [x] 4.5 Log an answer recorded or replaced at INFO with the meeting id, the team id and the respondent's email only, never the rating or the texts. Verify with a `caplog` assertion in `test_pulse_events_are_logged.py` that the texts do not appear in the log.
- [x] 4.6 Run `uv run ruff check . && uv run ruff format --check . && uv run mypy app` and `uv run pytest --cov=app --cov-report=term-missing`. Verify that everything passes and coverage stays at or above 85% without dropping.

## 5. Frontend: foundations

- [x] 5.1 Add `src/api/pulse.ts` (types for `PulseResults`, `PulseAnswerRead`, `PulseAnswerWrite`; `getPulse`, `putOwnPulseAnswer`) and `features/board/pulse/usePulse.ts` with the query and an invalidating mutation. Verify with a hook test that saving refetches the results.
- [x] 5.2 Add the `pulse.*` strings — view, toolbar, cards, the four questions, the five rating words, the empty state, "Person {{n}}" — and the four new error codes to `en.ts` and `pl.ts`, with the design's wording. Verify that `npm run typecheck` and `catalogues.test.ts` pass.

## 6. Frontend: the pulse check view

- [x] 6.1 Add the *Metrics* / *Pulse check (n/m)* switch to `BoardPage`, kept in `?view=pulse` beside `?meeting=`, and `PulseView` with its toolbar. Verify that `PulseView.test.tsx` covers *The view has its own address* and *The view's entry shows how many have answered*, and that moving between meetings keeps the view.
- [x] 6.2 Build `PulseCards` and `PulseGauge` (inline SVG arc coloured by status, average in the active language's format, change against the previous meeting's date) and `PulseTrend` (Recharts `ComposedChart`: answers as bars, average as a line, green zone 4–5), with `pulse.module.css` following the sample's `.pc-*` layout on the theme tokens. Verify that tests cover *The results are shown as cards, a trend and a table*, *Colour is never the only signal* and *The average is shown in the active language's format*, and that `contrast.test.ts` still passes.
- [x] 6.3 Build `PulseAnswers` and the hide-names switch. Verify that tests cover *Names are hidden* and the empty state *Nobody has answered yet*.
- [x] 6.4 Build `PulseForm` (five labelled rating options, three textareas, pre-filled from `own`, field errors from codes). Verify that tests cover *A member answers through the form*, *The form shows an existing answer for changing* and *A frozen meeting has no form*.
- [x] 6.5 Offer the form and show names only as permitted. Verify that `features/board/permissions.test.tsx` gains the three scenarios of *The pulse check view offers only what its viewer may do*, and that `npm run lint && npm run typecheck && npm run test` passes.

## 7. End-to-end and documentation

- [x] 7.1 Add `frontend/e2e/pulse-check.spec.ts`: two members answer at the coming meeting in Polish, one changes their answer; the view shows "2 z 3", the average, the distribution and both rows; hiding names replaces them with "Osoba 1" and "Osoba 2"; a signed-in stranger sees the cards without the table; an older meeting offers no form. Verify that `npm run test:e2e` passes.
- [x] 7.2 Update CLAUDE.md: a Pulse answer row in the domain table, **Pulse check** in the glossary (fixed questions, 1–5, colour bands not a threshold, names only to the team and administrators), the exception in the authorization summary under *Security and configuration*, the GUI flows in *Testing*, and *Current state*. Update README if it lists the board's features. Verify by reading the diff.
- [x] 7.3 On a fresh volume, register a team of three, open last week's and this week's meetings, answer as two members, and check the board's Pulse check view as a member, as a stranger and as an administrator; then try to delete the answered meeting. Verify that it works end to end and the deletion is refused with the translated `meeting.has_pulse_answers` message.

## Workflow follow-up

- Sync the delta specs and archive the change after review (`/opsx:archive`).
- Candidates for follow-up changes: the pulse average as a board metric with a threshold; turning an answer into a task once tasks exist; showing who has answered in the recording view's completeness; pulse figures on the hub.
