# Design

## Context

See `proposal.md` for why. What already exists and shapes the approach:

- **The board's order is already right.** `GET …/meetings/:id/board` returns
  the metrics sorted by `BOARD_ORDER` (group position with ungrouped last, then
  position, then name), the same order the tiles use. The recording view lists
  them flat, so the order is right but the groups are not visible. The tiles
  group them in `Tiles` (`BoardPage.tsx`).
- **The board is one two-column grid in every metrics mode.**
  `.layout` = `minmax(0, 1fr) minmax(21.6rem, 31.2rem)`, and `ItemLists` is
  always its second cell. Inside the table, `td:nth-child(4)` (the comment) is
  `width: 100%`, so it takes every spare pixel. The metric cell stays at its
  `min-width: 12rem` and its details wrap.
- **A row's messages live in the state column**, `.rowState`, which is capped
  at `max-width: 14rem`. "Derive" follows the number input inside the
  same narrow cell, so it wraps under the input.
- **Deriving is already a read.** `GET …/meetings/:m/metrics/:id/derivation`
  returns the number and every source's team, metric, meeting date and number,
  or a 422 naming each missing piece. The recording view calls it through a
  mutation hook (`useDeriveValue`), because the result is saved immediately.
- **`metric_derivation_kind` is a VARCHAR with a check constraint**, not a
  native enum (`_enum` in `models/metric.py`), so a kind is added by rewriting
  the constraint inside a transaction.
- **The metric detail knows only the metric.** `MetricDetail` takes a
  `MetricDefinition` and reads the trend over every meeting. It is not given
  the meeting the board shows.

## Goals / Non-Goals

**Goals:**

- The recording table reads like the board: the same groups in the same
  order, with every row on one line at the usual desktop widths.
- One grouping function serves the tiles and the table, so the two cannot
  drift.
- The metric detail explains a derived value with the same endpoint, and the
  same refusal messages, as the recording view.
- `weighted_mean` is one enum value, one column, one branch in `derive`, and
  its validation.

**Non-Goals:**

- Storing what a derived value was computed from. The value stays a snapshot.
  The detail re-derives and says when the result differs.
- Explaining past meetings' values in the detail. The section is about the
  meeting the board shows; the chart and the values grid cover the rest.
- Re-weighting a weighted mean over the sources that have a number.
- Weights on `mean`, `sum` or `delta`.

## Decisions

### 1. The detail re-derives when read; nothing is stored

Opening the sources section calls the existing derive endpoint for the board's
meeting. The section compares the result with the number recorded there, and
when they differ it says the sources have changed since.

**Alternatives:**

- **Store a snapshot of the sources when the value is saved.** This needs a new
  table and a change to the save path. It would be empty for every value
  recorded before this change, and meaningless for a number typed over a
  derived one. Rejected: what the user needs is "where does this come from",
  and a re-derivation with an honest mismatch warning answers that at no
  schema cost.

The comparison is numeric, not textual. The recorded value is
`NUMERIC(21, 6)` and travels as a string. A sum is exact, so `"19.500000"` and
`"19.5"` must compare equal. The frontend compares both through the same exact
decimal parser it uses for display, never through `Number`.

### 2. The section is about the meeting the board shows

`BoardPage` passes the shown meeting (id and date) and the board entry's
recorded value to `MetricDetail`. The section is a native `<details>`, as on
the settings row. The derive call is a TanStack *query*, enabled only once the
section has been opened, and keyed by team, meeting and metric so that
reopening it does not call again.

**Alternatives:**

- **Choose any meeting from the values grid.** This needs selection state and
  keyboard handling in the grid, and a call per selection, for a question the
  chart already answers better. Rejected for now; the query key already allows
  it later.
- **Reuse the mutation hook `useDeriveValue`.** A mutation is for something
  that changes the server. Using one to read would bypass caching and fire on
  every open. Rejected.

### 3. Group sections in the table: one `<tbody>` per group

Each group is a `<tbody>` whose first row is a `<th colSpan={5}
scope="rowgroup">` with the group's name. Every group shares the table's one
`<thead>`, so the columns line up across groups. The grouping (order, the
ungrouped heading last, sorting inside a group) moves out of `Tiles` into one
function, `groupMetrics(board, { hidden })`, in a module shared by the board
and the recording view. The tiles call it without hidden metrics and the table
with them.

**Alternatives:**

- **One table per group.** The column widths would be computed per table, so
  the fields would no longer line up between groups. Rejected.
- **A group column.** It repeats the group name on every row and costs width,
  which this change is trying to win back. Rejected.

On a narrow screen, where rows stack as cards, the heading row becomes a block
heading above its cards.

### 4. A row's message on a second row with `colSpan`

Every row renders a second `<tr>`, `<td colSpan={5}>`, only when it has
something to say: the derived note, not a number, a failed save, or a refusal
to derive. The `role="alert"` paragraph moves there. The state column keeps
only "Saving…" and "Saved", in its `aria-live` span. The number input and
"Derive" sit in a non-wrapping inline flex container.

**Alternatives:**

- **Widen the state column.** Every row would pay for the width of the rarest
  message. Rejected.
- **Put the message under the number field.** This is still one narrow column,
  and the refusal names several sources. Rejected.

### 5. Full width while listing, and the comment column no longer takes all spare width

`BoardBody` already knows when the values are listed. `BoardPage` renders
`{lists}`, and the two-column `.layout`, only when they are not. While listing,
the main column is the whole grid. In the table, `td:nth-child(4) { width:
100% }` goes. The metric cell's meta line gets `white-space: nowrap` from 75rem
up, where the board is wide enough for it, and wraps below that. The table sits
in its own `overflow-x: auto` container, so an unusually long line (a Polish
threshold, say) scrolls the table rather than the page. The comment field fills
whatever is left. At 1280px the
board is about 1230px wide, which holds a 60-character meta line with room for
the fields. That is the width the spec's scenario uses.

**Alternatives:**

- **Hide the lists only in `edit` mode.** Correct and read-only listing would
  then have different layouts, although the spec says the three use the same
  columns. Rejected.

An address naming `#problems` or `#tasks` together with `mode=record` drops
`mode` with a `replace` navigation, so the named list exists to scroll to.
`ItemLists` already scrolls to the hash after it renders.

### 6. `weighted_mean`: a nullable weight on the source row

```
metric_derivation_sources
  + weight NUMERIC(21, 6) NULL
    CHECK (weight IS NULL OR weight > 0)
metrics.derivation_kind CHECK
  + 'weighted_mean'
```

The schema accepts `weight: ExactDecimal | None` on `DerivationSourceWrite`.
`check_derivation` checks it per kind, in the existing loop and in source
order: with `weighted_mean`, a missing weight raises `weight_required` and a
weight of 0 or less raises `weight_invalid`; with any other kind, any weight
raises `weight_invalid`. The database check is a second line of defence.
`derive()` takes the weights in parallel with the numbers:

```
weighted_mean = (sum(w_i * x_i) / sum(w_i)).quantize(MEAN_QUANTUM, ROUND_HALF_EVEN)
```

`DerivationSourceRead` and `DerivedSource` gain `weight`, which is `null`
except for a weighted mean.

**Alternatives:**

- **A separate weights table.** It adds a join for one number per source row,
  which already exists per source. Rejected.
- **Silently ignore a weight sent with another kind.** The client and server
  would then disagree without anyone noticing. Rejected in favour of
  `weight_invalid`.
- **Weights that must add up to 1 or 100.** This forces the user to normalise
  "3, 1, 1" by hand, and the arithmetic doesn't need it. Rejected.

### 7. The editor keeps weights in its draft

`DerivationDraft.sources` gains `weight: string` (the field's text, as typed,
in the active language's format). `withKind` sets each missing weight to `"1"`
when switching to `weighted_mean`, and drops the weights when switching away.
Adding a source to a weighted mean starts it at `"1"`. Server-side field errors
map onto `derivation.sources[i].weight`, alongside the existing per-source
paths.

## Risks / Trade-offs

- [The detail shows a number that differs from the recorded one, and a reader
  takes the recorded value for wrong] → The section names both numbers and
  says in words that the sources changed after the value was recorded. The
  board's tile keeps showing the recorded value.
- [A source's team has not met yet that week, so opening the section shows
  "missing" for a value that was recorded] → Only possible if the value was
  typed rather than derived. The message is the same as in the recording view,
  so it reads consistently.
- [Removing the comment column's `width: 100%` changes the table's look for
  every board] → Covered by the full-width scenario. The comment field still
  takes the remaining width, so short boards look as before.
- [Two error codes are added to the published API] → They follow the existing
  `derivation_source.*` family and are translated in both catalogues in the same
  change.
- [The grouping is extracted from `Tiles`] → The existing board tests for group
  order and hidden metrics keep running against the shared function.

## Migration Plan

1. The Alembic revision adds `weight` and rewrites both check constraints.
   Existing rows get `weight = NULL`, which is correct, because no existing
   derivation is a weighted mean.
2. The downgrade refuses (raises) while any metric has the kind
   `weighted_mean`. Otherwise it drops the column and restores the old
   constraint. A rollback must not quietly turn a weighted mean into a plain
   mean.
3. No data conversion is needed, and the frontend and backend ship together.
