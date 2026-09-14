## 1. Backend: the placeholder hub summary

- [x] 1.1 Add `backend/app/schemas/hub.py` with the response models — `LocalizedText` (`en`, `pl`), `Declarations`, `HubTeam`, `PreparationCounts`, `FunnelStage`, `Funnel`, `AssignedItem`, `CurrentUser` and the `HubSummary` that holds them, plus the `provisional` marker — and export them from `app/schemas/__init__.py`; verify `uv run mypy app` is clean and the models instantiate in a throwaway REPL call.
- [x] 1.2 Add `backend/app/services/hub.py` holding the mockup's data as module-level constants: the three teams with their weekly slot as an ISO weekday plus a UTC time of day, the declarations in both languages, the preparation counts, the funnel figures and the four assigned items with a day offset instead of a fixed date; verify the constants cover every field the schemas declare by constructing a `HubSummary` from them in a unit test.
- [x] 1.3 Implement `next_occurrence(weekday, time_of_day, now)` in the hub service, returning the next occurrence strictly after `now`; verify unit tests cover the later-this-week case, the same-weekday-before-the-time case, the same-weekday-after-the-time case (which must return a week later) and the exactly-equal case.
- [x] 1.4 Implement `build_hub_summary(now)` assembling the payload — teams ordered by their next meeting soonest first, due dates resolved from the day offsets against `now` — and have the request path call it with the current UTC instant; verify a unit test asserts the ordering and that at least one item is overdue and at least one is not, at several different `now` values across a week.
- [x] 1.5 Add `backend/app/api/hub.py` with `GET /hub` returning the summary, taking no database session, and register the router in `app/api/__init__.py` and `app/main.py`; verify the route appears in the OpenAPI document and `uv run ruff check . && uv run ruff format --check . && uv run mypy app` passes.
- [x] 1.6 Write `backend/tests/unit/test_hub_summary.py` covering the shape rules from the spec — every localized text non-empty in both languages, every role, readiness and kind a code from the fixed set, every instant ISO 8601 in UTC and every due date a calendar date, and the provisional marker set; verify `uv run pytest tests/unit` passes.
- [x] 1.7 Write `backend/tests/integration/test_hub_summary_endpoint.py` asserting `GET /hub` returns 200 with no credentials and a body that validates against `HubSummary`; verify `uv run pytest` passes and `uv run pytest --cov=app --cov-report=term-missing` shows coverage at or above 85%.

## 2. Frontend: dependencies, tokens and fonts

- [x] 2.1 Add `react-router`, `@fontsource-variable/ibm-plex-sans` and `@fontsource/ibm-plex-mono` to `frontend/package.json`; verify `npm install` succeeds and `npm run build` still passes with no other change.
- [x] 2.2 Create `frontend/src/styles/theme.css` holding the mockup's two palettes as custom properties under `html[data-theme="dark"]` and `html[data-theme="light"]`, each declaring `color-scheme`, plus the type scale with 11px as the smallest size and the spacing tokens; import it and the two font packages once from `main.tsx`; verify the app renders in the dark palette under `npm run dev` and the Plex families are served from the bundle rather than a remote host.
- [x] 2.3 Check every text/background pairing in both palettes against the 4.5:1 and 3:1 thresholds and adjust any token that falls short; verify by recording the computed ratios for the secondary and tertiary ink colours on each surface and fixing any that fail.

## 3. Frontend: theme

- [x] 3.1 Create `frontend/src/theme/themes.ts` with the supported themes, the dark default, the `bmapp.theme` storage key and an `isSupportedTheme` guard, mirroring `src/i18n/languages.ts`; verify `npm run typecheck` passes.
- [x] 3.2 Create `frontend/src/theme/detect.ts` with `readStoredTheme`, `storeTheme` and `resolveTheme`, every `localStorage` access guarded; verify unit tests cover no stored value, a stored unsupported value and storage that throws on read and on write.
- [x] 3.3 Create `frontend/src/theme/ThemeProvider.tsx` exposing the active theme and a toggle, writing `data-theme` on the document element and remembering an explicit choice; verify a unit test asserts the attribute follows the toggle and that the choice is written to storage.
- [x] 3.4 Add the no-flash inline script to `frontend/index.html`, reading the same key and applying the same default before the bundle loads; verify a unit test asserts the key and default strings in `index.html` match the constants in `themes.ts`, so the two cannot drift.
- [x] 3.5 Add a `ThemeToggle` component naming the theme it would switch to and reporting the active theme to assistive technology, with its strings in both catalogues; verify unit tests cover switching each way, the wording following a language change, and typed form text surviving a theme change.

## 4. Frontend: routing and the app shell

- [x] 4.1 Create `frontend/src/routes.tsx` mapping `/` to the hub, `/teams` to `TeamsPage` and any unmatched address to the hub, under a layout route that renders the header; wrap the app in `BrowserRouter` in `main.tsx`; verify unit tests cover the root showing the hub, `/teams` showing the team page and an unknown address falling back to the hub.
- [x] 4.2 Create `frontend/src/components/AppHeader.tsx` with the mockup's brand block, the Hub / Teams / Archive navigation, the language switcher, the theme toggle and the identity chip, moving the switcher out of `App.tsx`; verify a unit test asserts the header renders on both routes and marks the current destination.
- [x] 4.3 Render the Archive navigation item as non-interactive with `aria-disabled` and a translated "not yet available" note; verify a unit test asserts it is exposed as unavailable and that activating it changes neither the page nor the address.
- [x] 4.4 Reduce `frontend/src/App.tsx` to the router outlet plus the header, and confirm the existing `App.test.tsx` and team-page tests still pass; verify `npm run test` is green.

## 5. Frontend: formatting and the hub client

- [x] 5.1 Create `frontend/src/i18n/format.ts` wrapping `Intl.DateTimeFormat` and `Intl.NumberFormat` on the active language mapped to `en-GB` / `pl-PL`, with a helper breaking a duration into whole days, hours and minutes clamped at zero, and a fallback returning the catalogue's "unavailable" message for a value it cannot interpret; verify unit tests cover a date and a number in both locales, the clamp, and the uninterpretable value.
- [x] 5.2 Create `frontend/src/api/hub.ts` with the `HubSummary` types mirroring the API, a `localized` helper picking the active language out of an `{en, pl}` pair, and `fetchHubSummary` going through the existing `request` machinery; verify `npm run typecheck` passes and a unit test asserts `localized` follows the active language.
- [x] 5.3 Create `frontend/src/features/hub/useHubSummary.ts` as a TanStack Query hook on its own key; verify a unit test renders a component through it against a stubbed fetch and asserts the loading, success and error states.

## 6. Frontend: the hub page

- [x] 6.1 Add every hub string to `frontend/src/i18n/en.ts` and `pl.ts` — section headings, tile titles and bodies, funnel stage names, role and readiness and item-kind codes, countdown units, the overdue marker, the "not yet available" note, loading and empty and failure messages, and the footer — following the glossary translations fixed in the `add-i18n-en-pl` design; verify `npm run typecheck` fails if a key is added to one catalogue only, and the existing parity test passes.
- [x] 6.2 Build the declarations band — mission, vision, strategic goals, values, each under its heading with the "visible on every board" note; verify unit tests assert every goal and value renders in order and that a language change redisplays them without a further fetch.
- [x] 6.3 Build the hero and the teams panel: team count, the nearest meeting singled out, and each team with name, role, weekly slot, next meeting and board readiness, ordered soonest first, with readiness carrying a word as well as a colour; verify unit tests cover the ordering, both readiness states and the assistive-technology text.
- [x] 6.4 Build the countdown, recomputing from `next_meeting_at` on a 30-second interval and clearing the interval on unmount; verify unit tests on fake timers assert it advances without a reload and reads zero for a meeting at or before now.
- [x] 6.5 Build the five entry-point tiles in the mockup's grid, each non-interactive with `aria-disabled` and the "not yet available" note, and hang the preparation counts and the in-session indicator off the right ones; verify unit tests assert all five render with their translated title and body and that none navigates.
- [x] 6.6 Build the funnel — the three stages with name, total and the problems/tasks split, the scope line, and the "closed → archived, never deleted" footer; verify unit tests assert each stage's figures and that the scope is stated in the active language.
- [x] 6.7 Build the assigned-items list with kind, summary, team, progress bar and percentage, and due date, marking an overdue item with a word as well as a colour, plus the empty state; verify unit tests cover an overdue item, an on-time item and the empty case.
- [x] 6.8 Add the hub's loading and failure states, leaving the header controls and the data-free sections usable on failure; verify unit tests assert the loading message, the failure message, and that the language and theme controls still work when the fetch fails.
- [x] 6.9 Render the identity from the summary in the header chip and as the assigned-items heading, with no sign-in, sign-out or account control anywhere; verify a unit test asserts the email comes from the fetched summary and a grep confirms no session control exists.
- [x] 6.10 Add the responsive breakpoints collapsing the mockup's four-column grid to two columns and then one, and the footer; verify the hub has no horizontal scroll at 400px and the teams panel and tiles stack rather than overflow.

## 7. End-to-end and verification

- [x] 7.1 Add `frontend/e2e/hub-landing.spec.ts` opening the hub and asserting the declarations, the team list, the countdown and the assigned items are present; verify `npm run test:e2e` passes against the Compose stack.
- [x] 7.2 Extend that spec with a switch to Polish and back, a theme toggle followed by a reload asserting the choice stuck, and navigation to `/teams` and back via the header; verify `npm run test:e2e` passes.
- [x] 7.3 Compare the running hub against `mockups/Board Meeting Hub.dc.html` in both themes and both languages, and fix any layout that breaks — particularly Polish text in the tiles and the funnel, which is longer than the English; verify by screenshot at desktop and narrow widths.
- [x] 7.4 Run the full gates: `uv run pytest --cov=app`, `uv run ruff check . && uv run ruff format --check . && uv run mypy app`, `npm run lint && npm run typecheck && npm run test && npm run test:e2e`; verify all pass and backend coverage has not dropped below 85%.
- [x] 7.5 Bring the stack up from clean with `docker compose down -v && docker compose up -d && docker compose exec backend alembic upgrade head` and open the hub; verify it renders end to end with no migration having been added by this change.

## 8. Documentation

- [x] 8.1 Update `CLAUDE.md`: add "hub" to the glossary, move the hub and appearance capabilities into the current-state paragraph, replace the note that locale-aware formatting belongs to the meetings capability, and list `react-router` and the font packages in the tech-stack table; verify the file still reads as current and no stale statement about the landing page or date formatting remains.
- [x] 8.2 Update `README.md` where it describes what the running application shows; verify the described first screen matches what `docker compose up -d` now serves.
- [x] 8.3 Write the PR description stating what and why, listing `react-router`, `@fontsource-variable/ibm-plex-sans` and `@fontsource/ibm-plex-mono` as new dependencies, and linking this change's `design.md` for the payload-shape and theme decisions; verify it names the placeholder nature of `GET /hub` explicitly.
