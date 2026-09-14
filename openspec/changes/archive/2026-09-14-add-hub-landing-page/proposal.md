## Why

BMAPP currently opens straight onto the team registration form: there is no landing
page, no way in to anything else, and nothing that tells a visitor what the
application is for. The `Board Meeting Hub` mockup in `mockups/` settles what that
landing page should look like — the company declarations band, the user's teams and
the countdown to the next board meeting, the five things a person comes here to do,
and the problem/task funnel. Building it now gives the project a real shell to hang
the remaining capabilities on, and turns the mockup into something that can be
reviewed running rather than as static HTML.

Almost everything the hub displays belongs to capabilities that are agreed but not
built — employees, meetings, metrics, targets, problems, tasks. Rather than wait for
all of them, the hub is served by one placeholder endpoint returning fixed data in
the shape the real capabilities will eventually fill. The page is then real, and each
future capability replaces a slice of that endpoint instead of inventing the page.

## What Changes

- **A new landing page (the "hub") at `/`**, laid out as the mockup: the company
  declarations band (mission, vision, strategic goals, values), a hero, the user's
  teams with the countdown to the nearest board meeting, the five action tiles
  (Configure / Prepare / Conduct / Browse BM, and Manage access), the problem and
  task funnel with its Open / In progress / Archived stages, and the "assigned to me"
  list.
- **A new read-only API endpoint `GET /hub`** returning everything the page renders
  as data, from a constant in a service. No database tables, no models, no Alembic
  migration. It is explicitly a placeholder: the response is documented as such, and
  every field is shaped the way the eventual real capability will return it.
- **Routing in the frontend.** `App` currently renders `TeamsPage` directly. A router
  is introduced: the hub is at `/`, the existing team registration page moves to
  `/teams`, and the mockup's `Archive` nav item is rendered as visibly not yet
  available. The header — brand, nav, language switcher, theme toggle, identity chip —
  becomes an app-level shell shared by both routes.
- **A dark / light theme.** The mockup's two palettes and its header toggle, dark by
  default, with the choice remembered between visits the way the language choice is.
- **Locale-aware date and time formatting.** The hub is the first page in BMAPP that
  displays a date, so the formatting of dates, times and numbers for the active
  language arrives here rather than with the meetings capability, which is where
  `CLAUDE.md` currently says it belongs. That note needs updating with this change.
- **A placeholder signed-in identity.** The hub payload carries a fixed current-user
  email, which the header chip and the "assigned to me" heading display. There is no
  authentication, no login and no `dev-basic-auth` profile in this change.
- No chart is rendered — the mockup's bar glyph is decorative — so Recharts stays
  uninstalled.

## Capabilities

### New Capabilities

- `hub`: the landing page. What it shows, where its data comes from, how the
  placeholder `GET /hub` endpoint is shaped and how its data stays fresh, and the
  navigation shell that makes the hub the page the application opens at.
- `appearance`: the visual theme of the interface — the supported themes, which one a
  first-time visitor gets, how a user changes it, and how the choice is remembered.
  App-wide, not hub-specific, which is why it sits beside `localization` rather than
  inside `hub`.

### Modified Capabilities

- `localization`: adds a requirement that dates, times and numbers are formatted for
  the active language. The existing six requirements are unchanged; this is an
  addition, not a revision of any of them.

## Impact

**Backend**

- New: `app/api/hub.py`, `app/schemas/hub.py`, `app/services/hub.py` holding the fixed
  payload and the small amount of logic that keeps it fresh (next meeting occurrence,
  due dates relative to today).
- Modified: `app/api/__init__.py`, `app/services/__init__.py`, `app/schemas/__init__.py`
  and `app/main.py` to register the router.
- No models, no migration, no database access on this path.

**Frontend**

- New: `src/features/hub/` (the page and its sections), `src/api/hub.ts`,
  `src/theme/` (theme resolution, persistence and the toggle), `src/components/AppHeader.tsx`,
  `src/routes.tsx`.
- Modified: `src/App.tsx` and `src/main.tsx` (router and theme provider),
  `src/i18n/en.ts` and `src/i18n/pl.ts` (every string the hub chrome needs, plus the
  theme control), `index.html` / global stylesheet for the mockup's palettes and the
  IBM Plex families.
- New dependency: `react-router` for routing. No other runtime dependency.

**Tests**

- Backend: unit tests for the hub service's date logic and payload shape, an
  integration test for `GET /hub`.
- Frontend: Vitest for the hub sections, the theme toggle and the date formatting, in
  both languages; a Playwright spec for opening the hub, switching language, toggling
  the theme and navigating to `/teams` and back.
- No BDD feature: the hub has no business rule of the kind `CLAUDE.md` reserves BDD
  for. Red/green highlighting still arrives with metrics.

**Documentation**

- `CLAUDE.md`: current state, the glossary entry for "hub", the note that locale-aware
  formatting belongs to the meetings capability, and the new dependency.
