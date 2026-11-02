# Tasks

## 1. Change since four meetings earlier (backend)

- [x] 1.1 Add `previous_4`, `change_4` and `improvement_4` to the `BoardMetric` schema, and compute them in `build_board` from the meeting four positions back in the existing window. Verify the statement count of `build_board` is unchanged in its existing test.
- [x] 1.2 Add integration tests in `tests/integration/test_the_board_of_a_meeting.py`, one per new scenario of "The board of a meeting": "The change since four meetings earlier", "Four meetings earlier counts meetings, not weeks" and "Fewer than four earlier meetings". Verify with `uv run pytest tests/integration/test_the_board_of_a_meeting.py`.
- [x] 1.3 Add the three fields to `BoardMetric` in `frontend/src/api/metrics.ts` and to `boardFixture.ts`. Verify with `npm run typecheck`.

## 2. Status badge and threshold tooltip (frontend)

- [x] 2.1 Add `--on-status` (ink on a status fill) and `--status-none` (grey fill) to both palettes in `theme.css`, and extend `contrast.test.ts` with each `--on-status`/fill pairing at 4.5:1. Verify that `npm run test -- contrast` passes.
- [x] 2.2 Add `describeTarget` to `features/metrics/display.tsx`: the target value, else the green boundary (`≤ x`, `≥ x`, `a–b`), else "No threshold". Add `tile.target` ("Target: {{target}}" / "Cel: {{target}}") and the badge and tooltip strings to `en.ts` and `pl.ts`. Verify with unit tests for each of the three cases and both languages.
- [x] 2.3 Build `TileBadge`: placed top right, filled by status (grey with no number or no threshold), focusable, with an accessible name of status, set by hand and target. It has a `role="tooltip"` element linked by `aria-describedby` that holds the status and `describeThreshold`, shown on hover and focus and closed by Escape, plus a "✎" mark when the colour was set by hand. Use it in `Tile` in place of `StatusBadge`, and remove the threshold line. Verify with `BoardPage.test.tsx` tests named after each scenario of "A tile's status badge" and "The threshold definition over the badge".
- [x] 2.4 Check that `StatusBadge` is unchanged where it is still used (metric detail, recording view, settings, global metrics), and that "Colour is never the only signal" still passes. Verify with `npm run test`.

## 3. Two change indicators (frontend)

- [x] 3.1 Build `ChangeIndicator`: ▲, ▼, → or "–", the signed value in the metric's format, the colour from improvement (neutral for `null`), and an accessible text naming the comparison. Add the catalogue keys for "week" / "4 mtgs" and "tydz." / "4 spotk.", plus their full accessible wording, in both languages. Verify with unit tests.
- [x] 3.2 Replace the tile's single change line with two indicators, fed from `change`/`improvement` and `change_4`/`improvement_4`. Verify with `BoardPage.test.tsx` tests named after each scenario of "A tile's two change indicators".
- [x] 3.3 Update `e2e/record-meeting-metrics.spec.ts` so it asserts the badge's target text and both indicators after recording values at two meetings. Verify with `npm run test:e2e -- record-meeting-metrics`.

## 4. Copy a pulse answer from the same week

- [x] 4.1 Add `PulseElsewhere` and `elsewhere` to the results schema, and fill it in `build_results` with one statement, as `design.md` describes: the viewer is a member, has no own answer, and has another team's answer in the ISO week's Monday–Sunday range, the one changed last. Verify with `tests/integration/test_the_results_of_a_meeting.py` tests named after each scenario of "The viewer's answer at another team's meeting that week".
- [x] 4.2 Add `elsewhere` to `frontend/src/api/pulse.ts` and the pulse fixtures. Verify with `npm run typecheck`.
- [x] 4.3 In `PulseForm.tsx`, show the offer above the questions when `own` is null and `elsewhere` is present, naming the team and the date. "Copy" fills the fields without saving; "Not now" hides it for the page's life. Add the strings in both languages. Verify with `PulseView.test.tsx` tests named after each scenario of "The answer form offers to copy that week's answer".
- [x] 4.4 Extend `e2e/pulse-check.spec.ts`: answer for one team, open a second team's form in the same week, copy, change the rating, save, and check both answers. Verify with `npm run test:e2e -- pulse-check`.

## 5. Remove the dashboard countdown

- [x] 5.1 Remove `Countdown` from `TeamsPanel.tsx`. Delete `Countdown.tsx`, `Countdown.module.css`, its helper in `i18n/format.ts` and the `myTeams.countdown*` keys in both catalogues. Verify with `npm run typecheck && npm run lint`, and that `grep -r Countdown frontend/src` finds nothing.
- [x] 5.2 Replace the countdown tests in `DashboardPage.test.tsx` and `e2e/dashboard.spec.ts` with "The nearest meeting has no countdown", and update "A viewer on no team". Drop any timer mocking left unused. Verify with `npm run test -- DashboardPage` and `npm run test:e2e -- dashboard`.
- [x] 5.3 Update CLAUDE.md "Current state": drop "only the nearest row carries the countdown", and describe the tile badge, the two indicators and the pulse copy offer in one or two sentences. Verify by reading the diff.

## 6. Integration

- [x] 6.1 Run the full gates: `uv run pytest --cov=app` (coverage not below its current level), `uv run ruff check . && uv run ruff format --check . && uv run mypy app`, and `npm run lint && npm run typecheck && npm run test && npm run test:e2e`. All must be green.
- [x] 6.2 Check by hand in `docker compose up`, in both themes and both languages, that the badge colours, the tooltip on hover and keyboard focus, the indicators and the pulse copy offer all behave as specified.

## Workflow follow-up

- Run `openspec validate refine-board-tile-and-pulse` before opening the PR.
- Archive the change with `/opsx:archive` once the PR is merged.
