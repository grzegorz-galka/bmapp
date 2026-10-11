## Why

Every board meeting reviews a **pulse check**: a short survey in which each team member says how the past week felt and why. The agenda of the board that runs today (`samples/Boardmeeting_offline_2026-10-10.html`) lists it as "Badanie satysfakcji członków zespołu", and members are asked to reflect on their own answer before the meeting. BMAPP has meetings and metrics, but nowhere to collect these answers or to show them at the board, so the team still runs the survey outside the application.

## What Changes

- New **pulse answers**. A member of a team answers the pulse check once per meeting of that team, with four questions fixed by the organization:
  1. *How did you feel overall this week?* A rating from 1 (very bad) to 5 (very good). Required.
  2. *What had a positive effect on your week?* Free text.
  3. *What had a negative effect on your week?* Free text.
  4. *What could the team or the leader do to make the next week better?* Free text.

  Answering again replaces the member's answer. Only the member answers for themselves; nobody answers on another's behalf.
- **Answering window.** As for metric values, answers are accepted only at the team's latest meeting dated today or earlier and at its first meeting dated after today. Older meetings are frozen. There is no administrator correction: an answer is a person's own statement, not organizational data.
- **Results of a meeting**, computed when read:
  - how many answered, out of the team's members, and who has not yet answered;
  - the average rating and its colour: green from 4, amber from 3, red below 3;
  - the change in the average since the team's previous meeting with answers;
  - the distribution of ratings 1–5;
  - the trend of the average and of the number of answers over the team's last 16 meetings with answers;
  - every individual answer, by name.
- **Who sees names.** Members of the team and administrators see the individual answers and who has not answered. Anyone else signed in sees the aggregates only. This narrows "anyone signed in may read everything" for this one kind of data.
- **The board page gains a Pulse check view**, beside the metrics, for the meeting shown, laid out as in the sample:
  - three cards: answers received (`7 of 11`, with who is missing), a 1–5 gauge of the average with the change, and the distribution bars;
  - a trend card;
  - the answers table: person, rating, positive, negative, what could be better;
  - a "hide names" switch for sharing the screen, and a form for the viewer's own answer.
- **BREAKING** (to `meetings`, before release): a meeting with pulse answers can no longer be deleted (`meeting.has_pulse_answers`). It can still be moved.

## Capabilities

### New Capabilities

- `pulse-check`: Members' answers to the weekly pulse check at a team's meetings, the answering window, the results of a meeting and their trend, and the pulse check view on the board page.

### Modified Capabilities

- `authorization`: Reading is open to anyone signed in *except* individual pulse answers and who has not answered, which only the team's members and administrators read. Only a member of the team answers its pulse check, and only for themselves. The board offers the answer form only to such a member at a meeting that is open for answers.
- `meetings`: Deleting a meeting is refused once a pulse answer is recorded at it.

## Impact

- **Order**: builds on `add-global-and-copied-metrics`, which is complete and should be archived first. This change does not modify any requirement that change touches.
- **Data**: migration `0006` adds the `pulse_answers` table.
- **API**: `GET /teams/{team_id}/meetings/{meeting_id}/pulse` and `PUT /teams/{team_id}/meetings/{meeting_id}/pulse/me`. Meeting delete gains the `meeting.has_pulse_answers` rejection. Four new error codes, listed in design.md.
- **Frontend**: a Pulse check view on `BoardPage`, the answer form, the gauge and the trend chart (Recharts, already a dependency). New strings and codes in `en.ts` and `pl.ts`.
- **Dependencies**: none.
- **Non-goals**:
  - the pulse average as a metric on the board with its own threshold, which the sample has as a computed metric;
  - turning an answer into a task ("Zadanie" in the sample), since tasks are not built;
  - department or role of a respondent;
  - configurable questions, anonymous answering, reminders;
  - importing the sample's pulse history;
  - the hub showing pulse figures.

  Each is a later change.

## Assumptions

- **The team's members are the expected respondents.** "7 of 11" counts the team's current members. An answer from someone who has since left the team still counts towards the results and is shown, but they are not listed as missing at later meetings.
- **A respondent is shown by email.** Employees carry no name in BMAPP, so the answers table and the missing list show emails, as the members page does.
- **The rating is required; the three texts are optional**, up to 2000 characters each. The sample forces every field, which produced answers such as "nic" ("nothing"); an empty field says the same thing more honestly.
- **An answer cannot be withdrawn**, only changed while the meeting is open for answers. Withdrawal can be added if the team asks for it.
- **The colour bands of a rating are fixed** (4–5 green, 3 amber, 1–2 red) and are not a metric threshold. They are the sample's bands, and a team cannot change them.
- **The previous result is the team's previous meeting with answers**, not simply its previous meeting, as in the sample: a week in which nobody answered should not hide the comparison.
