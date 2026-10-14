# Tasks

## 1. The shared control styles

- [x] 1.1 Create `frontend/src/styles/controls.module.css` with `.button`, `.default`, `.segmented` and `.link` as in design.md decisions 1 and 2. `.button` fills with `--accent-solid` under `[aria-pressed='true']` and `[aria-expanded='true']`, and so does `.segmented`'s pressed child. Disabled buttons keep `opacity: 0.7` and the default cursor, as today. Verify that `npm run typecheck` passes and that the file is imported nowhere yet.
- [x] 1.2 Add `src/styles/controls.test.ts` (design decision 9). It reads every `*.module.css` under `src/` and asserts two rules. First, `background: var(--accent-solid)` appears only in `controls.module.css` under an on-state selector, or in `AppHeader.module.css`'s `.brandMark`. Second, no other module declares `.button`, `.primary` or `.default`. Add a third case for *An action is tinted on hover*: `.button:hover` declares a `color-mix` of `--accent` at `--tint` over `--panel`, and `contrast.test.ts` holds `--ink` on that mix at 4.5:1 or better in both themes. Run it now and confirm it fails on today's `teams.module.css`, `DevLoginDialog.module.css` and `board.module.css`; that shows it catches drift. Add a named contrast case to `contrast.test.ts`: *The default action is legible in both themes* (`--accent` against `--panel` and `--panel-2`, ≥4.5:1 as text and ≥3:1 as a border). Verify that the contrast test passes.

## 2. One button scheme across the pages

- [x] 2.1 Replace `teamStyles.button` with `controls.button` and `teamStyles.primary` with `controls.default` in every component that `grep -rn "teamStyles\.\(button\|primary\)\|styles\.\(button\|primary\)" src` lists. Exceptions follow design decision 3:
  - the board's Record values toggle becomes `controls.button` whatever its state, filled by its `aria-pressed`;
  - `TeamsPage`'s Register team becomes `controls.default`, filled by its `aria-expanded`.

  Delete `.button` and `.primary` from `teams.module.css` and `DevLoginDialog.module.css`, and delete `.button` from `board.module.css`. Verify that the grep for `teamStyles.button|teamStyles.primary` comes back empty and that `npm run test` passes.
- [x] 2.2 Move the board's view switches to `controls.segmented` and drop `board.module.css`'s `.segmented` rules. In `BoardPage.tsx`, turn the Meetings and Metric settings links into `controls.link` with an icon. Verify that `BoardPage.test.tsx` holds *The chosen view is filled* (the pressed segment has `aria-pressed="true"` and the segmented class) and *The board's own links are links* (they are `link`s without `controls.button`, and Previous and Next are buttons with `controls.button`). Verify that `controls.test.ts` now passes for `board.module.css`.
- [x] 2.3 Add the remaining appearance tests:
  - `MetricSettingsPage.test.tsx`: *Creating a metric is the default way to add one* (Create has `controls.default`, Copy and Include have `controls.button`) and *A form's submit is the default* (in the create dialog, submit has `controls.default` and Cancel has `controls.button`);
  - `TeamsPage.test.tsx`: *A disclosure is filled while it is open* (`aria-expanded` toggles on `controls.default`);
  - one test per page in *Actions on different pages look alike*, asserting that no rendered button on the metric settings page, members page, meetings page or dashboard carries a class outside `controls.button` and `controls.default`.

  Verify that `npm run test` passes.

- [x] 2.4 Follow-up from review: the meetings page's Board and Metric settings links and My pulse check's Answer link were still drawn as buttons. Make them `controls.link` with icons (new `BoardIcon`), and add the source-level guard *No page draws a link as a button* to `controls.test.ts` and *The meetings page's own links are links* to `TeamMeetingsPage.test.tsx`. Verify that both pass and that the guard fails on the old code.

## 3. Dashboard: the declarations band

- [x] 3.1 Rework `DeclarationsBand.module.css` and `.tsx` into the four type classes of design decision 5: `.label`, `.headline`, `.subheading` and `.body`. Delete `.bandLabel`, `.bandNote`, `.columnHeading`'s font rules, `.horizon`, `.prose`, `.goal`'s font rules and `.valueName`. Put the Values heading through the shared `heading()` helper. Verify that a new `DeclarationsBand.test.tsx` holds *Every text in the band uses one of the four styles* (every element with text carries exactly one of the four classes) and *Values read at the same weight as the mission*. Verify that the existing declarations tests in `DashboardPage.test.tsx` still pass.

## 4. Dashboard: the My teams tile

- [x] 4.1 Add `TILE_LIMIT = 3` to the dashboard folder. Add the catalogue keys `dashboard.more` ("More…" / "Więcej…"), `dashboard.moreTeams` ("More teams" / "Więcej zespołów") and `dashboard.moreMeetings` ("More board meetings" / "Więcej spotkań") to both catalogues. Verify that `npm run typecheck` and `catalogues.test.ts` pass.
- [x] 4.2 Rework `TeamsPanel.tsx` (design decision 7):
  - drop the `.nearest` block, keeping the role and schedule line as it is;
  - render at most `TILE_LIMIT` rows, each with the name as a link to `/teams/:id/members` and the next meeting (or "No next meeting") as a link to `/teams/:id/meetings`, both with `state={here}`;
  - render `Countdown` on the first row that has a next meeting;
  - when there are more teams, add a `controls.link` "More…" to `/my-teams` labelled `dashboard.moreTeams`.

  Verify that `DashboardPage.test.tsx` holds the following scenarios:
  - *Teams are listed in order of their next meeting*;
  - *A team's name leads to its members and its meeting to its meetings*;
  - *At most three teams are listed*;
  - *Three teams need no link to more*;
  - *The nearest team is not repeated*;
  - *The viewer's role is shown per team*, against the summary codes and the tile's role captions in both languages;
  - *A team with no meeting and no schedule*;
  - *A viewer on no team*;
  - *The countdown counts down to the nearest meeting*, now on the row.

  Verify that the countdown's existing advance and zero tests pass.

## 5. Dashboard: My board meetings and the list links

- [x] 5.1 In `MeetingsTile.tsx`, render the first `TILE_LIMIT` meetings. When there are more, add a "More…" `controls.link` to `/my-meetings` with `state={here}`, labelled `dashboard.moreMeetings`, with an icon. Use `controls.button` for Prepare data and Fill pulse check, and `controls.default` for Start meeting. Delete `.action` from `MeetingsTile.module.css`. Verify that `MeetingsTile.test.tsx` holds *At most three meetings are listed*, *Three meetings need no link to more*, *Start meeting is the row's default* and *A later meeting cannot be started yet* (no default on that row). Verify that the existing meeting-row tests pass.
- [x] 5.2 In `ItemsTile.tsx`, make the problems, tasks and archive links `controls.link` and delete `.link` from `ItemsTile.module.css`. Verify that `ItemsTile.test.tsx` holds *The dashboard's list links are links* and that *Every action has an icon and keeps its caption* and *Every tile title has a pictogram* still pass. Also verify that the "More…" links carry a hidden icon.

## 6. Recording view: the status list

- [x] 6.1 In `RecordingView.tsx`, replace the radio group with a `<select>` (design decision 8):
  - it is named `recording.statusLabel`, with the options Automatic (`''`), Green, Amber and Red;
  - its value is `colour`, and it saves on blur;
  - each option has a `--status-*` text-colour class, and the select carries the class of its chosen value;
  - `StatusBadge` stays beside it.

  Delete `.statusToggle` and `.statusOption` from `board.module.css`. Update `RecordingView.test.tsx`, where `statusOption()` becomes a `selectOptions` helper and `radiogroup` queries become `combobox`. Verify that it holds:
  - *A status is set by hand with the toggle* (name kept for spec continuity; it now drives the list);
  - *The list defaults to Automatic*;
  - *The colours are shown in colour*, by class, with the 4.5:1 part covered by the existing `--good`/`--warn`/`--bad` contrast cases plus an explicit `--status-*` text case added to `contrast.test.ts`;
  - *Automatic clears a status set by hand*;
  - *The fields line up in columns*;
  - *Each field is named after its metric*.

  Verify that the comment-required and Polish-format tests pass.

## 7. Documentation

- [x] 7.1 Update `CLAUDE.md` under *Theme tokens…*. State that buttons come from `src/styles/controls.module.css`: outlined actions, `.default` for a group's default, solid accent only for an on state, and navigation as `.link`. State that `controls.test.ts` enforces it. Update *Current state* where it describes the dashboard's My teams tile. Verify by reading the diff that no other convention changed.

## 8. End to end

- [x] 8.1 Update the Playwright flows:
  - `dashboard.spec.ts`: the My teams links, the "More…" links with four teams and with four meetings, and Start meeting;
  - `record-meeting-metrics.spec.ts`: `selectOption` on the status combobox in place of the radiogroup;
  - every spec that clicks a renamed or restyled control by role, which should be none, since captions are unchanged.

  Verify that `npm run test:e2e` passes against `docker compose up`.
- [x] 8.2 In the running stack, in both languages and both themes and at 1280px, 1000px and 620px, check the following:
  - the banner reads in four styles;
  - the My teams and My board meetings tiles cap at three;
  - every action button is outlined;
  - the default buttons are accent-outlined;
  - only pressed or expanded controls are filled;
  - the board's links are links;
  - the status list shows its colours in Chromium.

  Then run `npm run lint && npm run typecheck && npm run test`. Verify that everything passes.

## Workflow follow-up

- Sync and archive with `/opsx:archive` after the PR is merged.
