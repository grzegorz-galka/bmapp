# Tasks

Frontend only. Test names below are the scenario names they cover; each
scenario maps onto exactly one named test.

## 1. The origin and the back link

- [x] 1.1 Add the `Origin` type, the `useOrigin()` reader and a `<BackLink>` component (design D1, D2, D4) in `frontend/src/components/`, and the `back.*` captions, one per origin screen, to `src/i18n/en.ts` and `pl.ts` (D5); verify with `components/BackLink.test.tsx` covering: a known origin renders its caption and target and passes the origin's own state on; an unknown or missing origin renders the given fallback; and `npm run typecheck` passes (a missing Polish caption fails `tsc`).
- [x] 1.2 Pass `state={{ from: … }}` on every entry link listed in design.md's Context table: `MeetingsTile` (its `navigate` calls), `ItemsTile`, `MyTeamsPage`, `MyMeetingsPage`, `MyPulsePage`, `TeamsPage`, `TeamMetricsPage`, and the links from `BoardPage` and `TeamMeetingsPage` to other team pages (with the board's or meetings page's own state nested, D2); verify each page's existing tests still pass and `MeetingsTile`'s test asserts the state it navigates with.

## 2. The four team pages use it

- [x] 2.1 Replace the fixed back links in `BoardPage.tsx`, `TeamMeetingsPage.tsx`, `TeamMembersPage.tsx` and `MetricSettingsPage.tsx` with `<BackLink>`, keeping today's target and caption as the fallback; verify the existing tests that find the back link by its caption still pass.
- [x] 2.2 Forward the location state on every view change in `BoardPage.tsx` (each `setSearch` and any in-board link that only changes the view, D3); verify `BoardPage.test.tsx` `it('The board leads back to the screen it was opened from')`, `it("The board's own views keep the origin")` and `it('The back link reads in Polish')` pass.
- [x] 2.3 Verify `MetricSettingsPage.test.tsx` `it('Opened from Team metrics, the page leads back there')` passes, and that the existing scenarios of "The metric settings page" still pass unchanged.
- [x] 2.4 Add to `src/routes.test.tsx` `it('A page opened from the board leads back to the board, which still knows its origin')` (board from My teams -> meetings page -> back -> back) and `it('A page with no recorded origin falls back to its default')` (board, meetings, members and metric settings opened directly); verify they pass.

## 3. Signed out

- [x] 3.1 Add `SignedOutPanel` and gate the layout route's `<Outlet />` in `routes.tsx` on the session status (`signedOut` and `ended` show the panel; the auth callback route stays outside the gate, D6), with the panel's strings in both catalogues and the ended text taken from `auth.sessionEnded`; give `routes.test.tsx` and `App.test.tsx` a signed-in session in their setup; verify `features/auth/SignedOutPanel.test.tsx` `it('Signing out replaces the page with the panel')`, `it('An ended session replaces the page with the panel')`, `it('Signing in from the panel returns to the page')` and `it('The panel reads in Polish')` pass, and that no request is made while the panel is shown.
- [x] 3.2 Make `DevAuthProvider.signOut` reopen the login window (D7); verify `DevAuthProvider.test.tsx` `it('The window opens after signing out')` passes, together with the existing window tests.
- [x] 3.3 Extend `session.test.tsx`: the test for "Signing out discards the session" also asserts the panel takes the page's place, and the test for "Renewal fails" asserts the panel says the session ended; verify they pass.

## 4. End to end

- [x] 4.1 Change `e2e/sign-in-and-out.spec.ts` "signing out leaves no identity and offers the way back in": after signing out from a board, the board is gone, the signed-out panel is shown, nothing reads "Loading", and the login window is open; signing in through it shows the same board. Verify `npm run test:e2e` passes against `docker compose up`.
- [x] 4.2 Add `e2e/navigation.spec.ts`: a member opens a board from My meetings, switches to the pulse check and back to the tiles, follows "Back to My meetings" and lands on My meetings; then opens the board from the dashboard and is offered "Back to the dashboard". Verify `npm run test:e2e` passes.

## 5. Documentation and gates

- [x] 5.1 Add to `CLAUDE.md` (*Current state*) that a team's pages lead back to where they were opened from, the origin travelling in router state with today's targets as the fallback, and that nothing under the routes renders without a session; verify the text matches the shipped behaviour.
- [x] 5.2 Run `npm run lint && npm run typecheck && npm run test` and `npm run test:e2e`; verify all pass.
- [x] 5.3 Run `openspec validate add-navigation-context --strict`; verify it reports the change valid.
