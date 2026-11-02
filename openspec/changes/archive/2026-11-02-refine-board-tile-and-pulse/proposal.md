# Proposal

## Why

Using the board at real meetings has shown four small irritations. A tile spends
a whole line on a threshold definition that matters only when someone asks for
it, and its colour sits in a small dot. It shows one change, since the last
meeting, when a team also wants to see the trend over about a month. A member
who sits on two teams types the same pulse answer twice in one week. The
dashboard's countdown to the nearest meeting is noise, because the row already
shows the meeting's date and time.

## What Changes

- **Tile badge.** The status dot and the threshold line on a tile are replaced
  by one badge in the tile's top-right corner. The badge is filled with the
  status colour, or grey when the meeting has no number. It reads
  "Target: 72.3 %" ("Cel: 72,3 %") from the threshold's target value. A version
  with only boundaries reads them instead ("Target: ≤ 5", "Target: 90–110"). A
  metric with no threshold reads "No threshold". The status, and whether the
  colour was set by hand, are still given in words: in the badge's accessible
  name and in a tooltip.
- **Threshold on demand.** The full threshold definition, which used to be a
  line of text on the tile, moves into a tooltip over the badge. The tooltip
  opens on hover and on keyboard focus.
- **Two change indicators.** A tile shows two indicators: the change since the
  team's previous meeting, and the change since its meeting four meetings
  earlier. Each indicator is an up or down arrow with the signed difference.
  The arrow is green when the change is an improvement and red when it is a
  decline. It is neutral for a band metric or no change, and "–" when there is
  nothing to compare. The board's response gains the number four meetings back
  and the change since then.
- **Copy a pulse answer from the same week.** When a member opens the answer
  form for a meeting they have not answered yet, and they have already answered
  at another team's meeting in the same ISO week, the form offers to copy that
  rating and those texts. Copying fills the form; it does not save. The
  pulse results gain the viewer's own answer elsewhere that week.
- **BREAKING (UI only): countdown removed.** The dashboard's "My teams" tile no
  longer shows a countdown to the nearest meeting.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `metric-values`: the board of a meeting also returns the change since four
  meetings earlier; the board page's tile shows a target badge, the threshold
  in a tooltip and two change indicators.
- `pulse-check`: the results carry the viewer's own answer at another team's
  meeting in the same ISO week, and the answer form offers to copy it.
- `dashboard`: the countdown to the nearest meeting is removed.

## Impact

- **Backend:** `app/services/metric_values.py` (`build_board`) and its schema
  gain the fields for four meetings back. The data comes from the sparkline
  window already loaded, so there is no new statement. The pulse results
  service and schema gain the viewer's same-week answer elsewhere, which costs
  one more statement.
- **API:** the change adds response fields only and changes no existing field.
  `frontend/src/api/metrics.ts` and `frontend/src/api/pulse.ts` are updated to
  match.
- **Frontend:** the board tile (`BoardPage.tsx`, `board.module.css`), the
  status display helpers in `features/metrics/display.tsx`, the pulse answer
  form (`PulseForm.tsx`), `TeamsPanel.tsx`, and the removal of
  `Countdown.tsx` and its format helper. Both catalogues gain the new strings,
  and `theme.css` gains ink tokens for text on the status fills, held by
  `contrast.test.ts`.
- **Docs:** the CLAUDE.md line on the My teams countdown.
- **Dependencies:** none.
