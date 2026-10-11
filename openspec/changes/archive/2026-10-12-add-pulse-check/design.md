## Context

See proposal.md for why. What this builds on:

- `meetings` and `metric-values`: a meeting belongs to a team, has a date on the Europe/Warsaw clock, and `editable_meetings(meeting_dates, today)` in `app/services/metric_values.py` already decides which meetings are open (the latest held and the next).
- `team_members` records membership and leadership; `relationship_to(session, user, team_id)` in `app/api/dependencies.py` reads it, and the pure functions in `app/services/authz.py` decide.
- Employees carry only an email; there is no display name anywhere in the model.
- `BoardPage` at `/teams/:teamId` keeps the meeting shown in the `?meeting=` search parameter, and toggles tiles and the recording view inside `BoardBody`. Recharts draws the sparklines and the metric detail.
- The sample (`samples/Boardmeeting_offline_2026-10-10.html`, function `vPulse` and the `.pc-*` styles) is the agreed layout: a toolbar with *Results* / *Fill in* and *hide names*; a three-column row of cards `minmax(0,.8fr) minmax(0,1fr) minmax(0,1.1fr)` that stacks below 900px; a trend card; the answers table.

## Goals / Non-Goals

**Goals:**

- The results are computed when read, from the answers alone, by one pure function, so the API, the view and a later "pulse as a metric" change all agree.
- Who may see names is decided on the server. A response to a stranger has no names to hide; the frontend's hide-names switch is only for sharing a screen.

**Non-Goals:**

- Caching results. A team has about 10 answers per meeting and the trend reads at most 16 meetings.
- A generic survey engine. The four questions are columns, not rows of a question table.

## Decisions

### One table, one row per member per meeting

`pulse_answers(id uuid, meeting_id → meetings ON DELETE RESTRICT, employee_id → employees ON DELETE RESTRICT, rating smallint CHECK (rating BETWEEN 1 AND 5), positive text, negative text, better text, created_at, updated_at)`, `UNIQUE (meeting_id, employee_id)`, texts `NOT NULL DEFAULT ''` with `CHECK (char_length(x) <= 2000)`. Migration `0006_add_pulse_answers.py`.

- The respondent is the employee, not an email column, because a member always has an employee record and the missing list is computed from `team_members` by `employee_id`.
- `RESTRICT` on the meeting backs up `meeting.has_pulse_answers`, as the metric values' foreign key backs up `meeting.has_values`.
- Recording is an upsert on the unique pair (`INSERT … ON CONFLICT (meeting_id, employee_id) DO UPDATE`), so two tabs saving at once cannot create two answers.

Alternatives considered:

- **A JSON document per meeting**, as the sample stores it. That makes the unique-per-member rule and the foreign keys impossible to enforce in the database.
- **Questions as rows** (`pulse_questions`, `pulse_responses`). It would allow configurable questions, which nobody asked for, at the cost of a pivot on every read.

### The API: one read, one write of one's own answer

| Method | Path | Body / result | Guard |
|---|---|---|---|
| `GET` | `/teams/{team_id}/meetings/{meeting_id}/pulse` | `PulseResults` | signed in |
| `PUT` | `/teams/{team_id}/meetings/{meeting_id}/pulse/me` | `PulseAnswerWrite` → `PulseAnswerRead` | member of the team |

`/pulse/me` rather than `/pulse/{employee_id}`: the respondent is always the caller, so the path cannot name anyone else and there is no "answering for someone" case to refuse.

`PulseResults`:

```
meeting_id, editable: bool
answered: int, members: int
average: str | null           # Decimal, 2 places, as a string like every number in the API
status: green | amber | red | no_data
previous: {meeting_id, date, average} | null
change: str | null
distribution: {"1": int, …, "5": int}
trend: [{meeting_id, date, average, status, answered}]    # ≤ 16, date order, ends at this meeting
answers: [PulseAnswerRead] | null                 # null when the viewer may not read names
missing: [{employee_id, email}] | null            # idem
missing_count: int                                # always present, for the hidden-names card
own: PulseAnswerRead | null                       # the caller's answer, when they have one
```

`PulseAnswerRead`: `employee_id, email, rating, status, positive, negative, better, updated_at`.

`null` rather than an absent key or `[]`, so the frontend can tell "you may not see this" from "nobody answered". The stranger case is still a 200: a refusal for the names must not become a refusal for the results.

### The results are a pure function

`app/services/pulse_check.py` holds `summarise(ratings: list[int]) -> Summary` (count, exact average as `Decimal`, distribution) and `mood_status(average: Decimal | None) -> Status`, with no I/O. The service loads the meeting's answers, the team's members, and the averages of earlier meetings in two queries — the answers of the team's last 16 meetings with answers up to this one, grouped by meeting with `avg`/`count` in SQL — then calls them.

- The status is decided on the exact average and the value is rounded to two places with `ROUND_HALF_UP` only when serialised. So 3.995 (only possible with 200 answers) is amber even though it prints as 4.00; the gauge shows one decimal anyway.
- The status reuses `Status` from `app/core/metric_enums.py` (`green`, `amber`, `red`, `no_data`), so the frontend's existing status badge and tokens render it. `no_threshold` never occurs here. The bands are constants in the module, not a threshold row: CLAUDE.md keeps colours coming from a metric's threshold, and the pulse check is not a metric. A later change that turns it into one will give it a real threshold.
- "Previous" is the latest meeting before this one, of the same team, with at least one answer — the second-to-last point of the trend when this meeting has answers. It is computed even when this meeting has none, but `change` is then null.

### Membership decides both reading names and answering

Two new pure functions in `authz.py`:

- `may_read_pulse_answers(*, is_admin, relationship) -> bool`: admin, leader or member.
- `may_answer_the_pulse_check(*, relationship) -> bool`: leader or member. **Not** an administrator: unlike every other write, this is not something the organization does on a team's behalf. It takes no `is_admin` argument, so the permission-table unit test shows the difference.

The router reads `relationship_to` once and passes `may_read` into the service, which leaves `answers`, `missing` and `own` as null rather than building and then dropping them. The window check comes after the permission check, as for metric values: a stranger gets `auth.forbidden`, not `pulse_answer.meeting_frozen`.

Membership is checked when answering, not when reading the answer back: someone who leaves keeps their answers (`RESTRICT` on `employee_id`, as for a meeting's host).

### Error codes

| Code | HTTP | Field | Where |
|---|---|---|---|
| `pulse_rating.out_of_range` | 422 | `rating` | `PydanticCustomError` in `PulseAnswerWrite`; a strict `int` so 3.5 and `"4"` are refused |
| `pulse_text.too_long` | 422 | `positive` / `negative` / `better` | `PydanticCustomError`, after trimming |
| `pulse_answer.meeting_frozen` | 409 | — | `PulseAnswerMeetingFrozenError(DomainError)` |
| `meeting.has_pulse_answers` | 409 | — | `MeetingHasPulseAnswersError(DomainError)`, from `delete_meeting` |

`meeting.not_found`, `team.not_found` and `auth.forbidden` are reused. Texts are trimmed, and blank becomes `''`.

### The view: a second mode of the board, kept in the address

`BoardPage` gains a segmented switch *Metrics* / *Pulse check (7/11)* above `BoardBody`, stored as `?view=pulse` next to `?meeting=`, so reloading, the browser's back button and a shared link land on the same view. The meeting navigator stays shared; moving between meetings keeps the view.

The badge's `7/11` comes from the pulse results query, which the board fetches for the meeting shown whichever view is open. It is one small request and saves a second count field on `MeetingBoard`.

A new `features/board/pulse/` folder holds:

- `PulseView.tsx` — the toolbar (*Results* / *Your answer*, hide names), then the results or the form;
- `PulseCards.tsx` — the three cards: `answered of members` with the missing list, the gauge with the change ("▲ +0,2 vs 1 Oct"), the distribution bars;
- `PulseGauge.tsx` — the sample's 180° arc as inline SVG, about 20 lines, coloured by `status` through the existing `--status-*` tokens; Recharts' `RadialBarChart` would need more code to look the same;
- `PulseTrend.tsx` — a Recharts `ComposedChart`: `Bar` for the number of answers on a right axis, `Line` for the average on a 1–5 axis, a `ReferenceArea` from 4 to 5 for the green zone, points coloured by status;
- `PulseAnswers.tsx` — the table; with names hidden, "Person 1…n" in the API's email order and no missing names;
- `PulseForm.tsx` — five radio options "5 – very good" … "1 – very bad", and three textareas, pre-filled from `own`;
- `usePulse.ts` — the query and the mutation, which invalidates the results on success;
- `pulse.module.css` — the `.pc-*` layout from the sample, rebuilt on the theme tokens.

*Hide names* is React state in `PulseView`: it is about the screen right now, not a preference to remember.

The *Your answer* mode is offered only when `editable` and the viewer is a member, read from the team's members as `BoardPage` already does for recording. A frozen meeting with the viewer's own answer shows it read-only in the table, like everyone else's.

### Strings

New keys under `pulse.*` in `en.ts` and `pl.ts`, including the four question texts, the five rating words and the four error codes. The Polish texts follow the sample's wording, adjusted to address the respondent neutrally rather than as "czułeś/czułaś":

| | English | Polish |
|---|---|---|
| view | Pulse check | Pulse check |
| Q1 | How did you feel overall this week? | Jak ogólnie oceniasz ten tydzień? |
| Q2 | What had a positive effect on your week? | Co wpłynęło pozytywnie na Twój tydzień? |
| Q3 | What had a negative effect on your week? | Co wpłynęło negatywnie na Twój tydzień? |
| Q4 | What could the team or the leader do to make next week better? | Co zespół lub lider może zrobić, by kolejny tydzień był lepszy? |
| 5…1 | Very good, Good, Neutral, Rather bad, Very bad | Bardzo dobrze, Dobrze, Neutralnie, Raczej źle, Bardzo źle |

"Pulse check" stays in English in the Polish interface, as the team uses it in the sample; it is added to the glossary in `add-i18n-en-pl`'s sense when CLAUDE.md is updated.

## Risks / Trade-offs

- [Small teams can be de-anonymised from the aggregates: a team of three with ratings 5, 5, 1 is readable to a stranger] → Accepted: the answers are not anonymous inside the team either, and the aggregates are what the board shows on a shared screen anyway. Anonymity is a non-goal.
- [Strangers learn who is on the team and how many answered] → They already read the team's members; `missing_count` adds nothing personal.
- [A member removed between answering and the meeting disappears from "of 11" while their answer still counts, so 8 of 7 is possible] → Rare; the card shows the numbers as they are, and the spec's former-member scenario pins the behaviour.
- [The badge request runs on every board load] → One indexed query over at most one meeting's answers, plus the 16-meeting trend; cheap at this scale. If it is not, add the counts to `MeetingBoard`.
- [No administrator correction, so an answer recorded against the wrong meeting stays once the meeting freezes] → It can be changed while the window is open, which covers the day after; the pulse is a mood, not a figure the organization reports.

## Migration Plan

`0006` only creates a table and its constraints; downgrade drops it. No data is backfilled. Deploy as usual: `alembic upgrade head`, then the backend and frontend. Rolling back the code without the migration is safe, since nothing else reads the table.

## Open Questions

- Should the pulse check also appear in the recording view's completeness ("12 of 14 recorded, 7 of 11 answered")? Not needed for the meeting itself; can be added without changing this design.
