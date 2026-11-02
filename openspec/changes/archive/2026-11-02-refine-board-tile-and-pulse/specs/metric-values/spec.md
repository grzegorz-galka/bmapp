# Spec Delta

## MODIFIED Requirements

### Requirement: The board of a meeting

The system SHALL return, for a meeting, each active metric with:

- its value and its status;
- whether the colour was set by hand;
- its comment;
- the threshold in force;
- the number recorded at the team's previous meeting, and the change since then;
- whether that change is an improvement;
- the number recorded at the team's meeting four meetings earlier, the change since then, and whether that change is an improvement;
- its values over the team's last 12 meetings.

It SHALL also return whether the meeting can be edited.

#### Scenario: The change since the previous meeting

- **WHEN** a `higher_is_better` metric is 90 at a meeting and was 85 at the team's previous meeting
- **THEN** the board shows a change of +5, marked as an improvement

#### Scenario: Lower is better reads the change the other way

- **WHEN** a `lower_is_better` metric is 3 at a meeting and was 4 at the previous one
- **THEN** the change is −1, marked as an improvement

#### Scenario: A band metric has no better direction

- **WHEN** a `within_band` metric changes between meetings
- **THEN** the change is shown, marked as neither an improvement nor a decline

#### Scenario: No number at the previous meeting

- **WHEN** the team's previous meeting has no number for a metric
- **THEN** no change is shown for it, even if an earlier meeting has one

#### Scenario: The change since four meetings earlier

- **WHEN** a `lower_is_better` metric is 6 at a meeting and was 9 at the team's meeting four meetings before it
- **THEN** the board returns 9 as the number four meetings earlier and a change of −3 since then, marked as an improvement

#### Scenario: Four meetings earlier counts meetings, not weeks

- **WHEN** a team skipped two weeks among its last five meetings
- **THEN** the number four meetings earlier is the one recorded at the fourth meeting before the one shown, not at the meeting four weeks before it

#### Scenario: Fewer than four earlier meetings

- **WHEN** a team has held only three meetings before the one shown, or its meeting four meetings earlier has no number for a metric
- **THEN** no change since four meetings earlier is returned for that metric

#### Scenario: Retired metrics are left off

- **WHEN** a board with a retired metric is requested for a meeting
- **THEN** the retired metric is not among the returned metrics

### Requirement: The board page

The system SHALL present a team's board at the team's own address. It SHALL show one meeting's metrics as tiles under the board's groups, in the board's order, with the ungrouped metrics last under a heading of their own and a group that shows no metric left out, each tile with its value, its status badge, its two change indicators and sparkline. A metric hidden on the board SHALL have no tile, and a group whose metrics are all hidden SHALL be left out. It SHALL move between the team's meetings, opening at its first meeting dated today or later, or else its latest. All text SHALL be in the active language.

#### Scenario: The board opens on the coming meeting

- **WHEN** a team's board is opened on a Monday before that week's Wednesday meeting
- **THEN** the board shows the Wednesday meeting

#### Scenario: Colour is never the only signal

- **WHEN** a tile is red, amber or green, or its colour was set by hand
- **THEN** the status and the set-by-hand mark are also given in words

#### Scenario: A board without metrics

- **WHEN** the board of a team with no metrics is opened
- **THEN** the board says no metrics are defined yet and, to a viewer who may configure the board, links to the metric settings

#### Scenario: Tiles follow the board's layout

- **WHEN** a board with the groups "Finance" then "Quality", "Quality" holding "Defects" then "Bugs", one ungrouped metric "Morale" and an empty group "Delivery" is opened at a meeting
- **THEN** the tiles are shown under "Finance", then "Quality" with "Defects" before "Bugs", then "Morale" under the ungrouped heading, and no heading "Delivery" is shown

#### Scenario: A hidden metric has no tile

- **WHEN** a board whose group "Headcount" holds the hidden metric "Zatrudnienie" and the shown metric "Zatrudnienie delta" is opened at a meeting where both have a number
- **THEN** only the tile "Zatrudnienie delta" is shown under "Headcount"

#### Scenario: A group of hidden metrics is left out

- **WHEN** a board's group holds only hidden metrics
- **THEN** the board shows no heading for that group

## ADDED Requirements

### Requirement: A tile's status badge

The system SHALL show, in a tile's top-right corner, a badge filled with the tile's status colour, or grey with no number or no threshold. It SHALL name the threshold's target value, or its boundaries when it has none or it is 0, or read "No threshold". A colour set by hand SHALL be marked beside it. The tile SHALL NOT print the threshold definition elsewhere.

#### Scenario: The badge names the target value

- **WHEN** a tile is shown for a metric that is green against a threshold with the target value 72.3 and the unit "%"
- **THEN** its badge is filled green and reads "Target: 72.3 %" in English and "Cel: 72,3 %" in Polish

#### Scenario: A version without a target value names its boundaries

- **WHEN** a tile is shown for a `lower_is_better` metric whose threshold in force has the green boundary 5 and no target value
- **THEN** its badge reads "Target: ≤ 5"

#### Scenario: A band without a target value names the band

- **WHEN** a tile is shown for a `within_band` metric whose threshold in force has the green band 90 to 110 and no target value
- **THEN** its badge reads "Target: 90–110"

#### Scenario: No number makes the badge grey

- **WHEN** a tile is shown for a metric with a threshold and no number at the meeting
- **THEN** its badge is grey and still names the target

#### Scenario: A metric without a threshold

- **WHEN** a tile is shown for a metric with no threshold in force
- **THEN** its badge is grey and reads "No threshold"

#### Scenario: The badge names the status in words

- **WHEN** assistive technology reads the badge of a red tile whose colour was set by hand
- **THEN** it announces the status "Red", that the colour was set by hand, and the target

#### Scenario: The threshold is no longer printed on the tile

- **WHEN** a tile is shown for a metric with a threshold
- **THEN** the threshold's tolerances or boundaries do not appear as text on the tile outside its tooltip

### Requirement: The threshold definition over the badge

The system SHALL show, over a tile's badge, a tooltip with the tile's status and the full definition of the threshold in force, as the metric detail words it. The tooltip SHALL open when the badge is hovered and when it receives keyboard focus, and close when the pointer or the focus leaves it, or on Escape.

#### Scenario: Hovering the badge shows the threshold

- **WHEN** a viewer hovers the badge of a tile whose threshold has the target value 10 with green and amber tolerances
- **THEN** a tooltip shows the status and the threshold definition with the target value and both tolerances

#### Scenario: Keyboard focus shows the threshold

- **WHEN** a viewer moves the keyboard focus onto a tile's badge
- **THEN** the same tooltip is shown and is the badge's accessible description

#### Scenario: Escape closes the tooltip

- **WHEN** a tile's tooltip is open and the viewer presses Escape
- **THEN** the tooltip closes and the focus stays on the badge

### Requirement: A tile's two change indicators

The system SHALL show on a tile two indicators: the change since the team's previous meeting and the change since its meeting four meetings earlier. Each SHALL show an arrow pointing up for a rise and down for a fall, with the signed difference in the metric's unit and decimals. The arrow SHALL be green for an improvement, red for a decline, and neutral for a band metric. No change SHALL show a level arrow, and no number to compare SHALL show a dash.

#### Scenario: Both indicators for a one-sided metric

- **WHEN** a `higher_is_better` metric is 90 at a meeting, 85 at the previous one and 95 four meetings earlier
- **THEN** the tile shows a green up arrow with "+5" for the previous meeting and a red down arrow with "−5" for four meetings earlier

#### Scenario: A band metric's arrows are neutral

- **WHEN** a `within_band` metric rose by 4 since the previous meeting
- **THEN** the tile shows a neutral up arrow with "+4", neither green nor red

#### Scenario: No change shows a level arrow

- **WHEN** a metric has the same number at a meeting and at the previous one
- **THEN** the indicator for the previous meeting shows a neutral level arrow with "0"

#### Scenario: Nothing to compare shows a dash

- **WHEN** a metric has no number at the meeting four meetings earlier
- **THEN** the indicator for four meetings earlier shows a dash and no arrow

#### Scenario: The indicators are named in words

- **WHEN** assistive technology reads a tile's indicators
- **THEN** each is announced with what it compares to, the signed difference and whether it is better, worse or neither, in the active language
