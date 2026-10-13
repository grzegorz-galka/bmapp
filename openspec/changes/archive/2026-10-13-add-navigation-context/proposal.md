# Proposal

## Why

Two things in the interface leave a person somewhere they did not mean to be.
The board, the meetings page, the members page and the metric settings page each
have a back link with a fixed target, so someone who reached the board from My
meetings or the dashboard is sent to the team list. And after signing out, the
page they were on stays mounted, its requests are refused for want of a token,
and it hangs on "Loading…" instead of saying they are signed out.

## What Changes

- A back link on a team's pages returns to the screen the page was opened from
  and names it: "Back to My meetings", "Back to the dashboard", "Back to the
  board", and so on. The origin travels with the navigation, not in the address.
- The board keeps its origin while its own view changes (the meeting shown, the
  pulse check, the archive, recording, the problems and tasks lists), so
  switching views never changes where the back link leads.
- With no recorded origin - a bookmark, a new tab, a link pasted from elsewhere -
  the back link falls back to the target and caption it has today.
- The metric settings page's link back to the board becomes that back link, so it
  returns to Team metrics when opened from there.
- Without a session, after signing out or when renewing the session fails, no
  page content is shown. A "Signed out" panel with a Sign in action takes the
  page's place in both modes, saying the session ended when it ended on its own.
- In development mode, signing out also opens the login window, as loading a page
  with no session already does. Signing in again shows the page the person was on.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `dashboard`: the navigation shell gains back links that return to where a
  team's page was opened from.
- `metrics`: the metric settings page's link back to the board becomes the
  context-aware back link.
- `authentication`: no page content is shown without a session; signing out and
  a failed renewal show a "Signed out" panel; in development mode signing out
  opens the login window.

## Impact

- **Frontend**: the entry links on the dashboard, My teams, My meetings, My pulse
  check, Teams, Team metrics, the board and the meetings page; the back links on
  the board, meetings, members and metric settings pages; the board's view
  switching; the route shell in `routes.tsx` and both session providers;
  both catalogues.
- **Tests**: Vitest for the back link and the signed-out panel; the e2e test
  "signing out leaves no identity and offers the way back in" changes, and a
  board flow checks the back link.
- **Backend, API, database**: none.
- **Dependencies**: none.
- **Ordering**: independent of `refine-board-forms`, apart from both adding
  strings to the catalogues.
