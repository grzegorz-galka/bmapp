## Purpose

Collects each team member's answers to the weekly pulse check at the team's meetings, and presents the results of a meeting — the average, the distribution, the trend and the individual answers — on the board.

## ADDED Requirements

### Requirement: Answer the pulse check at a meeting

The system SHALL allow a member of a team to record their own answer at a meeting of that team: a rating from 1 to 5 and three optional texts — what had a positive effect on the week, what had a negative one, and what the team or the leader could do better. A member SHALL have at most one answer per meeting; answering again SHALL replace it. The answer SHALL carry its respondent and when it was last changed.

#### Scenario: A member answers

- **WHEN** a member records the rating 4, the positive text "Release went out" and leaves the other two texts empty, at a meeting of their team
- **THEN** the answer is returned with the rating 4, that positive text, empty negative and better texts, the member as respondent, and the time it was recorded

#### Scenario: An answer is replaced

- **WHEN** a member who has answered at a meeting answers again with the rating 2
- **THEN** that member has one answer at that meeting, carrying the rating 2

#### Scenario: Each member answers for themselves

- **WHEN** two members of a team each answer at the same meeting
- **THEN** the meeting holds two answers, one per member, and neither replaced the other

#### Scenario: A rating out of range

- **WHEN** an answer is recorded with a missing rating, or a rating of 0, 6 or 3.5
- **THEN** it is rejected with `pulse_rating.out_of_range` against `rating`, and nothing is recorded

#### Scenario: A text that is too long

- **WHEN** an answer is recorded with one of its texts longer than 2000 characters
- **THEN** it is rejected with `pulse_text.too_long` against that text's field, and nothing is recorded

#### Scenario: Blank texts are stored as empty

- **WHEN** an answer is recorded with a text made only of spaces
- **THEN** that text is returned as empty

#### Scenario: The meeting belongs to another team

- **WHEN** an answer is recorded under one team at a meeting of another team
- **THEN** it is rejected with `meeting.not_found` and HTTP 404

### Requirement: Only the latest held and the next meeting take answers

The system SHALL accept answers only at a team's latest meeting dated today or earlier and at its first meeting dated after today, in Europe/Warsaw — the same meetings at which metric values can be edited. An answer at any other meeting SHALL be rejected with `pulse_answer.meeting_frozen` and HTTP 409, for every caller including an administrator.

#### Scenario: Answering before the meeting

- **WHEN** today is Monday, the team's next meeting is on Wednesday and its last was the previous Wednesday
- **THEN** a member can answer at both of those meetings

#### Scenario: An older meeting is frozen

- **WHEN** a member answers at a meeting earlier than the team's latest meeting dated today or earlier
- **THEN** it is rejected with `pulse_answer.meeting_frozen` and HTTP 409, and any earlier answer is unchanged

#### Scenario: A meeting further ahead is not yet open

- **WHEN** a member answers at the team's second meeting after today
- **THEN** it is rejected with `pulse_answer.meeting_frozen`

### Requirement: The results of a meeting

The system SHALL return, for a meeting, the number of answers, the number of the team's current members, the average rating and its status, the change in the average since the team's previous meeting with answers, the count of answers for each rating 1–5, and whether the meeting takes answers. The average and the change SHALL be exact to two decimal places.

#### Scenario: Results are summarised

- **WHEN** a team of 11 members has 7 answers at a meeting, rated 5, 4, 4, 4, 3, 3 and 2
- **THEN** the results report 7 answers of 11, an average of 3.57, and a distribution of one 5, three 4s, two 3s, one 2 and no 1

#### Scenario: The change since the previous meeting with answers

- **WHEN** a meeting's average is 3.57, nobody answered at the team's previous meeting, and the meeting before that averaged 3.80
- **THEN** the change is −0.23 against that earlier meeting, which is named by its date

#### Scenario: No earlier answers

- **WHEN** a meeting has answers and no earlier meeting of the team has any
- **THEN** no change is reported

#### Scenario: Nobody has answered yet

- **WHEN** the results of a meeting with no answers are requested
- **THEN** they report 0 answers, no average, the status no data, and a distribution of zeros

### Requirement: The colour of a rating

The system SHALL give an average or an individual rating the status green when it is 4 or more, amber when it is 3 or more and below 4, and red when it is below 3, judged on the exact average rather than a rounded one. These bands SHALL be the same for every team and SHALL NOT come from any metric threshold.

#### Scenario: An average on a boundary

- **WHEN** a meeting's answers average exactly 4.00
- **THEN** the status is green

#### Scenario: An average just below a boundary

- **WHEN** a meeting's answers are rated 3, 3 and 2, an average of 2.67
- **THEN** the status is red

#### Scenario: Individual ratings are coloured

- **WHEN** the individual answers rated 5, 3 and 2 are returned
- **THEN** their statuses are green, amber and red respectively

### Requirement: The individual answers of a meeting

The system SHALL return with a meeting's results, to a viewer the `authorization` capability permits to read them, every answer at that meeting, each with its respondent's identifier and email, its rating, the rating's status and its three texts, ordered by the respondent's email, together with the team's current members who have not answered. An answer from someone who has since left the team SHALL still be returned.

#### Scenario: Answers and the missing members are listed

- **WHEN** a team of 3 members has answers from two of them at a meeting
- **THEN** both answers are returned with their respondents, ordered by email, and the third member is listed as not having answered

#### Scenario: A former member's answer stays

- **WHEN** a member who answered at a meeting is later removed from the team
- **THEN** their answer is still returned with that meeting's results and counted in its average, and they are not listed as missing

### Requirement: The viewer's own answer

The system SHALL return with a meeting's results the viewer's own answer at that meeting, if they have one.

#### Scenario: A member sees their own answer

- **WHEN** a member who has answered at a meeting requests its results
- **THEN** the results include that member's answer as their own

### Requirement: The trend of the pulse check

The system SHALL return with a meeting's results the average and the number of answers at each of the team's last 16 meetings with answers, up to and including that meeting, in date order.

#### Scenario: Meetings without answers leave no point

- **WHEN** a team answered at three meetings and skipped answering at a fourth between them
- **THEN** the trend has three points, one per meeting with answers, each with its date, average and number of answers

#### Scenario: The trend stops at the meeting shown

- **WHEN** the results of an older meeting are requested
- **THEN** the trend holds no meeting after it

### Requirement: The pulse check view

The system SHALL present, on a team's board and for the meeting it shows, a pulse check view beside the metrics, reachable at its own address. It SHALL show cards for the answers received with who is missing, the average on a 1–5 gauge with its change, and the distribution; a trend chart of the average with the number of answers; and a table of the answers. All its text SHALL be in the active language.

#### Scenario: The results are shown as cards, a trend and a table

- **WHEN** a member opens the pulse check view of a meeting with 7 answers out of 11
- **THEN** it shows "7 of 11" with the four missing members, the average on the gauge with its change, the five distribution bars, the trend, and one table row per answer

#### Scenario: The view has its own address

- **WHEN** the pulse check view of a meeting is opened and the address is reloaded
- **THEN** the board opens again on the pulse check view of that meeting

#### Scenario: The view's entry shows how many have answered

- **WHEN** the board of a meeting with 7 answers from a team of 11 is opened on its metrics
- **THEN** the way to the pulse check view reads that 7 of 11 have answered

#### Scenario: Colour is never the only signal

- **WHEN** the average or an answer's rating is shown in green, amber or red
- **THEN** the rating is also given as a number and in words, from "very bad" for 1 to "very good" for 5

#### Scenario: Nobody has answered yet

- **WHEN** the pulse check view of a meeting with no answers is opened by a member while it takes answers
- **THEN** the view says that nobody has answered yet and offers the member to answer first

#### Scenario: The average is shown in the active language's format

- **WHEN** an average of 3.57 is shown while the interface is in Polish
- **THEN** the gauge shows `3,6`

### Requirement: Names can be hidden for screen sharing

The system SHALL offer, in the pulse check view, a switch that hides who answered. While it is on, the answers SHALL be labelled "Person 1", "Person 2" and so on, and the missing members SHALL be reported only as a number. The switch SHALL change only the viewer's own screen.

#### Scenario: Names are hidden

- **WHEN** a member turns on hiding names in a pulse check view with 7 answers and 4 missing members
- **THEN** the table labels the answers Person 1 to Person 7, and the card reads that 4 answers are missing without naming anyone

### Requirement: The answer form

The system SHALL present, for a meeting that takes answers, a form for the viewer's own answer: the four questions, the rating as a choice of five labelled options, and the three texts. It SHALL be filled with the viewer's existing answer when there is one, and saving SHALL show the updated results.

#### Scenario: A member answers through the form

- **WHEN** a member opens the form for the coming meeting, chooses "4 – good", fills in the positive text and saves
- **THEN** the answer is recorded, and the results count the member's answer

#### Scenario: The form shows an existing answer for changing

- **WHEN** a member who has answered at a meeting opens the form again
- **THEN** the form holds their rating and texts, and saving replaces their answer

#### Scenario: A frozen meeting has no form

- **WHEN** the pulse check view of a frozen meeting is opened by a member
- **THEN** the results are shown and no answer form is offered
