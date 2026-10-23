# Design

## Context

`ReadinessPanel` (`frontend/src/features/board/ReadinessPanel.tsx`) renders a
`<details open>`: always expanded, collapsible by hand, the state not
remembered (decision recorded in the archived `meeting-readiness` design). It
already reads the location's hash and scrolls itself into view once per
`#readiness`. "Check readiness" on the dashboard links to
`/teams/:id?meeting=…#readiness`.

`BoardPage` changes view and meeting through `setSearchParams`, which writes a
new search string and drops the hash. The panel is rendered only in the
metrics view, so switching view unmounts it; switching meeting does not - the
same instance receives the new board.

## Goals / Non-Goals

**Goals:**
- Collapsed unless the board was reached through `#readiness`.
- The fragment is the one signal: the dashboard link, a pasted address and a
  reload all behave alike.

**Non-Goals:**
- Showing a summary (such as how many owe data) on the collapsed heading.
- Remembering the viewer's expand/collapse choice anywhere.
- Changing the dashboard link or adding a new query parameter.

## Decisions

### 1. The fragment decides the initial state; the viewer decides after

The panel holds `open` in React state, initialised from
`hash === '#readiness'` and kept in step with the element through
`onToggle`. The effect that already scrolls on `#readiness` also sets `open`
to true before scrolling, so arriving at the fragment on a board that is
already mounted (a same-page link) expands it too.

Alternatives: leaving `<details>` uncontrolled with `open={named ===
READINESS_ANCHOR}` makes React rewrite the attribute whenever the hash
changes, fighting the viewer's own toggle. A new `?readiness=open` query
parameter would survive view switches, but it duplicates the fragment the
spec already names as the panel's address, and the request was that only
"Check readiness" opens it.

### 2. A meeting switch starts the panel afresh

`BoardPage` keys `ReadinessPanel` on the shown meeting's id. A switch drops
the hash, so the remounted panel starts collapsed - the same as a view switch,
which already unmounts it. Without the key, a panel the viewer expanded on
one meeting would stay expanded on the next, contrary to "Leaving the panel's
address collapses it again".

### 3. Tests read the contents through an expanded panel

jsdom keeps the contents of a closed `<details>` in the DOM, so `within(panel)`
queries would still pass on a collapsed panel and prove nothing about what a
viewer sees. The tests assert the `open` attribute where state matters, and
the tests of the panel's contents open it first - by the fragment where the
scenario is about the address, otherwise by clicking the heading - so they
exercise the path a viewer takes. Playwright checks visibility for real.

## Risks / Trade-offs

- [A member who wants the panel every time must expand it each time] → The
  host reaches it through "Check readiness", which opens it; others asked
  for it out of the way. Revisit only if hosts ask.
- [The collapsed heading gives no hint that data is missing] → The dashboard
  row already says how many owe data; adding a count to the heading is a
  separate change (see Non-Goals).
