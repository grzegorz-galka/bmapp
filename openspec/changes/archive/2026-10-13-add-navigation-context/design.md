# Design

## Context

See proposal.md for why. The facts the approach rests on:

**Back links today** are plain `<Link>`s with fixed targets:

| Page | Route | Back link today |
|---|---|---|
| Board | `/teams/:teamId` | `board.back` "Back to the teams" -> `/teams` |
| Meetings page | `/teams/:teamId/meetings` | `meetings.back` "Back to the teams" -> `/teams` |
| Members page | `/teams/:teamId/members` | `members.back` "Back to the teams" -> `/teams` |
| Metric settings | `/teams/:teamId/metrics` | `metrics.back` "Back to the board" -> `/teams/:teamId` |

**Links into those pages**, by origin screen:

| Origin (route) | Component | Leads to |
|---|---|---|
| Dashboard (`/`) | `MeetingsTile` (`navigate`, three actions) | board `?meeting=…`, `&mode=record`, `&view=pulse&mode=answer` |
| Dashboard (`/`) | `ItemsTile` | board `#problems`, `#tasks`, `?view=archived` |
| My teams (`/my-teams`) | `MyTeamsPage` | board, meetings, members, metric settings |
| My meetings (`/my-meetings`) | `MyMeetingsPage` | board `?meeting=…` |
| My pulse check (`/my-pulse`) | `MyPulsePage` | board `?view=pulse`, `?meeting=…&view=pulse&mode=answer` |
| Teams (`/teams`) | `TeamsPage` | board, meetings, members |
| Team metrics (`/team-metrics`) | `TeamMetricsPage` | metric settings |
| Board (`/teams/:id`) | `BoardPage` | meetings page (x2), metric settings (x2) |
| Meetings page (`/teams/:id/meetings`) | `TeamMeetingsPage` | board, metric settings |

The board changes its own view through `setSearch` (`useSearchParams`) in
`BoardPage.tsx`: the meeting shown, tiles/pulse/archived, record and answer
modes. Each change is a navigation, so it is a history entry.

**Signed out.** Pages read the session only for the viewer's email; none checks
`status`. `DevAuthProvider.signOut` discards the token, sets `signedOut` and
clears the query cache, but `windowOpen` stays false (the window opens only on
load and on "Sign in"). The page stays mounted, its cleared queries refetch with
no token, are refused, and the page sits on its loading text. In production
`signoutRedirect` leaves for the broker and returns to the application's origin
(`post_logout_redirect_uri`) with no session, and a failed renewal sets
`ended` while the page stays mounted - both reach the same state.

## Goals / Non-Goals

**Goals:**

- One mechanism for every back link, so a new entry link or a new team page
  cannot get it subtly wrong.
- Nothing rendered under the routes fetches while nobody is signed in.

**Non-Goals:**

- A back link on pages that are not a team's page (the dashboard, the personal
  pages, Teams, Team metrics, Global metrics). They are reached from the
  navigation control.
- Breadcrumbs or a history of more than the chain described in D2.
- The board's in-page "Back to the board" (`board.showTiles`), which switches the
  board's own view and is not a back link.
- The members page's "team not found" link back to the team list, which stays.
- The `restoring` status. Pages keep rendering while a session is restored, as
  today; restoring ends in `signedIn` or `signedOut` within one request.

## Decisions

### D1. The origin travels in router location state

An entry link passes `state={{ from: Origin }}`; the back link reads
`useLocation().state?.from`.

```ts
type Screen = 'dashboard' | 'myTeams' | 'myMeetings' | 'myPulse'
            | 'teams' | 'teamMetrics' | 'board' | 'meetings';
interface Origin { screen: Screen; path: string; state?: unknown }
```

`path` is the full address the person was on (pathname, search and hash), so
"Back to My meetings" returns to the same filters and fragment. `screen` picks the
caption; the caption is never derived from the path. A small helper in
`components/` (for example `useOrigin()` and `<BackLink fallback=… />`) owns both
the reading and the fallback, so the four pages do not each repeat them.

- *Alternative: `history.back()` (`navigate(-1)`).* Rejected. The board's view
  changes are history entries, so "back" from the pulse view returns to the
  tiles, not to the screen the board was opened from; on a bookmark or a new tab
  there is no entry to go back to at all, and the caption cannot name a
  destination it does not know.
- *Alternative: `?from=my-meetings` in the address.* Rejected. It clutters every
  address on the board, and a shared or bookmarked link carries the sender's
  origin to someone who never came from there.

Location state lives in `history.state`, so it survives a reload of the same
entry but not a new tab or a pasted address - exactly the cases the fallback
covers.

### D2. A page opened from a team page keeps the chain

When the board opens its meetings page or metric settings, the origin it passes
is the board itself, `{ screen: 'board', path, state: <the board's own location
state> }`. The back link navigates to `path` with that `state`, so arriving back
on the board restores the board's own origin and its back link still names it.
The chain is as long as the person's actual path through team pages and needs no
bound of its own. The same applies from the meetings page to the board or the
metric settings.

### D3. The board forwards its origin on every view change

Every `setSearch(…)` in `BoardPage.tsx` passes the current location state on
(`setSearchParams(next, { state: location.state })`), and so does any in-board
link that changes only the view. Without this, the first view switch would drop
the origin. A unit test switches through tiles, pulse, archived and back and
asserts the caption.

### D4. Fallback is today's behaviour

No `from` (or one whose `screen` is not known): the board, meetings and members
pages show "Back to the teams" to `/teams`; metric settings shows "Back to the
board" to the team's board. These are the existing `*.back` captions, kept.

### D5. One caption per origin screen

A catalogue group `back` with one caption per `Screen` - "Back to the dashboard",
"Back to My teams", "Back to My meetings", "Back to My pulse check", "Back to the
teams", "Back to Team metrics", "Back to the board", "Back to the meetings" -
mirrored in Polish, with the screen names matching the navigation control's
(`nav.*`). `Translations` makes a missing Polish caption a `tsc` error.

### D6. The signed-out gate sits in the route shell

The layout route in `routes.tsx` renders `<Outlet />` only when the session is
`signedIn` or `restoring`; for `signedOut` and `ended` it renders a
`SignedOutPanel` instead. The header stays, so the account control and the
language and theme toggles keep working. The auth callback route sits outside
the gate, since it is how a session begins.

Because the routes are not rendered, no query is mounted and nothing fetches -
the "Loading…" cannot happen on any page, present or future. The panel offers
`signIn()` from the session context; the address is unchanged, so after signing
in the same route renders and loads as the new person. In production the
sign-in redirect already returns to the page it was started from.

- *Alternative: each page checks the session.* Rejected: thirteen pages, and the
  next one forgets.
- *Alternative: redirect to a `/signed-out` route.* Rejected: it loses the address
  the person was on, which D6 relies on to return them.

The panel's text for `ended` reuses the existing "session ended" message
(`auth.sessionEnded`), shown visibly rather than only to screen readers.

### D7. Development sign-out reopens the window

`DevAuthProvider.signOut` sets `windowOpen` to true. The window is drawn over the
signed-out panel, so closing it leaves the panel, whose Sign in reopens it.

## Risks / Trade-offs

- [An entry link is added later without `state`] → its target falls back to
  today's back link: wrong caption at worst, never a broken page. The helper
  makes the right thing the short thing to write.
- [The board forgets to forward state on a new view switch] → the D3 unit test
  covers every switch that exists; a new one should be added there.
- [Production sign-out returns to the root, not the page] → the broker's
  post-logout return goes to the application's origin; the dashboard then shows
  the panel. Accepted: the person chose to leave, and signing in from there is
  the expected path.
- [Tests that render through the route shell have no session] → the gate would
  hide their pages. Page tests render pages directly and are unaffected;
  `routes.test.tsx` and `App.test.tsx` render the shell without signing in, so
  they gain a signed-in session in their setup.

## Migration Plan

Frontend only; no data or API change. Rollback is reverting the change.
