# Design

## Context

- `build_board` (`backend/app/services/metric_values.py`) already loads values
  over a window of the team's last 12 meetings (`SPARKLINE_LENGTH`), ending at
  the meeting shown, for the sparklines. It computes `previous`, `change` and
  `improvement` from the meeting just before. The meeting four back falls
  inside the same window.
- `_improvement` returns `None` for `within_band` and for no change. The
  frontend reads `null` as "neither".
- The tile (`BoardPage.tsx`, `Tile`) prints `StatusBadge` (a dot and the status
  word), one change line and `describeThreshold` as text.
- Pulse results (`build_results` in `app/services/pulse_answers.py`) already
  return the viewer's `own` answer at the meeting. There is no separate
  `GET …/pulse/me`; only `PUT` exists. The answer form is filled from `own`.
- Derived metrics already define "the same week" as the ISO week of the
  meeting's date (`date.isocalendar()[:2]`).
- `--status-*` tokens are light in the dark theme and dark in the light
  theme. Text drawn on a status fill therefore needs its own ink per theme.

## Goals / Non-Goals

**Goals:**

- Put the new tile data on the existing board response, with no extra
  statement.
- Keep the status readable without colour: in the badge's accessible name
  and in its tooltip.
- Offer the pulse copy from data the results already fetch, with one extra
  statement and no new endpoint.

**Non-Goals:**

- Choosing the comparison window per board (always the previous meeting and
  four meetings back).
- Any notion of "closer to the band" for `within_band` metrics.
- Copying answers automatically, or across weeks.
- Changing the metric detail, the recording view or the sparkline.

## Decisions

### 1. "Four meetings earlier" is by position in the team's meetings

`window[position - 4]` in the existing list, the same way `previous` is
`meetings[position - 1]`. New fields on `BoardMetric`: `previous_4`,
`change_4` and `improvement_4`, computed with the same `_improvement`.

- *Alternative: the meeting closest to 28 days before.* This matches "monthly"
  better on a calendar, but skipped weeks make it ambiguous, and it would
  break the rule that the trend runs along the sequence of meetings
  (functional requirement 7). Rejected.
- *Alternative: compute on the frontend from `sparkline`.* The data is there,
  but the sparkline carries floats-as-strings for drawing, while improvement
  is a domain rule that already lives on the server. Rejected for parity with
  `change`.

The tile labels the indicators by meeting count ("4 mtgs" / "4 spotk."), not
"month", so the label stays true when a week is skipped.

### 2. The badge text comes from a new `describeTarget`

The new helper sits in `features/metrics/display.tsx` beside
`describeThreshold`. It returns:

- the target value with the unit, when the version has a target value;
- the green boundary in the metric's direction otherwise: `≤ x` or `≥ x`,
  and `a–b` for a band;
- `threshold.none` when there is no version.

A version whose target value is 0 takes boundaries, so it reads as its
boundaries too; numbers are written in the metric's decimals with the unit once
(`describeBounds` writes sentences, so it is not reused). The full `describeThreshold`
text moves into the tooltip unchanged, so the metric detail and the tooltip
word a threshold the same way.

### 3. The badge is one component; the tooltip is CSS plus `aria-describedby`

`StatusBadge` becomes a focusable element (`tabIndex=0`):

- **Background:** `var(--status-<s>)`, or `--status-none` (grey) for no data
  or no threshold.
- **Text:** a new `--on-status` ink token, defined per theme.
- **Accessible name:** "<status>. [Colour set by hand.] Target: …".
- **Tooltip:** a sibling element linked with `aria-describedby` and
  `role="tooltip"`. It shows on `:hover` and `:focus-visible`, and Escape
  dismisses it through a small state flag.
- **Set by hand:** a "✎" glyph beside the badge, `aria-hidden`, because the
  words are already in the badge's name.

`StatusBadge` is used elsewhere (metric detail, recording view, settings,
global metrics), and those places keep the current dot style. The new look is
a `TileBadge` used only by the tile, so the rest of the app doesn't change.

- *Alternative: the native `title` attribute.* It doesn't show on keyboard
  focus, it can't be styled, and touch devices ignore it. Rejected.
- *Alternative: a tooltip library.* Not worth a dependency for one tooltip
  (CLAUDE.md: dependencies only when they remove meaningful code). Rejected.

`contrast.test.ts` gains the pairings `--on-status` on each
`--status-green|amber|red` and on `--status-none` in both themes, at 4.5:1.

### 4. Change indicators are one small component used twice

`ChangeIndicator({ change, improvement, label, metric })` draws:

- ▲ for a rise, ▼ for a fall, → for no change and "–" for no number;
- the signed value through `format.metricValue`.

Its colour comes from `data-improvement` (`true` green, `false` red, `null`
neutral `--ink-2`). The accessible text is a catalogue string, e.g. "Since
previous meeting: +5, better". The arrows are inline SVG or text glyphs marked
`aria-hidden`.

### 5. The pulse copy offer rides on the results, as `elsewhere`

`PulseResults` gains `elsewhere: PulseElsewhere | null`. The type holds
`rating`, `positive`, `negative`, `better`, `team: {id, name}`,
`meeting: {id, date}` and `updated_at`. It is filled only when all of these
hold:

- the viewer is a member of this meeting's team, so they may answer;
- `own` is null;
- they have an answer at a meeting of another team in the same ISO week.

The query is one statement: the viewer's answers joined to meetings, filtered
by a date range Monday–Sunday of the ISO week, `team_id != this team`, ordered
by `updated_at desc`, limit 1. A date range keeps it index-friendly, where
`EXTRACT(week)` would not be.

- *Alternative: a new `GET …/pulse/me/elsewhere`.* One more round trip and one
  more route, for data the form needs at the same moment as `own`. Rejected.
- *Alternative: find it on the frontend from the dashboard summary.* The
  summary knows only whether the viewer answered, not the answer itself.
  Rejected.

The board keeps the set of meetings whose offer was declined, as React state beside "Hide names", so leaving the pulse view or the meeting does not bring the offer back. "Copy" sets the form's
fields from `elsewhere` and dismisses the offer. Nothing is written until
Save, which goes through the existing `PUT …/pulse/me`.

### 6. The countdown is deleted, not hidden

`Countdown.tsx`, its CSS module, its format helper in `i18n/format.ts`, the
`myTeams.countdown*` keys in both catalogues and the countdown tests (unit and
e2e) are removed. The timer-mocking setup in `DashboardPage.test.tsx` goes
too, if nothing else uses it.

## Risks / Trade-offs

- [A grey "no data" badge and a grey "no threshold" badge look alike.] →
  Their text differs ("Target: …" against "No threshold"), and the tooltip
  says which.
- [The tooltip is hidden on touch devices.] → A tap on the badge focuses it,
  which shows the tooltip; the metric detail still lists every threshold
  version.
- [Status ink on amber fails 4.5:1 in one theme.] → `contrast.test.ts` fails
  the build. Adjust `--on-status`, or the fill's lightness, before shipping.
- [A member copies by mistake.] → Copying never saves, and the form can be
  changed before Save.
- [`elsewhere` leaks an answer from another team.] → It is the viewer's own
  answer only, and only to the viewer. A test pins that another member's
  answer is never returned.

## Migration Plan

No schema change and no migration. The API change adds fields only. Deploy the
backend and the frontend together as usual. To roll back, redeploy the
previous images.
