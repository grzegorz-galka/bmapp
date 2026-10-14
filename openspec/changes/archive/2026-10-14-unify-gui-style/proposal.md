# Proposal

## Why

The interface has grown screen by screen, and it shows. The declarations band
uses seven different type treatments. The My teams tile names its nearest team
twice. The My board meetings tile grows with every team. Buttons follow no single
rule: some are outlined and tint on hover, some are solid blue, and some links
are drawn as buttons. In the recording view, each metric's four-way status toggle
takes up a whole column. None of this changes a business rule. It changes how
things look and how much the screen holds, so that the interface reads as one
system.

## What Changes

- **Declarations band: four type styles.** Each piece of text in the band uses one
  of four styles: *label* (mono, small, upper case) for the band's title and note
  and the column headings, *headline* for the mission, the vision and the value
  names, *subheading* for a horizon, and *body* for the strategic sentences and the
  goals. Today there are seven.
- **My teams tile.** The block above the list that repeats the nearest team's name
  and date is removed. The countdown moves onto that team's row. The tile lists at
  most three teams. Each row keeps the viewer's role and the team's schedule as
  they are now. The team's name becomes a link to its members page, and the date
  and time of its next meeting a link to its meetings page. With more than three
  teams, a "More…" link leads to My teams.
- **My board meetings tile.** It lists at most the three soonest meetings. With
  more, a "More…" link leads to My meetings. "Start meeting" is still offered only
  on today's row, and it opens the board on that meeting as it does now. It is
  marked as the row's default action.
- **One button scheme across the application.**
  - Every action button is *outlined*: panel background, control-strength border,
    ink text and an accent tint on hover.
  - Solid blue is kept for a control that is *on*: the pressed segment of a view
    switch, a pressed toggle, an expanded disclosure.
  - The *default* action of a group (the submit of a form, "Create new metric",
    "Start meeting", "Sign in") is marked lightly: outlined in the accent colour
    with accent text, never filled.
  - Navigation is a *link*, not a box styled as a button. This covers the board's
    Meetings and Metric settings links and the dashboard's problems, tasks and
    archive links.
- **Recording view: the status is a list.** The four-way toggle becomes a drop-down
  list per metric, with Automatic as the default. Green, Amber and Red are each
  shown in their status colour in the list and once chosen. A status set by hand
  still needs a comment, as before.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `appearance`: a new requirement that buttons follow one scheme (outlined
  actions, a lightly marked default, solid only when on, navigation as links).
- `dashboard`: the declarations band's four type styles; the My teams tile without
  the repeated block, capped at three teams with name and next-meeting links and
  "More…"; the countdown on the nearest team's row; the My board meetings tile
  capped at three with "More…"; "Start meeting" marked as the default.
- `metric-values`: in the recording view, the status set by hand is chosen from a
  list that defaults to Automatic, with the colours shown in colour.

## Impact

- Frontend only. No API, schema or migration change, and no new dependency.
- A new shared stylesheet `frontend/src/styles/controls.module.css` holds the
  button, default, segmented and link styles. The copies in
  `teams/teams.module.css`, `auth/DevLoginDialog.module.css`,
  `board/board.module.css`, `dashboard/MeetingsTile.module.css` and
  `dashboard/ItemsTile.module.css` are removed, and every component that imports
  `teamStyles.button` or `teamStyles.primary` switches to it.
- Changed files: `features/dashboard/DeclarationsBand.*`, `TeamsPanel.*`,
  `MeetingsTile.*`, `ItemsTile.*`, `features/board/BoardPage.tsx`,
  `RecordingView.tsx`, `features/metrics/MetricSettingsPage.tsx`, the forms and
  dialogs that use `.primary`, both i18n catalogues (`dashboard.more*` keys), and
  the affected unit and Playwright tests.
- Assumptions:
  - "More…" appears only when there is more than the tile shows.
  - A team with no next meeting shows "No next meeting", still linking to its
    meetings page, which is where one is opened.
  - The visible caption is "More…" ("Więcej…"). Its accessible name says what is
    more ("More teams", "More board meetings"), so the two links can be told apart.
  - The header's own controls (navigation, the language and theme toggles) keep
    their current look; they are not buttons in the sense above.
