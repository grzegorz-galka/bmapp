# Spec Delta

## Purpose

Lets a board's metric be worked out from other metrics recorded in the same week, on the same team or on others, as a mean, a sum or a change since the previous meeting, and fills that number into the recording view on request.

## ADDED Requirements

### Requirement: Define a metric's derivation

The system SHALL allow whoever configures a board to give one of its own metrics a derivation, when it is added or later, and to change or remove it. A derivation is a kind, `mean`, `sum` or `delta`, and an ordered list of sources, each a metric on a named team's board. `mean` and `sum` take one or more sources and `delta` exactly one. A metric SHALL be returned with its derivation, each source carrying its team's and metric's identifiers and names.

#### Scenario: A mean of six metrics

- **WHEN** a leader gives the board's metric "OTIF E" the kind `mean` with the six sources "OTIF E: BPW" … "OTIF E: CKI-S" on the same board
- **THEN** "OTIF E" is returned with that kind and those six sources in that order, each with its team and metric names

#### Scenario: A value taken from another team

- **WHEN** a leader gives the metric "OTIF E: CKI-P" the kind `mean` with the single source "OTIF-Etap" on the board of the team "CKI-P"
- **THEN** it is returned with that derivation

#### Scenario: A metric added with a derivation

- **WHEN** a leader creates the metric "Zatrudnienie delta" with the kind `delta` and the source "Zatrudnienie" on the same board
- **THEN** it is returned with that derivation

#### Scenario: A derivation is removed

- **WHEN** a leader removes a metric's derivation
- **THEN** the metric is returned with none, and its recorded values are unchanged

#### Scenario: A derivation is changed

- **WHEN** a leader changes a metric's derivation from `sum` to `mean`
- **THEN** it is returned with `mean`, and its recorded values are unchanged

#### Scenario: Wrong number of sources

- **WHEN** a derivation of the kind `delta` is given two sources, or one of the kind `mean` or `sum` is given none
- **THEN** it is rejected with `derivation.source_count` against `derivation.sources`, and the metric is unchanged

#### Scenario: A source that is not on the named board

- **WHEN** a source names a metric that is not on the named team's board, or a team that does not exist
- **THEN** it is rejected with `derivation_source.not_found` against that source, and the metric is unchanged

#### Scenario: A metric as its own source

- **WHEN** a metric's derivation names the metric itself on its own board as a source
- **THEN** it is rejected with `derivation_source.self` against that source

#### Scenario: The same source twice

- **WHEN** a derivation names the same metric on the same team twice
- **THEN** it is rejected with `derivation_source.duplicate` against the second

#### Scenario: Only whoever configures the board sets a derivation

- **WHEN** a member who may not configure the board sets a derivation on one of its metrics
- **THEN** it is refused as any other change to the board's metrics is, and the metric is unchanged

### Requirement: Only a board's own metric is derived

The system SHALL NOT give a global metric a derivation, through a board or the catalogue. A global metric MAY be a source of a board's own metric. A request giving an included global metric a derivation through a board SHALL be rejected with `global_metric.read_only`.

#### Scenario: A global metric is not derived

- **WHEN** a leader gives an included global metric a derivation through their board
- **THEN** it is rejected with `global_metric.read_only` and HTTP 409, and nothing changes

#### Scenario: A global metric as a source

- **WHEN** a leader names a global metric included in the board of the team "CKI-P" as the source of their own metric
- **THEN** the derivation is accepted, and the source reads that global metric's values recorded at CKI-P's meetings

### Requirement: The meeting a source is read at

The system SHALL read a source at its team's meeting in the same ISO week, in Europe/Warsaw, as the meeting being recorded. For a source on the same team, that is the meeting being recorded. For another team with several meetings that week, it is the latest. For a `delta`, the earlier number is from the source team's meeting immediately before that one.

#### Scenario: Another team met earlier in the week

- **WHEN** a value is derived for Zarząd's meeting on Wednesday 2026-10-14 from a source on CKI-P, which met on Tuesday 2026-10-13
- **THEN** the source is read at CKI-P's meeting of 2026-10-13

#### Scenario: Another team met later in the week

- **WHEN** a value is derived for a meeting on Monday from a source on a team that meets on Thursday of the same week
- **THEN** the source is read at that Thursday meeting, if it has a number

#### Scenario: Another team met twice that week

- **WHEN** a source's team has meetings on Monday and Thursday of the week
- **THEN** the source is read at the Thursday meeting

#### Scenario: A source on the same team

- **WHEN** a value is derived for a meeting from a source on the same board
- **THEN** the source is read at that same meeting

#### Scenario: The previous meeting for a delta

- **WHEN** a `delta` is derived from a source whose team met on 2026-10-13 that week, and before that on 2026-09-29, skipping a week
- **THEN** the earlier number is the one recorded at the meeting of 2026-09-29

### Requirement: Derive a value

The system SHALL return, for a derived metric at a meeting, the number its derivation gives from the numbers recorded, together with each source's team, metric, meeting date and number, and for a `delta` the previous meeting's date and number. A mean SHALL be kept to 6 decimal places, rounding half to even. Deriving SHALL record nothing.

#### Scenario: The mean of six units

- **WHEN** "OTIF E" is derived at a meeting where its six sources have the numbers 90, 97, 87, 83, 105 and 101
- **THEN** the number returned is 93.833333, with each source's number and meeting date, and no value is recorded

#### Scenario: A sum

- **WHEN** a `sum` of two sources is derived where they have the numbers 12.5 and 7
- **THEN** the number returned is 19.5

#### Scenario: A delta

- **WHEN** a `delta` is derived where its source has 391 at the meeting and 395 at the team's previous meeting
- **THEN** the number returned is −4, with both numbers and both meeting dates

#### Scenario: A source has no number

- **WHEN** one source's team has a meeting that week with no number for it, or no meeting that week at all
- **THEN** deriving is refused with `derivation.source_missing` against that source, one entry per missing source, and nothing is returned or recorded

#### Scenario: The previous number is missing

- **WHEN** a `delta`'s source has a number at the meeting, but its team's previous meeting has none, or there is no previous meeting
- **THEN** deriving is refused with `derivation.previous_missing`, even if an earlier meeting has a number

#### Scenario: A metric with no derivation

- **WHEN** a value is derived for a metric with no derivation
- **THEN** it is rejected with `derivation.none` and HTTP 404

#### Scenario: Anyone signed in may derive

- **WHEN** a signed-in employee who is not a member of the team derives a value
- **THEN** the number is returned, as any reading of the board's data is

### Requirement: A derived value is an ordinary value

The system SHALL treat a value recorded for a derived metric as any other value of its meeting. Changing a source's number, or the derivation, later SHALL NOT change it. It SHALL be recorded, frozen, corrected, judged and counted in completeness exactly as a typed number is.

#### Scenario: A source is corrected after the value was recorded

- **WHEN** "OTIF E" was recorded as 93.833333, and one of its sources is then corrected
- **THEN** "OTIF E" is still 93.833333 at that meeting until someone records it again

#### Scenario: A derived metric still counts as missing

- **WHEN** a derived metric has no number at a meeting
- **THEN** the meeting's completeness lists it as missing, as any metric without a number

### Requirement: A source cannot be taken away

The system SHALL refuse to delete a metric, or to remove a global metric from a board, while it is a source of a derivation on that board, with `metric.derivation_source` and HTTP 409. Retiring a source SHALL be allowed. A copy of a derived metric SHALL NOT take its derivation.

#### Scenario: Deleting a source is refused

- **WHEN** a leader deletes a metric without values that is the source of another metric's derivation
- **THEN** it is rejected with `metric.derivation_source` and HTTP 409, and both metrics are unchanged

#### Scenario: Removing an included global source is refused

- **WHEN** a leader removes from their board a global metric that, on that board, is the source of a derivation
- **THEN** it is rejected with `metric.derivation_source` and HTTP 409

#### Scenario: A retired source leaves the derivation missing a number

- **WHEN** a source metric is retired and a value is then derived at a later meeting
- **THEN** deriving is refused with `derivation.source_missing` against that source

#### Scenario: A copy has no derivation

- **WHEN** a derived metric is copied onto another board
- **THEN** the copy has no derivation

### Requirement: The settings page edits a derivation

The metric settings page SHALL show a derived metric's kind and sources, and SHALL let whoever configures the board set, change and remove a derivation, when creating a metric and on an existing one. A source SHALL be chosen as a team and then a metric of that team's board. All text SHALL be in the active language.

#### Scenario: A derivation is set on the settings page

- **WHEN** a leader opens a metric's derivation, chooses "Mean", adds the sources "OTIF E: BPW" and "OTIF E: CKBiR" from their own team, and saves
- **THEN** the metric's row reads as the mean of those two metrics

#### Scenario: A source from another team

- **WHEN** a leader adds a source, chooses the team "CKI-P" and then its metric "OTIF-Etap"
- **THEN** the source reads as "OTIF-Etap (CKI-P)"

#### Scenario: A viewer who may not configure the board

- **WHEN** a member who may not configure the board opens the settings page
- **THEN** each derivation is shown, with no control to change it

### Requirement: Derive in the recording view

The recording view SHALL offer "Derive" on the row of each derived metric whose number can be edited. Choosing it SHALL put the derived number in the number field, name the numbers it used, and save the row as a typed number would be saved. When deriving is refused, the field SHALL be left as it was and the view SHALL name each missing source or previous meeting.

#### Scenario: Deriving fills and saves the number

- **WHEN** a member chooses "Derive" on the row of "OTIF E" at an editable meeting where its six sources have numbers
- **THEN** the number field holds 93.833333 formatted for the active language, the six numbers used are named, and the row is saved

#### Scenario: A derived number can be changed

- **WHEN** a member derives a number, then types another over it and leaves the field
- **THEN** the typed number is recorded

#### Scenario: A missing source is named

- **WHEN** a member chooses "Derive" where the source "OTIF E: CKI-S" has no number that week
- **THEN** the number field is unchanged and the view says that "OTIF E: CKI-S" has no number for that week

#### Scenario: No Derive on a metric without a derivation

- **WHEN** the recording view is opened
- **THEN** only the rows of derived metrics offer "Derive"

#### Scenario: No Derive on a frozen meeting

- **WHEN** the recording view is opened read-only for a meeting that cannot be edited
- **THEN** no row offers "Derive"
