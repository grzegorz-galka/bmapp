# Design

## Context

See `proposal.md` for the motivation. The relevant current state:

- The declarations are constants in `app/services/dashboard.py` (`DECLARATIONS`),
  shaped by `Declarations` in `app/schemas/dashboard.py`: `mission` and `vision`
  are `Statement {headline, body}`, `goals` a flat list, `values` carry
  `{name, description, icon}`. `DeclarationsBand.tsx` renders three columns
  (mission, vision, goals) above a row of values.
- The header (`components/AppHeader.tsx`) holds three `NavLink`s and an inert
  Archive `span`. It is `position: sticky; z-index: 20`. The metric detail's
  overlay (`board.module.css` `.overlay`) is `position: fixed; z-index: 10`,
  which is why the header covers the detail's top. The item dialog
  (`ItemDialog.tsx`) already uses a native `<dialog>` with `showModal()`, which
  sits in the top layer and is not affected.
- Board pages are capped at `--page-max: 1420px`. The side column is
  `minmax(18rem, 26rem)`. The meeting chooser reuses the meetings page's
  `.select`, which is `width: 100%`, inside a wrapping flex row, so it pushes the
  next button onto a new line.
- The board API already returns how complete the recording is (recorded/total).
  The pulse API already returns `editable` and the viewer's `own` answer, and
  `GET /teams/:id/meetings` returns a team's meetings with their hosts.
- The copy and include dialogs on the metric settings page are inline
  `role="dialog"` sections toggled under their buttons. The create form
  (`MetricForm`) sits open on the page.

## Goals / Non-Goals

**Goals:**

- Every change is to the interface or to the shape of constant data; no business
  rule, permission or table changes.
- The new personal pages are built from endpoints that already exist.

**Non-Goals:**

- Making the declarations editable (still the targets capability's job).
- Leader deputies and metric groups (`add-leader-deputies`, `add-metric-groups`).
- An archive across teams: the menu entry is removed, not built.

## Decisions

### The declarations get a structured shape, not shorter strings in the old one

The new `Declarations` is:

```
mission: LocalizedText
vision: LocalizedText
values: [{name: LocalizedText, icon: ValueIcon}]
strategy: {horizon: LocalizedText, statements: [LocalizedText]}
goals: [{horizon: LocalizedText, items: [LocalizedText]}]
```

`Statement` goes. *Alternative:* keep `Statement` with an empty `body` and the
goals as a flat list with "W 2026 roku" written into each item. Rejected: an empty
field is a field that lies, and the horizons are a grouping the band has to draw,
not text it can repeat. The section headings ("Misja", "Nasze wartości",
"Deklaracja strategiczna", "Cele") are interface labels and stay in the
catalogues. The horizons ("Do 2030 roku", "W 2026 roku") are part of the
declaration, so they travel with the data in both languages, as targets will.
The double space in "przychodu  przy" in the supplied text is normalised to one.

The English texts:

| Polish | English |
|---|---|
| Jesteśmy po to, aby zmieniać energetykę na lepsze | We are here to change the energy sector for the better |
| Chcemy tworzyć najlepsze rozwiązania w branży | We want to create the best solutions in the industry |
| Nasze wartości | Our values |
| Skuteczność · Pasja · Innowacyjność · Współdziałanie | Effectiveness · Passion · Innovation · Collaboration |
| Deklaracja strategiczna | Strategic declaration |
| Do 2030 roku | By 2030 |
| PSE Innowacje stanie się firmą tworzącą najlepsze rozwiązania dla branży energetycznej w Polsce, osiągającą najwyższy poziom satysfakcji klientów. | PSE Innowacje will become the company creating the best solutions for the energy sector in Poland, achieving the highest level of customer satisfaction. |
| Osiągniemy to poprzez bycie najbardziej skutecznymi w dowożeniu. | We will achieve this by being the most effective at delivering. |
| Cele | Goals |
| W 2026 roku | In 2026 |
| Wzrost: 174 mln zł przychodu przy zatrudnieniu 397 osób | Growth: PLN 174 million in revenue with a headcount of 397 |
| Satysfakcja klienta: pierwszy pomiar NPS z wynikiem dodatnim | Customer satisfaction: a first NPS measurement with a positive score |
| Satysfakcja pracowników: eNPS 35+ | Employee satisfaction: eNPS 35+ |
| Satysfakcja klienta: NPS 50+ | Customer satisfaction: NPS 50+ |

The band becomes one row of four columns (mission and vision stacked, values,
strategic declaration, goals), collapsing to one column on narrow screens. The
values become a compact list of pictogram and name. The strategic declaration
gets a new pictogram; the existing flag stays with the goals.

### One modal dialog primitive for every new dialog

The create-metric, copy, include and register-team forms open in the native
`<dialog>` + `showModal()` pattern that `ItemDialog` already uses. The small
`Modal` wrapper inside `ItemDialog.tsx` moves to `components/Modal.tsx` and is
reused. It is needed four more times now, so this is not abstraction for the
future. *Alternative:* keep the inline `role="dialog"` sections. Rejected: they
push the page down and are what the request asks to remove. A library dialog
would add a dependency for something the platform does.

The metric detail moves onto the same primitive. The top layer is above the
sticky header by construction, which fixes the overlap without tuning z-index
values. *Alternative:* raise `.overlay` to `z-index: 30`. That works, but it
leaves two ways of doing dialogs, and the next sticky element would bring the
bug back.

### Navigation: a disclosure, not an ARIA menu

Configuration is a `<button aria-expanded>` that reveals a list of three
`NavLink`s, and closes on Escape, on choosing a link and on a click outside. It
is not `role="menu"`: these are links between pages, and the disclosure pattern
keeps normal Tab navigation. The group is marked current when the location
matches `/teams` (exactly), `/team-metrics` or `/global-metrics`. A team's own
pages (`/teams/:id/…`) are reached from My teams, and none of the five entries
is current there.

New addresses: `/my-teams`, `/my-meetings`, `/my-pulse`, `/team-metrics`.
`/teams` and `/global-metrics` keep theirs, so every bookmark and the e2e flows
still resolve.

### The personal pages compose existing endpoints

- **My teams** reads the dashboard summary's `teams`, which is already in the
  query cache because the header uses it. It renders the dashboard's team rows
  with four links each. No new request.
- **My meetings** fetches `GET /teams/:id/meetings` for each of the viewer's
  teams with TanStack Query's `useQueries`, merges them and splits them at the
  current moment as the meetings page does.
- **My pulse check** takes, per team from that same meetings data, the latest
  past meeting and the first upcoming one. Those are the only candidates that
  can take answers. It fetches their pulse results, keeps those whose
  `editable` is true, and reads `own` for answered or not. The action links to
  the board's existing `?meeting=…&view=pulse&mode=answer` address.
- **Team metrics** lists `GET /teams` with the viewer's teams (from the summary)
  first, each linking to `/teams/:id/metrics`.

*Alternative:* a `GET /me/meetings` and a `GET /me/pulse` endpoint. Rejected for
now: a viewer is in a handful of teams, so the fan-out is a few small requests
already cached for the meetings pages. A server endpoint would duplicate the
"which meetings take answers" rule the pulse API already applies. Revisit if
team counts per person grow.

### Board width and the navigator

The board keeps `--page-max` like every other page, and the side column becomes
`minmax(21.6rem, 31.2rem)`, each bound ×1.2. A wider board (`--page-max-wide:
1920px`) was tried and dropped: on a wide screen it pushed the tiles to the left
edge and the problems and tasks to the right, with nothing between them. The navigator becomes `flex-wrap: nowrap` above the narrow breakpoint, and
the chooser gets `width: auto` with no `min-width`, so it is as wide as its
longest option. The shared `.select` is left untouched for the other pages.

### The metrics count on the view switch

A new catalogue key `pulse.metricsCount: 'Metrics {{recorded}}/{{total}}'`
(`'Wskaźniki {{recorded}}/{{total}}'`) mirrors `pulse.switchCount` and reads the
board query's completeness. Recording a value already invalidates that query,
so the count follows without new wiring. While the board loads, the caption is
the plain "Metrics".

### Status toggle

The recording view's `<select>` becomes a segmented radio group (`role="radiogroup"`
with four `type="radio"` inputs styled like `.segmented`). The options are
automatic (empty), green, amber and red, captioned "Status" / "Status". The
values sent are the same `manual_status` codes, so the API is untouched. Only
the label changes. "Colour set by hand" stays the domain term in code and specs.
The number field becomes `width: 12ch` (10 characters plus padding).

### Values grid in the detail

`RecentValues` becomes a `<table>` with a caption and the columns Date, Value,
Status and Comment, listing every recorded meeting newest first. The `RECENT = 8`
cap is dropped. It scrolls inside the dialog past a max height. The date
renders as the meeting's ISO `date` string as received, so no `Intl` formatting
is applied. The visually hidden table that mirrors the chart for screen readers
stays, because it covers every meeting, including those without a value.

### Meetings page

`ScheduleSection` gets an `editing` state. The schedule shows as text with a
link-styled button reading "Set schedule" or "Change schedule". The form is
rendered only while editing and closes on a successful save or on Cancel. The
labels change to `meetings.prepare: 'Plan next meeting'` /
`'Zaplanuj następne spotkanie'` and `meetings.open: 'Create the meeting'` /
`'Utwórz spotkanie'`. The fields become `width: auto` with explicit widths:
weekday `16ch` (longest weekday name), time `8rem`, date `11rem`.

## Risks / Trade-offs

- [The summary's `declarations` shape changes] → The web app is the only
  consumer and changes in the same PR. The OpenAPI document regenerates, and the
  integration test pins the new shape.
- [`add-leader-deputies` and `add-metric-groups` touch some of the same files
  (`MetricSettingsPage.tsx`, the dashboard role codes)] → This change lands
  first. Each later change rebases its delta onto the result, and
  `add-metric-groups` already states that it builds on this one.
- [The fan-out on My meetings and My pulse check grows with team count] →
  Bounded by membership, and cached per team. A `/me/*` endpoint is the
  fallback recorded above.
- [Removing the Archive entry loses a hint that an archive exists] → Each board
  keeps its Archived view, one click from My teams.

## Migration Plan

No data migration. Deploy backend and frontend together, since the summary's
shape changes. Rollback is reverting the PR.
