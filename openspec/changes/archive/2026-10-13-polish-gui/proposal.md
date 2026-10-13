# Proposal

## Why

The first round of use showed that several screens say too much, waste space or
are laid out against the way a meeting runs. The banner reads as a wall of
prose, the board leaves width unused and wraps its meeting navigator, the metric
detail is partly hidden under the header, forms that are rarely needed sit open
on every visit, and the navigation names destinations by system object instead
of by what the person is doing. None of this changes a business rule; it changes
what is shown, where, and how it is reached.

## What Changes

- **Banner.** The company declarations shrink to their headlines: the mission
  and the vision as one sentence each, the values by name only, a strategic
  declaration ("Do 2030 roku: …") and goals grouped by horizon ("W 2026 roku",
  "Do 2030 roku"), with an English translation of each. The descriptions of the
  mission, the vision and the values are dropped. The summary's `declarations`
  object changes shape accordingly. **BREAKING** for API consumers; the web app
  is the only one and changes with it.
- **Board.** The meeting navigator (previous, the meeting chooser, next) stays on
  one line, the chooser only as wide as a meeting's label. The board keeps the
  shared page width, and the problems and tasks column grows by 20%. The view switch
  shows how many metrics have a number at the meeting out of how many there are
  ("Metrics 12/14"), as it already does for the pulse check.
- **Recording view.** The number field is sized for ten characters. The colour set
  by hand becomes a four-way toggle — automatic, green, amber, red — captioned
  "Status".
- **Metric detail.** It is no longer covered by the application header. Its values
  are shown as a grid — date (ISO, `2026-10-13`), value, status, comment — newest
  first.
- **Meetings page.** The schedule fields appear only after choosing "Set schedule"
  or "Change schedule". "Prepare next meeting" becomes "Plan next meeting" and
  "Open meeting" becomes "Create the meeting". Weekday, time and date fields are
  sized to what they hold.
- **Metric settings page.** The Board and Meetings buttons go. The top row offers
  "Create new metric", "Copy from another board" and "Include global metric",
  each opening a dialog; the create form no longer sits open on the page.
- **Teams page.** "Register team" opens the registration form in a dialog.
- **Navigation.** The header offers Dashboard, My teams, My meetings, My pulse
  check and Configuration; Configuration opens Teams, Team metrics and Global
  metrics. The inert Archive entry is removed (the archive stays on each board).
  My teams, My meetings, My pulse check and Team metrics are new pages.

Out of scope, each a change of its own: leader deputies (`add-leader-deputies`)
and metric groups arranged by drag and drop (`add-metric-groups`), which builds
on this change's metric settings page.

## Capabilities

### New Capabilities

None. The new pages are views over data the dashboard, meetings and pulse check
already own, and the navigation shell belongs to `dashboard`.

### Modified Capabilities

- `dashboard`: the navigation's destinations and its Configuration group; the
  declarations' content, shape and pictograms; new My teams, My meetings, My
  pulse check and Team metrics pages.
- `metric-values`: the board page's navigator, width and metrics count; the
  recording view's number field and status toggle; the metric detail's placement
  and values grid.
- `meetings`: the meetings page's schedule shown on request and its renamed
  actions and sized fields.
- `metrics`: a metric settings page requirement — the three creating actions in
  dialogs and no navigation buttons.
- `team-board`: registering a team from a dialog on the teams page.

## Impact

- Backend: `app/schemas/dashboard.py` (`Statement`, `Value`, `Declarations`),
  `app/services/dashboard.py` (`DECLARATIONS`), and the dashboard tests. No
  migration, no new endpoint.
- Frontend: `components/AppHeader.tsx`, `routes.tsx`,
  `features/dashboard/DeclarationsBand.tsx`, `features/board/BoardPage.tsx`,
  `RecordingView.tsx`, `MetricDetail.tsx`, `board.module.css`,
  `features/meetings/TeamMeetingsPage.tsx`,
  `features/metrics/MetricSettingsPage.tsx` and `BringMetricDialogs.tsx`,
  `features/teams/TeamsPage.tsx`, new page components for My teams, My
  meetings, My pulse check and Team metrics, both i18n catalogues, and the
  affected unit and Playwright tests.
- No new dependency.
- Assumptions: the "Configuration" group is shown to everyone, since every page
  it leads to is readable by anyone signed in and offers its controls only to
  those permitted; "colour set by hand" stays the domain term, only its caption
  becomes "Status".
