## Context

See `proposal.md` — Why. The constraints that shape the approach:

- The tree today is one vertical slice. `App.tsx` renders `TeamsPage` directly, there is
  no router, no stylesheet, and no component that is not a form or a list. Everything
  the hub renders is new.
- Every domain entity the hub displays — employee, meeting, metric, problem, task — is
  agreed in `CLAUDE.md` but unbuilt, and each is meant to arrive as its own change. This
  change must not pre-commit their schema.
- `localization` is implemented and strict: the English catalogue's type is the contract,
  so a Polish page cannot silently fall back to English. Every string the hub adds goes
  through it.
- The mockup, `mockups/Board Meeting Hub.dc.html`, is the agreed visual design. It is a
  Claude Design artboard: inline styles over CSS custom properties, two palettes on a
  `data-theme` attribute, a client-side dictionary, and a `renderVals()` that computes
  the next meeting and the countdown. It is a layout reference, not code to port.
- The deployment is on-premise. Nothing at runtime may depend on reaching the public
  internet.

## Goals / Non-Goals

**Goals**

- A hub that a reviewer can open and compare against the mockup side by side.
- A payload shape the real capabilities can grow into, so that when meetings or problems
  arrive, the endpoint changes and the page does not.
- An app shell — header, navigation, language, theme — that the next five changes render
  inside without touching it.

**Non-Goals**

- Any persistence for what the hub shows. No models, no migration, no seed script.
- Authentication, sessions, or authorization of any kind.
- The pages the tiles point at. This change builds the hub, not what it leads to.
- Charts. The mockup's bar glyph is three coloured `div`s; Recharts stays uninstalled.
- Pixel fidelity to the mockup where the mockup is inaccessible. See the deviations
  decision below.

## Decisions

### One placeholder endpoint, `GET /hub`, built from a constant

The whole page is served by a single read-only request. `app/services/hub.py` holds the
data as module-level constants and builds a `HubSummary`; `app/api/hub.py` returns it.
No SQLAlchemy model, no Alembic revision, no `get_session` dependency on this path.

*Why:* it is the smallest thing that makes the page real, and it invents no schema for
entities whose specs are not agreed. A pleasant side effect of taking no session: the hub
answers even when Postgres is down, which makes the shell reviewable before the database
is up.

*Alternatives considered.* Several endpoints split along future capability lines
(`/hub/teams`, `/hub/items`, …): more surface to spec and test now, and the split would
be a guess at boundaries the real capabilities have not agreed. Real tables and a seed
script: pre-commits schema for meetings, problems and tasks, which is precisely what the
OpenSpec workflow exists to stop.

The response carries a field marking it provisional, so no other client mistakes it for
recorded data, and the OpenAPI description says the same.

### Prose comes back in both languages; states come back as codes

Three rules govern the payload, stated in the spec and repeated here with the reasoning:

| Kind of value | Shape | Example |
|---|---|---|
| Authored prose published in both languages | `{"en": "…", "pl": "…"}` | mission, vision, goals, values, an item's summary |
| A state drawn from a fixed set | a stable code the frontend translates | `role: "leader"`, `readiness: "metrics_missing"`, `kind: "problem"` |
| A point in time | ISO 8601 instant in UTC, or a calendar date | `next_meeting_at`, `due_on` |

*Why both languages rather than content negotiation.* `localization` requires that a
language change take effect immediately, without a reload and without losing loaded data.
If the API returned one language, switching would mean a refetch and a loading state on
every switch. Carrying both costs a few hundred bytes and makes the switch free.

*Why codes rather than text for states.* This is the convention the project already has
for field errors: the API names the reason, the frontend owns the wording. Board
readiness and role are the same kind of thing, and `metrics_missing` carries a count the
Polish wording has to decline differently from the English.

*Alternatives considered.* `Accept-Language` negotiation — rejected for the reload above.
Display-ready strings from the server (`"Thu, 18 Sep, 09:30"`) — rejected outright: it
puts locale logic on the server, defeats the `localization` requirement that formatting
happen at display time, and is unusable for the countdown.

*A known wart.* Returning an item summary as `{en, pl}` will not survive: a real problem
summary is free text a person types once, in one language. It is done here only because
the mockup shows both, and it is confined to `api/hub.ts` on the frontend. Recorded so
the problems/tasks change knows to drop it.

### The server keeps the placeholder dates fresh

Hard-coding `next_meeting_at: "2026-09-18T09:30:00Z"` gives a countdown that goes
negative within the week. Instead each team's constant holds a weekly slot — an ISO
weekday and a time of day, interpreted as UTC — and the service computes the next
occurrence strictly after the moment of the request. Assigned items hold a day offset
from today rather than a fixed date, chosen so that one item is always overdue and one is
always not.

*Why:* the hub is going to be looked at repeatedly over weeks while the rest of BMAPP is
built, and placeholder data that rots into a negative countdown is worse than no
placeholder at all. It also mirrors what the real meetings capability will do.

*Why UTC for the slot.* Introducing a configurable organisation timezone is a decision
the meetings capability should make, not this one. UTC keeps the countdown correct — a
duration is timezone-independent — and the displayed time is rendered in the reader's own
timezone. The consequence is that a "Thursday 09:30" slot may display as a different
local hour; acceptable for placeholder data, and flagged in the risks below.

*Alternative considered.* Computing the next occurrence in the browser, as the mockup
does. Rejected: it puts a rule in the client that the real API will own, and it means the
client cannot be tested against a payload that is simply wrong.

### `react-router` for routing, declarative mode

One new runtime dependency. `BrowserRouter` in `main.tsx`, a `routes.tsx` mapping `/` to
the hub, `/teams` to the existing page, and `*` to the hub, and a shared layout route
rendering the header.

*Why a library at all:* the spec requires bookmarkable addresses, no reload on
navigation, and a current-page indicator. Hand-rolling that over `history.pushState` is
the kind of framework-within-a-framework `CLAUDE.md` rules out, and every later change
adds routes.

*Why this one:* it is the default in the React ecosystem, it is what the Vite React
templates assume, and it needs no code generation or build step. TanStack Router would be
a better type-safety story and pairs with the Query library already in use, but it brings
a route-generation step and a much larger API for four routes. Revisit if the route table
grows teeth.

*Dev-server consequence:* an SPA needs an unknown path to serve `index.html`. Vite's dev
server and `vite preview` both do this by default, and the Compose stack runs the dev
server, so nothing extra is needed. Worth remembering when a production build is served
by something else.

### The theme is an attribute on `<html>`, set before first paint

The two palettes from the mockup become CSS custom properties under
`html[data-theme="dark"]` and `html[data-theme="light"]` in one global stylesheet. A
`src/theme/` module mirrors `src/i18n/detect.ts` exactly — `readStoredTheme`,
`storeTheme`, `resolveTheme`, every `localStorage` access guarded — keyed on
`bmapp.theme`, defaulting to dark. A React context exposes the active theme and the
toggle; the provider writes the attribute.

The no-flash requirement is met by a small inline script in `index.html` that reads the
same key and sets the attribute before the bundle loads. This duplicates the storage key
and the default in two places, which is a real cost; a unit test asserts the inline
script's key and default match the module's constants, so the two cannot drift silently.

*Why not `prefers-color-scheme`:* the spec says a first-time visitor gets dark, whatever
the machine prefers, because the meeting-room case is the common one. Honouring the OS
preference instead is a reasonable future change, and the resolution function is the one
place it would go.

*Alternatives considered.* A class on `<body>` — works, but `data-theme` also lets
`color-scheme` be declared so native form controls and scrollbars follow, which the spec
requires. CSS-in-JS or Tailwind — a dependency and a build concern for what is two
palettes of custom properties.

### Styling: one global stylesheet of tokens, CSS Modules per component

The palettes, the type scale and the spacing tokens live in `src/styles/theme.css`,
imported once. Everything else is a co-located `.module.css`. Vite handles CSS Modules
with no dependency.

*Why:* the mockup's inline styles are an artboard artifact, unusable for hover, media
queries and pseudo-elements, and unreadable at this size. No dependency buys anything
here.

### IBM Plex is self-hosted

`@fontsource-variable/ibm-plex-sans` and `@fontsource/ibm-plex-mono` are added and
imported, so the `woff2` files are bundled.

*Why:* the mockup links Google Fonts, and an on-premise deployment cannot assume the
public internet is reachable — the typography would silently fall back on exactly the
machines the application runs on. Self-hosting is the only option that works offline.
The alternative, dropping Plex for a system stack, loses the mono/sans contrast the
mockup leans on for every figure and label.

### Dates and numbers are formatted with `Intl`, not a date library

`src/i18n/format.ts` wraps `Intl.DateTimeFormat` and `Intl.NumberFormat`, keyed on the
active i18next language mapped to a locale (`en` → `en-GB`, `pl` → `pl-PL`), and exposes
the day/hour/minute breakdown the countdown needs. Both are in every supported browser;
`date-fns` or `dayjs` would add a dependency to do what the platform does.

The countdown recomputes from `next_meeting_at` on a 30-second interval, as the mockup
does — the display granularity is a minute, so a shorter interval buys nothing.

### Deliberate deviations from the mockup

Kept as a list because a reviewer comparing the two will notice them.

1. **Overdue and board-readiness are not signalled by colour alone.** The mockup marks an
   overdue item with a red pill and a not-ready board with amber text. The spec requires
   more than colour, so each also carries a word.
2. **The smallest type moves from 10px to 11px.** 10px mono at a secondary ink colour is
   below what is comfortable, and several of those labels are the only thing naming a
   figure.
3. **The layout stacks.** The mockup is a fixed four-column desktop grid. Breakpoints
   collapse it to two columns and then one; the inaccessible-at-narrow-widths version is
   not worth shipping.
4. **Tiles that lead nowhere say so.** The mockup's tiles are `<a href="#conduct">`.
   Every destination in this change is unbuilt, so they render as non-interactive and
   carry `aria-disabled`, with a translated "not yet available" note, rather than
   pretending to be links.
5. **The identity chip is not a menu.** The mockup shows an avatar and email that look
   like an account control; there is no session, so it is plain text.
6. **Polish says *wskaźnik*, not *miernik*.** The mockup's Polish calls a metric a
   *miernik*. The glossary fixed in the `add-i18n-en-pl` design says *Wskaźnik*, and
   `CLAUDE.md` says to follow it rather than invent synonyms, so the catalogue and the
   placeholder prose both use *wskaźnik*.

### Testing

Follows `CLAUDE.md`'s split, one named test per spec scenario.

- **Backend unit** — the next-occurrence rule, including the same-day-after-the-time case
  and the strictly-in-the-future property; the due-date offsets producing one overdue and
  one not; the payload's shape rules (both languages non-empty, states are codes, times
  are ISO 8601 UTC).
- **Backend integration** — `GET /hub` returns 200 with no credentials and a body matching
  the schema.
- **Frontend unit (Vitest)** — each hub section in both languages; the countdown,
  including the clamp at zero and the advance on a fake timer; the theme module's
  resolution and guarded storage; the toggle switching without losing typed text; routing
  between `/` and `/teams` and the unknown-address fallback; the formatting helpers in
  both locales; catalogue parity (the existing test covers this once the keys are added).
- **E2E (Playwright)** — open the hub, see declarations, teams and assigned items;
  switch to Polish and back; toggle the theme and reload to confirm it stuck; navigate to
  `/teams`, register a team, and come back.
- **No BDD feature.** `CLAUDE.md` reserves pytest-bdd for business rules worth stating in
  plain language — red/green highlighting, archiving. The hub has none: its rules are
  layout and a date calculation. `backend/tests/features/` stays empty until metrics
  arrive.

Backend coverage must stay at or above 85%; the hub service is pure functions over
constants, so this is not at risk.

## Risks / Trade-offs

**Placeholder data is mistaken for real data** → the response carries a provisional
marker, the footer reads "walking skeleton", and the spec says so in the requirement
itself. Anyone demoing the hub should be told the figures are invented.

**The `{en, pl}` summary shape leaks into the real problems/tasks capability** → it is
confined to `api/hub.ts` and to the hub's own components, and is called out above and in
the change's notes so the later change drops it rather than copies it.

**A weekly slot interpreted as UTC displays at an odd local hour** → accepted for
placeholder data. The meetings capability settles the organisation's timezone; when it
does, the slot gains a zone and nothing else about the hub changes.

**The theme key and default are written twice — in the inline script and in the module**
→ a unit test asserts the two agree, so the drift fails a build rather than producing a
flash nobody notices.

**A new runtime dependency (`react-router`) and two font packages** → the router earns
its place against the spec's routing requirements; the fonts are assets, not code, and
are the only way the agreed typography survives an offline deployment. Both go in the PR
description as `CLAUDE.md` requires.

**The hub is the largest piece of UI in the tree and has no design system behind it** →
the tokens in `theme.css` are that system's first draft. The next change that adds a page
should reuse them rather than start again; if it cannot, that is the signal to extract
shared components.

## Migration Plan

Purely additive. No database change, no migration, no data to move, nothing in the
existing API or its client is altered. The one behavioural change for an existing user is
that the root address now shows the hub rather than the team form, which moves to
`/teams`.

Rollback is `git revert` of the merge. There is no state to unwind.

## Open Questions

- Whether the company mission, vision, values and strategic targets eventually become a
  capability with stored, editable declarations, or stay configuration. The hub only
  displays them, so either answer leaves this change's spec intact.
- What the `Archive` navigation destination resolves to — a page of its own, or a tab on
  each board, as requirement 5 in `CLAUDE.md` suggests. It is named and disabled here
  either way.
