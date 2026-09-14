## Why

BMAPP runs board meetings for teams in a Polish organization, but every string in
the web app is hard-coded English — page headings, form labels, button captions,
empty and loading states, and the validation messages the API returns. A team
that holds its briefing in Polish reads its board in English. Making the UI
bilingual is cheapest now, while the frontend is one page and one API client:
every capability still to be built (meetings, metrics, problems, tasks,
archiving) would otherwise add more hard-coded English to retrofit later.

## What Changes

- A new **localization** capability: the UI renders in English or Polish, with a
  complete message catalogue per language and no user-facing literal left in a
  component.
- Language is resolved on first visit from the browser's preferred languages —
  Polish when the browser asks for Polish, English otherwise — and can be
  overridden by a language switcher visible on every page. The choice is
  remembered across visits and survives a reload.
- The document's `lang` attribute follows the active language, so screen readers
  and browser translation prompts see the right one.
- Locale-aware date and number formatting is **deliberately deferred**: nothing
  in the UI renders a date or a number yet, so a formatting helper would ship
  with no caller. It belongs to the meetings capability, which is the first to
  display a date. See `design.md` — Non-Goals.
- **BREAKING (API shape):** every field error in an API error response gains a
  stable machine-readable `code` alongside its existing `message`. The frontend
  renders the translated text for that `code` and no longer displays the
  backend's English `message`. `message` stays in the payload as a developer-
  facing fallback, so the response is additive for any other consumer; the
  break is that the frontend now depends on `code` being present and stable.
- Existing frontend tests that assert English literals move to asserting against
  the catalogue, and the Polish catalogue is checked for completeness against
  the English one so a missing translation fails the build rather than silently
  falling back.

## Capabilities

### New Capabilities

- `localization`: how the application decides which language to display, how a
  user changes it, what must be translated (including API error codes), and how
  locale-dependent values are formatted.

### Modified Capabilities

- `team-board`: the error responses for team registration gain stable error
  codes. The rejection scenarios currently require only that the offending field
  is identified; they now also require a documented code the client can map to
  its own message.

## Impact

- **Frontend** (`frontend/`): new `src/i18n/` (configuration plus `en` and `pl`
  catalogues), a language switcher component, `src/api/teams.ts` extended to
  carry `code` on `ApiFieldError`, and `TeamsPage.tsx` reworked to read every
  string from the catalogue. `main.tsx` gains the i18n provider.
- **Backend** (`backend/`): `app/core/exceptions.py` gains a code on
  `DomainError`; `app/main.py`'s two exception handlers emit it; the Pydantic
  validators in `app/schemas/team.py` attach codes to their validation failures.
  No database change, so no migration.
- **Dependencies:** adds `i18next` and `react-i18next` to the frontend. No new
  backend dependency — the backend emits codes, it does not translate.
- **Tests:** `TeamsPage.test.tsx` and `e2e/register-a-team.spec.ts` are rewritten
  against the catalogue and gain Polish coverage; backend integration tests
  assert the new `code` field. Coverage must not drop.
- **Docs:** `CLAUDE.md` gains the convention that user-facing strings live in the
  catalogues and that API errors carry codes; `README.md` notes how to add a
  language.
