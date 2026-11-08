## Purpose

Lets a board's metric be worked out from other metrics recorded in the same week, on the same team or on others, as a mean, a sum or a change since the previous meeting, and fills that number into the recording view on request.

## Requirements

### Requirement: Define a metric's derivation

The system SHALL allow whoever configures a board to give one of its own metrics a derivation, when it is added or later, and to change or remove it. A derivation is a kind, `mean`, `sum`, `weighted_mean` or `delta`, and an ordered list of sources, each a metric on a named team's board. `mean`, `sum` and `weighted_mean` take one or more sources and `delta` exactly one. A metric SHALL be returned with its derivation, each source carrying its team's and metric's identifiers and names, and for a `weighted_mean` its weight.

#### Scenario: A mean of six metrics

- **WHEN** a leader gives the board's metric "OTIF E" the kind `mean` with the six sources "OTIF E: BPW" … "OTIF E: CKI-S" on the same board
- **THEN** "OTIF E" is returned with that kind and those six sources in that order, each with its team and metric names

#### Scenario: A value taken from another team

- **WHEN** a leader gives the metric "OTIF E: CKI-P" the kind `mean` with the single source "OTIF-Etap" on the board of the team "CKI-P"
- **THEN** it is returned with that derivation

#### Scenario: A metric added with a derivation

- **WHEN** a leader creates the metric "Zatrudnienie delta" with the kind `delta` and the source "Zatrudnienie" on the same board
- **THEN** it is returned with that derivation

#### Scenario: A weighted mean of three metrics

- **WHEN** a leader gives the board's metric "OTIF E" the kind `weighted_mean` with the sources "OTIF E: BPW" weighted 3, "OTIF E: CKBiR" weighted 1 and "OTIF E: CKI-S" weighted 1
- **THEN** "OTIF E" is returned with that kind and those three sources in that order, each with its weight

#### Scenario: A derivation is removed

- **WHEN** a leader removes a metric's derivation
- **THEN** the metric is returned with none, and its recorded values are unchanged

#### Scenario: A derivation is changed

- **WHEN** a leader changes a metric's derivation from `sum` to `mean`
- **THEN** it is returned with `mean`, and its recorded values are unchanged

#### Scenario: Wrong number of sources

- **WHEN** a derivation of the kind `delta` is given two sources, or one of the kind `mean`, `sum` or `weighted_mean` is given none
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

The system SHALL return, for a derived metric at a meeting, the number its derivation gives from the numbers recorded, together with each source's team, metric, meeting date and number, for a `weighted_mean` its weight, and for a `delta` the previous meeting's date and number. A `weighted_mean` SHALL be the sum of each weight times its source's number divided by the sum of the weights. A mean and a weighted mean SHALL be kept to 6 decimal places, rounding half to even. Deriving SHALL record nothing.

#### Scenario: The mean of six units

- **WHEN** "OTIF E" is derived at a meeting where its six sources have the numbers 90, 97, 87, 83, 105 and 101
- **THEN** the number returned is 93.833333, with each source's number and meeting date, and no value is recorded

#### Scenario: A sum

- **WHEN** a `sum` of two sources is derived where they have the numbers 12.5 and 7
- **THEN** the number returned is 19.5

#### Scenario: A weighted mean

- **WHEN** a `weighted_mean` is derived from sources weighted 3, 1 and 1 that have the numbers 90, 97 and 87
- **THEN** the number returned is 90.8, with each source's number, meeting date and weight

#### Scenario: A weighted mean is rounded half to even

- **WHEN** a `weighted_mean` is derived from sources weighted 1 and 2 that have the numbers 10 and 20
- **THEN** the number returned is 16.666667

#### Scenario: Weights need not add up to one

- **WHEN** one `weighted_mean` has the weights 0.6, 0.2 and 0.2 and another has the weights 3, 1 and 1, over the same sources with the same numbers
- **THEN** both return the same number

#### Scenario: A delta

- **WHEN** a `delta` is derived where its source has 391 at the meeting and 395 at the team's previous meeting
- **THEN** the number returned is −4, with both numbers and both meeting dates

#### Scenario: A source has no number

- **WHEN** one source's team has a meeting that week with no number for it, or no meeting that week at all
- **THEN** deriving is refused with `derivation.source_missing` against that source, one entry per missing source, and nothing is returned or recorded

#### Scenario: A weighted mean with a source missing is refused

- **WHEN** a `weighted_mean` is derived where one of its sources has no number that week
- **THEN** deriving is refused with `derivation.source_missing` against that source, and no number is worked out from the other sources

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

The metric settings page SHALL show a derived metric's kind and sources, and SHALL let whoever configures the board set, change and remove a derivation, when creating a metric and on an existing one. A source SHALL be chosen as a team and then a metric of that team's board. For a weighted mean, each source SHALL have a weight field, and the sources SHALL be listed with their weights. All text SHALL be in the active language.

#### Scenario: A derivation is set on the settings page

- **WHEN** a leader opens a metric's derivation, chooses "Mean", adds the sources "OTIF E: BPW" and "OTIF E: CKBiR" from their own team, and saves
- **THEN** the metric's row reads as the mean of those two metrics

#### Scenario: A source from another team

- **WHEN** a leader adds a source, chooses the team "CKI-P" and then its metric "OTIF-Etap"
- **THEN** the source reads as "OTIF-Etap (CKI-P)"

#### Scenario: A weighted mean is set on the settings page

- **WHEN** a leader chooses "Weighted mean", adds the sources "OTIF E: BPW" and "OTIF E: CKBiR", sets the first one's weight to 3, and saves
- **THEN** the metric's row reads as the weighted mean of two metrics, and expanding it lists "OTIF E: BPW" with the weight 3 and "OTIF E: CKBiR" with the weight 1

#### Scenario: A weight starts at one

- **WHEN** a leader changes a mean of two sources to "Weighted mean", or adds a source to a weighted mean
- **THEN** each source that had no weight has a weight field holding 1

#### Scenario: Weights are dropped with the kind

- **WHEN** a leader changes a weighted mean to "Mean" and saves
- **THEN** the sources are kept in their order, no weight fields are shown, and the metric is returned with no weights

#### Scenario: A weight that is not a number greater than zero

- **WHEN** a leader enters 0 as a source's weight and saves
- **THEN** the weight field is marked invalid with the reason in the active language, and the metric is unchanged

#### Scenario: A viewer who may not configure the board

- **WHEN** a member who may not configure the board opens the settings page
- **THEN** each derivation is shown, with no control to change it

### Requirement: Derive in the recording view

The recording view SHALL offer "Derive" on the row of each derived metric whose number can be edited, on the same line as the number field. Choosing it SHALL put the derived number in the number field, name the numbers it used and for a weighted mean their weights, and save the row as a typed number would be saved. When deriving is refused, the field SHALL be left as it was and the view SHALL name each missing source or previous meeting. The numbers used, and a refusal, SHALL be shown on the row's message line.

#### Scenario: Deriving fills and saves the number

- **WHEN** a member chooses "Derive" on the row of "OTIF E" at an editable meeting where its six sources have numbers
- **THEN** the number field holds 93.833333 formatted for the active language, the six numbers used are named, and the row is saved

#### Scenario: Deriving a weighted mean names the weights

- **WHEN** a member chooses "Derive" on the row of a weighted mean whose sources weighted 3, 1 and 1 have the numbers 90, 97 and 87
- **THEN** the number field holds 90.8 formatted for the active language, and each of the three numbers is named with its weight

#### Scenario: A derived number can be changed

- **WHEN** a member derives a number, then types another over it and leaves the field
- **THEN** the typed number is recorded

#### Scenario: A missing source is named

- **WHEN** a member chooses "Derive" where the source "OTIF E: CKI-S" has no number that week
- **THEN** the number field is unchanged and the view says that "OTIF E: CKI-S" has no number for that week

#### Scenario: Derive sits beside the number field

- **WHEN** the recording view is displayed wider than 40rem with a derived metric's row
- **THEN** "Derive" is on the same line as that row's number field

#### Scenario: Several missing sources fit the row's width

- **WHEN** deriving is refused because three sources have no number that week
- **THEN** the three are named on the row's message line, under the row and as wide as the table, not in the state column

#### Scenario: No Derive on a metric without a derivation

- **WHEN** the recording view is opened
- **THEN** only the rows of derived metrics offer "Derive"

#### Scenario: No Derive on a frozen meeting

- **WHEN** the recording view is opened read-only for a meeting that cannot be edited
- **THEN** no row offers "Derive"

### Requirement: A weighted mean's weights

The system SHALL require every source of a `weighted_mean` to carry a weight, a number greater than 0 kept to at most 6 decimal places. The weights SHALL NOT need to add up to any total. A source of any other kind SHALL carry no weight. A rejected weight SHALL leave the metric unchanged.

#### Scenario: A source without a weight

- **WHEN** a `weighted_mean` is given a source with no weight
- **THEN** it is rejected with `derivation_source.weight_required` against that source

#### Scenario: A weight of zero or less

- **WHEN** a `weighted_mean` is given a source weighted 0, or one weighted −1
- **THEN** it is rejected with `derivation_source.weight_invalid` against that source

#### Scenario: A weight on another kind

- **WHEN** a derivation of the kind `mean`, `sum` or `delta` is given a source with a weight
- **THEN** it is rejected with `derivation_source.weight_invalid` against that source

#### Scenario: Fractional weights

- **WHEN** a `weighted_mean` is given the weights 0.6, 0.25 and 0.15
- **THEN** it is accepted and returned with those weights

### Requirement: The metric detail lists a derived value's sources

The metric detail of a derived metric SHALL have a section, collapsed when the detail opens, for the meeting the board shows. Opening it SHALL derive the value again and list each source's team, metric, meeting date and number, with its weight for a weighted mean and the previous number for a delta. It SHALL say when the result differs from the number recorded at that meeting. It SHALL record nothing.

#### Scenario: The sources are listed

- **WHEN** a viewer opens the detail of "OTIF E" from the board showing the meeting of 2026-11-04 and opens its sources section
- **THEN** the six sources are listed with their teams, meeting dates and numbers, followed by the derived number

#### Scenario: Nothing is derived until the section is opened

- **WHEN** a viewer opens the detail of a derived metric and leaves its sources section collapsed
- **THEN** no value is derived

#### Scenario: The sources have changed since the value was recorded

- **WHEN** "OTIF E" was recorded as 93.833333 at the meeting shown, a source was corrected afterwards, and the sources section is opened
- **THEN** the section lists the sources' current numbers and the new result, says that the sources have changed since the value was recorded, and the recorded value stays 93.833333

#### Scenario: The value matches its sources

- **WHEN** the sources section is opened for a meeting whose recorded value equals the derived number
- **THEN** no change is reported

#### Scenario: No value recorded yet

- **WHEN** the sources section is opened for a meeting with no number for the metric
- **THEN** the sources and the derived number are listed, with no comparison

#### Scenario: A source is missing now

- **WHEN** the sources section is opened where the source "OTIF E: CKI-S" has no number that week
- **THEN** the section says that "OTIF E: CKI-S" has no number for that week, as the recording view does

#### Scenario: A metric that is not derived

- **WHEN** the detail of a metric without a derivation is opened
- **THEN** it has no sources section
