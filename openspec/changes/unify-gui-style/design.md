# Design

## Context

See `proposal.md` for the motivation. The relevant current state:

- **The banner.** `DeclarationsBand.module.css` uses seven text treatments:
  - `.bandLabel` and `.bandNote`: mono, 2xs, 500, upper case, ink-2;
  - `.columnHeading`: mono, 2xs, 500, upper case, accent, a different tracking;
  - `.headline`: lg, 600;
  - `.horizon`: sm, 600;
  - `.prose`: sm, ink-2, line height 1.5;
  - `.goal`: sm, ink, line height 1.45;
  - `.valueName`: base, 600.

  The Values heading carries no pictogram, so it does not use the shared
  `heading()` helper.
- **The My teams tile.** `TeamsPanel.tsx` renders a title with the team count,
  then a `.nearest` block (the first team's name, date and `Countdown`), then
  every team with initials, role, schedule and next meeting. Nothing in the tile
  is a link. `MyTeamsPage` does not reuse it.
- **The My board meetings tile.** `MeetingsTile.tsx` lists every row the summary
  returns. Its actions are buttons, because a proposed row is opened through
  `POST /teams/:id/meetings` before navigating.
- **Buttons.**
  - `teams.module.css` defines `.button` (outlined) and `.primary` (solid
    `--accent-solid`). About twenty components import them as `teamStyles`.
  - `DevLoginDialog.module.css` copies the same two rules.
  - `MeetingsTile.module.css` (`.action`) and `ItemsTile.module.css` (`.link`)
    each have their own outlined variant.
  - `board.module.css` fills the pressed segment (`.segmented
    [aria-pressed='true']`) and the checked status option with the solid accent.
  - `.primary` serves three purposes: a form's submit, the page's main action
    ("Create new metric", "Register team", "Sign in", an unanswered pulse check),
    and the board's Record values toggle when it is *not* pressed. That last one
    is the reverse of what a toggle should show.
  - `BoardPage.tsx` draws its Meetings and Metric settings `Link`s with
    `teamStyles.button`.
- **The recording view.** The status is a `fieldset role="radiogroup"` with four
  styled radios, saved when focus leaves the group. Before `polish-gui` it was a
  `<select>`; that change swapped it for the toggle. This change goes back to a
  list, but keeps the caption and the Automatic option that `polish-gui` added.
- **Contrast.** `contrast.test.ts` already holds `--accent`, `--good`, `--warn`
  and `--bad` at 4.5:1 on every surface. In both themes `--status-*` has the same
  value as `--good`/`--warn`/`--bad`.

## Goals / Non-Goals

**Goals:**

- One place defines what a button looks like, so the next page cannot drift.
- The scheme is enforced by a test, not by review alone.
- No API, schema or permission change. The tiles' caps are applied to data the
  summary already returns.

**Non-Goals:**

- Restyling the header's navigation, the Configuration disclosure, or the
  language and theme toggles.
- A component library or a `<Button>` React component. A stylesheet is enough
  (KISS: the variants are CSS only).
- Changing what "Start meeting" does or when it is offered.

## Decisions

### 1. A shared `styles/controls.module.css` replaces the per-feature copies

It holds four classes:

- `.button`: outlined, panel background, `--line-control` border, ink, and an
  accent tint (`color-mix(... var(--tint) ...)`) on hover;
- `.default`: composes `.button`, then sets the border and text to `--accent` and
  the weight to 600. It is never filled;
- `.segmented`: the view-switch group. Its pressed child is filled with
  `--accent-solid`;
- `.link`: an inline link in the accent colour, with optional icon spacing.

`.button` also fills with the solid accent when it is
`[aria-pressed='true']` or `[aria-expanded='true']`. A toggle then needs no
class of its own: it gets the right look from the state it already reports to
assistive technology. The visual state and the announced state cannot drift
apart.

`teams.module.css` loses `.button` and `.primary`. Every `teamStyles.button`
becomes `controls.button`, and every `teamStyles.primary` becomes
`controls.default`. `DevLoginDialog`, `MeetingsTile` and `ItemsTile` drop their
copies.

*Alternatives considered:*

- Global classes in `theme.css`. CLAUDE.md puts tokens there and components in
  CSS Modules, so this is rejected.
- Keeping the rules in `teams.module.css`, which is already the de facto shared
  file. It is named after a feature that has nothing to do with buttons, and the
  dashboard and the login dialog would still need their own copies, so this is
  rejected.

### 2. The default is marked by an accent outline, accent text and weight

The default must be noticeable without being filled, and filling is reserved
for "on". So the default uses an accent border and accent caption at weight 600.
The weight keeps it distinguishable without relying on hue (WCAG 1.4.1).
`--accent` already passes 4.5:1 as text on every surface, so it also passes 3:1
as a border. The contrast test gains one explicit assertion that names the
default-border pairing, so a later palette change cannot break it unnoticed.

*Alternatives considered:*

- A tinted background. Next to the hover tint it reads as "hovered", so this is
  rejected.
- A leading icon only. That is too subtle in a row of icon buttons on the
  dashboard, so this is rejected.

### 3. Which control is the default where

| Place | Default | Notes |
|---|---|---|
| Every form and dialog | its submit | Cancel stays `.button` |
| Metric settings add row | "Create new metric" | |
| Teams page | "Register team" | It is `aria-expanded`, so it fills while open (decision 1) |
| Signed-out panel | "Sign in" | |
| Dashboard meeting row | "Start meeting" on today's row | other rows have no default |
| Board toolbar | none | "Record values" is a toggle (`aria-pressed`): outlined when off, filled when on |

The board toolbar row fixes the inverted case described in Context.

### 4. Navigation becomes `.link`

The board's Meetings and Metric settings `Link`s, the meetings page's Board and
Metric settings `Link`s, My pulse check's Answer / Change answer, and the
dashboard's problems, tasks and archive links become `.link`, each with its
icon. A link is never a group's default: the marking belongs to buttons.
`controls.test.ts` also reads every component's source and fails on a `<Link>`
carrying `controls.button` or `controls.default`, because a rendered test only
sees the links its fixture reaches; the meetings page's links slipped through
that way at first. The dashboard's
meeting-row actions stay buttons because they may write first (spec: *Navigation
is a link*). The meeting navigator's Previous and Next stay buttons, because they
change what the page shows rather than leading somewhere else.

### 5. The banner's four type styles are four classes

`DeclarationsBand.module.css` keeps the layout rules (`.band`, `.grid`,
`.column` and so on). Text gets exactly one of four classes:

| Class | Font | Used on |
|---|---|---|
| `.label` | mono, `--fs-2xs`, 500, upper case, tracking 0.08em | band title, band note, column headings |
| `.headline` | sans, `--fs-lg`, 600, line height 1.3 | mission, vision, value names |
| `.subheading` | sans, `--fs-sm`, 600 | horizons |
| `.body` | sans, `--fs-sm`, 400, line height 1.5, ink | strategic sentences, goals |

Colour is not part of the type style. The band's title and note stay ink-2, and
the column headings stay accent, so that the band's own label stays apart from
the column labels. Value names move from `base` to `lg`, so that the band has four
styles and not five. The prose moves from ink-2 to ink, joining the goals.
The Values heading uses the same `heading()` helper without an icon, so it
cannot diverge again.

The test renders the band and asserts that every text-bearing element carries
exactly one of `styles.label`, `.headline`, `.subheading` or `.body`. Vitest
resolves CSS-module class names stably, so the test can import `styles` and
compare.

*Alternative considered:* asserting computed font styles in jsdom. jsdom does
not apply CSS-module styles, so this is rejected.

### 6. The tiles cap at three in the client

The summary keeps returning every team and every meeting row. The tiles take
`slice(0, 3)` of the server's order, and show "More…" only when the length is
greater than 3. The team count still shows the full number.

- Capping on the server would change the API, and My teams already reads the
  full list from the same summary.
- The constant `TILE_LIMIT = 3` lives in `DashboardPage.tsx`'s folder and is
  shared by both tiles.
- "More…" is a `.link` with an arrow icon. Its `aria-label` comes from
  `dashboard.moreTeams` / `dashboard.moreMeetings` ("More teams" / "Więcej
  zespołów", "More board meetings" / "Więcej spotkań"). Its visible caption is
  `dashboard.more` ("More…" / "Więcej…"). The accessible name contains the
  visible word, which satisfies WCAG 2.5.3.
- The link carries `state={here}`, so the target's back link leads back to the
  dashboard.

### 7. The My teams row and the countdown

The row shows, in order:

- the team's initials;
- its name, as a `Link` to `/teams/:id/members`;
- the viewer's role and the schedule, the meta line as it is today;
- its next meeting, as a `Link` to `/teams/:id/meetings` showing
  `format.dateTime`, or "No next meeting" as the link text when there is none.

Both links carry the origin state. The role and schedule line is unchanged, so
no `myTeams.*` key is removed.

The `Countdown` renders on the first row that has a next meeting. In the
server's order that is always the first row when any team has one. It sits under
that row's date. `.nearest*` styles go.

### 8. The recording status is a native `<select>`

The radio group becomes a `<select>` with the options Automatic (`''`), Green,
Amber and Red.

- It is named `recording.statusLabel` with the metric's name.
- It saves on blur, as the number and comment fields do.
- Each `<option>` gets a class that sets `color` to `--status-*`.
- The `<select>` gets the class of its chosen value, so the closed list shows
  the colour too. A small coloured dot before the text is not possible inside a
  native select, so the colour is carried by the text.
- `StatusBadge` beside it still shows the computed status in words, so colour is
  never the only signal.
- `.statusToggle` and `.statusOption` are deleted. The status column narrows to
  the select's width.

*Alternative considered:* a custom listbox (a button with a popover). It could
show a dot and colours consistently across browsers, but it reimplements
keyboard and screen-reader behaviour that the native control gives for free
(KISS). It is rejected unless the native option colouring proves inadequate
(see Risks).

### 9. A test pins the scheme

`styles/controls.test.ts` reads every `*.module.css` under `src/` (as
`contrast.test.ts` reads `theme.css`) and asserts the following:

- `background: var(--accent-solid)` appears only in `controls.module.css`,
  under a selector that names an on state (`[aria-pressed='true']`,
  `[aria-expanded='true']` or `:checked`). The one exception is
  `AppHeader.module.css`'s `.brandMark`, which is a logo, not a control.
- No module other than `controls.module.css` declares `.button`, `.primary` or
  `.default`.

These two assertions are what stop the scheme drifting again. Component tests
check the mapping of states to classes on representative pages.

## Risks / Trade-offs

- **Native option colours vary by browser.**
  - Chromium and Firefox honour `color` on `<option>`.
  - Safari on macOS draws its own menu and ignores it. The chosen value is
    still coloured on the closed control.
  - The words carry the meaning in every browser.

  → Accept. The deployment's browsers are Chromium-based, and the e2e check runs
  there.
- **The dark theme's native drop-down.** `color-scheme: dark` makes Chromium
  draw the popup dark, which the status colours were tuned for. → The e2e check
  in both themes covers it.
- **A broad rename (`teamStyles.button` → `controls.button`) touches about
  twenty files.** → It is mechanical, but CSS-module keys are untyped, so a
  missed rename silently renders `class="undefined"` rather than failing `tsc`.
  The guards are `controls.test.ts` (no other module declares `.button` or
  `.primary`), a `grep` for `teamStyles.button|teamStyles.primary` that must
  come back empty, and the existing component tests.
- **Value names grow from `base` to `lg`.** The values column then gets taller.
  → It is one of four columns that already wrap. Check at 1000px and 620px in the
  e2e pass.

## Migration Plan

Frontend only. A redeploy rolls it out and a redeploy of the previous image
rolls it back. Nothing is stored.
