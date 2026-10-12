## Context

See proposal.md for why. What this builds on:

- `GET /hub` (`app/api/hub.py` → `services/hub.py` → `schemas/hub.py`) already takes a session and the caller's email. The funnel and the assigned items are real. The declarations, the teams (`_TEAMS` seeds and `next_occurrence`), `_PREPARATION` and `_MEETING_IN_SESSION` are constants.
- `app/services/meetings.py` has `today()` (Europe/Warsaw), `propose_next(schedule, taken_dates, today)` and `to_instant`. `BoardDefinition.schedule` is a `WeeklySchedule | None`.
- `app/services/metric_values.py` has `editable_meetings(dates, today)`: the latest meeting dated today or earlier and the first after today. `build_board` computes a meeting's completeness but costs several statements per meeting.
- Active metrics of a board are `board_metrics` rows not retired on the board whose metric is not retired either.
- Pulse answers are keyed by meeting and respondent employee.
- `BoardPage` keeps `?meeting=` and `?view=pulse|archived` in the address. The recording view is a local `listing` toggle, and `PulseView` keeps `results | form` in local state. `ItemLists` renders the problems and tasks sections with heading ids but no anchors.
- Icons today are inline SVG components (`components/flags.tsx`, `PdcaBall.tsx`). There is no icon library.
- The legacy board's *Start* view (`vStart` in the sample) is the source of the declarations and of the hexagon pictograms for the values: an outlined hexagon around a check, a flame, a bulb and two figures.

## Goals / Non-Goals

**Goals:**

- The dashboard summary stays one request with a fixed number of statements, however many teams and meetings the viewer has.
- The dashboard does not compute meeting rules itself. "Editable", "proposed" and "overdue" come from the functions that already decide them for the board and the meetings page, so the two pages cannot disagree.

**Non-Goals:**

- Caching the summary, or pushing updates to it. TanStack Query refetches on focus, which is enough for a page read once a day.
- Making the declarations editable. They remain constants until the targets capability.

## Decisions

### A new `dashboard` capability replaces `hub`

The rename is done as a new spec plus a `hub` delta that removes every requirement, not as `RENAMED` requirements inside `hub`. A capability cannot be renamed through a delta, and almost every requirement changes anyway. Keeping a capability called `hub` that specifies "the dashboard" would leave the old term in the tree, which the glossary rule forbids. At archive, `openspec/specs/hub/` is left with no requirements and is deleted in the same commit.

*Alternative*: keep `hub` as the internal name and change only the label. Rejected by the user in favour of one term everywhere.

### Declarations stay in the API, as constants

The declarations remain in `services/dashboard.py` as `LocalizedText` constants, returned by the summary. The shape becomes:

```
Declarations { mission: Statement, vision: Statement, goals: [LocalizedText], values: [Value] }
Statement    { headline: LocalizedText, body: LocalizedText }
Value        { name: LocalizedText, description: LocalizedText, icon: "effectiveness" | "passion" | "innovation" | "collaboration" }
```

The legacy text uses `<em>` and `<b>` for emphasis. It is carried as plain text: no markup in the API, no `dangerouslySetInnerHTML` in the page. The headline is what carried the emphasis, and it gets its own typographic weight.

*Alternative*: move the declarations into the i18n catalogues and drop them from the summary. Rejected. They are company data that the targets capability will make editable, and the summary is already where that capability will plug in. Catalogues hold interface text.

*Alternative*: a configurable file with invented defaults, keeping the real text out of the public demo. The user chose to commit the real text instead (proposal, *Assumptions*).

### The summary's shape

```
DashboardSummary {
  current_user, declarations,
  teams:    [ DashboardTeam { id, name, initials, role, schedule: {weekday, start_time} | null,
                              next_meeting_at: instant | null } ],          -- soonest first, none last by name
  meetings: [ DashboardMeeting { team_id, team, meeting_id: uuid | null,   -- null = proposed, not opened
                                 date, start_time, starts_at, today: bool,
                                 host: email | null, recorded: int | null, total: int | null,
                                 pulse_answered: bool } ],                 -- by starts_at
  funnel, assigned_items: [ ... as now, + metric: {id, name} | null, problem: {id, summary} | null ]
}
```

`today` is decided on the server, on the Europe/Warsaw calendar, for the same reason `overdue` is: a browser in another time zone must not disagree with the board about which meeting is today's. `date` and `start_time` are the meeting's wall-clock values, so the row needs no time-zone arithmetic in the browser to send them back when opening a proposed meeting. `recorded`/`total` are null for a proposed row rather than `0/n`, because nothing can be recorded at a meeting that does not exist.

### Computing it in a fixed number of statements

1. The viewer's teams, with role and board schedule: one join of `team_members`, `employees`, `teams` and `board_definitions`.
2. Those teams' meetings dated today or later, with host email: one statement. This is enough for both lists:
   - rows: per team, the meeting dated today (if any) and the earliest after today. These are exactly `editable_meetings(...) ∩ {date ≥ today}`. The function is called on the team's dates so the rule stays in one place. Feeding it only dates ≥ today does not change that intersection, because the latest meeting ≤ today is in the set only if it is today's.
   - a team with no such meeting gets `propose_next(schedule, taken_dates, today)` as a proposed row. Taken dates before today cannot affect a proposal dated on or after today.
   - a team's `next_meeting_at` is its earliest opened meeting dated today or later, otherwise the proposal's instant, otherwise null.
3. Active placements per team: one grouped count.
4. Values recorded per listed meeting, counting only active placements: one grouped count joining `metric_values` to `board_metrics` on team and metric.
5. The viewer's pulse answers among the listed meetings: one statement.
6. Funnel and assigned items as now, the latter outer-joined to `metrics` and to the task's `problems`.

`build_board` is not reused for completeness. It would cost about five statements per row, and it computes tiles and sparklines that are then thrown away. The count it reports (active placements with a value at the meeting) is restated as the two grouped counts above. An integration test asserts that the dashboard's `recorded`/`total` equal `build_board(...).completeness` for the same meeting, so the two cannot drift.

### Opening a proposed meeting from the browser

An action on a proposed row calls the existing `POST /teams/{team_id}/meetings` with the row's `date` and `start_time`, then navigates using the returned id. There is no new endpoint and no new permission. The viewer is a member of every team listed, and members open meetings. On a rejection the error's `code` is translated through the existing field-error catalogue and shown on the row, and the dashboard query is invalidated. In the race case (`meeting_date.taken`) the refetch then shows the opened meeting in place of the proposal.

*Alternative*: the dashboard summary opens the proposal itself. Rejected, because a read must not write (*The summary changes nothing*), and an unwanted meeting would block a later move of the date only by existing.

### Addresses on the board

| Target | Address |
|---|---|
| Recording view | `/teams/:id?meeting=:mid&mode=record` |
| Pulse answer form | `/teams/:id?meeting=:mid&view=pulse&mode=answer` |
| Problems list | `/teams/:id#problems` |
| Tasks list | `/teams/:id#tasks` |
| Archive | `/teams/:id?view=archived` |

`mode` replaces the two local toggles, so the toggles write the address and a reload keeps them. An unknown or inapplicable `mode` is ignored: a frozen meeting shows the recording view read-only as today, and a form request without the right to answer shows the results. Lists use a fragment rather than a query parameter, because they are a place on the page, not a state of it. `BoardPage` scrolls the matching section (`id="problems"` / `id="tasks"` on the existing sections) into view once the lists have rendered.

### Icons are an inline SVG module, not a library

`frontend/src/components/icons.tsx` exports one component per glyph: calendar, people, funnel, clipboard (prepare), pulse (pulse check), play (start), problem, task, archive, target (mission), eye (vision), flag (goals), and the four value pictograms in a hexagon. Each is `aria-hidden`, `focusable="false"` and drawn in `currentColor`, so it inherits the caption's contrast that `contrast.test.ts` already holds. The value pictograms reuse the paths of the legacy board's `HEX` drawings, redrawn to the theme tokens instead of the legacy gold.

*Alternative*: `lucide-react`. Rejected for now. About fifteen glyphs are a hundred-odd lines, the pattern already exists (`flags.tsx`), and CLAUDE.md admits a dependency only when it removes meaningful code. Revisit if the icon count grows past a few dozen.

### Polish wording

| English | Polish |
|---|---|
| Dashboard | Pulpit |
| My board meetings | Moje spotkania |
| My teams' problems and tasks | Problemy i zadania moich zespołów |
| Prepare data | Przygotuj dane |
| Fill pulse check | Wypełnij Pulse Check |
| Start meeting | Rozpocznij spotkanie |
| not yet opened | jeszcze nieotwarte |

These follow the glossary of `add-i18n-en-pl` (Spotkanie, Problem, Zadanie, and Pulse check kept in Polish). CLAUDE.md's glossary gains *Dashboard (Pulpit)* in place of *Hub*.

### Renaming without losing history

Files move with `git mv`: `api|schemas|services/hub.py` → `dashboard.py`, `features/hub/` → `features/dashboard/`, `api/hub.ts` → `api/dashboard.ts`. Test files are renamed after their new requirement names. The i18n keys `hub.*` become `dashboard.*`, `nav.hub` becomes `nav.dashboard`, `funnel.*` and `assigned*` move under `itemsTile.*`, and `tiles.*` is deleted. Because `pl.ts` is typed against `en.ts`, a key left behind on one side fails `tsc`.

## Risks / Trade-offs

- [The real declarations, including revenue and headcount targets, appear on the public Railway demo] → The user confirmed this. Recorded in the proposal's assumptions. If that changes, the constants are one file to replace.
- [The legacy text loses its emphasis] → Accepted. The headline/body split keeps the hierarchy.
- [A proposed row's action writes data from the landing page] → It is the same request, with the same permission and the same error code, as the meetings page. A meeting opened by mistake can be deleted there while it has no values.
- [`recorded/total` and the board's completeness could drift] → The equality test described above.
- [Scrolling to `#tasks` before the lists load does nothing] → The scroll runs on the lists' render, not on mount. Covered by a Vitest test with delayed data.
- [Archiving order: this change's `hub` removals name `add-problems-and-tasks`' version of the requirements] → Task 1.1 makes archiving that change a precondition.

## The declarations

Polish is the legacy board's text without its markup. English is a translation for this change, to be confirmed in review.

| | Polish | English |
|---|---|---|
| Mission, headline | Jesteśmy po to, aby zmieniać energetykę na lepsze | We are here to change the energy sector for the better |
| Mission, body | Transformacja energetyczna to jedno z największych wyzwań polskiej gospodarki, a jej powodzenie zależy od jakości rozwiązań, którymi posługuje się operator systemu. Wspieramy PSE w roli strażnika i architekta, dostarczając rozwiązania i usługi, które realnie zmieniają sposób pracy KSE. Każdy nasz projekt ma czynić energetykę bezpieczniejszą, sprawniejszą i gotową na bezemisyjną przyszłość. | The energy transition is one of the greatest challenges facing the Polish economy, and its success depends on the quality of the solutions the system operator works with. We support PSE in its role as guardian and architect, delivering solutions and services that genuinely change how the national power system works. Every project of ours is meant to make the energy sector safer, more efficient and ready for a zero-emission future. |
| Vision, headline | Chcemy tworzyć najlepsze rozwiązania w branży | We want to create the best solutions in the industry |
| Vision, body | Najlepsze rozwiązania i usługi, czyli takie, które klient poleca dalej: dostarczone na czas, w pełnym zakresie i o jakości potwierdzonej satysfakcją użytkowników. Punktem odniesienia jest dla nas jakość. | The best solutions and services are the ones a client recommends to others: delivered on time, in full, and with a quality confirmed by the satisfaction of their users. Quality is our point of reference. |
| Goal 1 | Wzrost – 174 mln zł przychodu w 2026 r. przy zatrudnieniu 397 osób | Growth – PLN 174 million in revenue in 2026 with a headcount of 397 |
| Goal 2 | Zdolność do adaptacji – NPS klienta: pierwszy pomiar z wynikiem dodatnim | Adaptability – client NPS: a first measurement with a positive score |
| Goal 3 | Satysfakcja pracowników – eNPS 35+ do 2030 r. | Employee satisfaction – eNPS of 35+ by 2030 |
| Value `effectiveness` | **Skuteczność** – Dowozimy to, do czego się zobowiązaliśmy – na czas i w pełnym zakresie. Rozliczamy się z rezultatów, nie z aktywności. | **Effectiveness** – We deliver what we committed to – on time and in full. We answer for results, not for activity. |
| Value `passion` | **Pasja** – Energetyka to dla nas coś więcej niż projekty – angażujemy się, bo wierzymy w sens transformacji. Pasja napędza jakość, której nie da się wymusić procedurą. | **Passion** – For us the energy sector is more than projects – we commit because we believe in the purpose of the transition. Passion drives a quality no procedure can enforce. |
| Value `innovation` | **Innowacyjność** – Szukamy lepszych rozwiązań, zanim ktoś o nie poprosi – od nowych technologii po usprawnienia codziennej pracy. Odwaga eksperymentowania idzie u nas w parze z odpowiedzialnością za wynik. | **Innovation** – We look for better solutions before anyone asks for them – from new technologies to improvements in everyday work. The courage to experiment goes hand in hand with responsibility for the result. |
| Value `collaboration` | **Współdziałanie** – Najlepsze rozwiązania powstają na styku kompetencji – naszych zespołów, PSE i partnerów. Gramy do jednej bramki: sukces mierzymy wynikiem całości, nie części. | **Collaboration** – The best solutions arise where competences meet – those of our teams, of PSE and of our partners. We all play for the same goal: we measure success by the result of the whole, not of its parts. |

## Migration Plan

No data migration. API and frontend ship together in one image, and `GET /hub` is removed rather than kept as an alias, because the frontend is its only client. Rollback is a redeploy of the previous image.
