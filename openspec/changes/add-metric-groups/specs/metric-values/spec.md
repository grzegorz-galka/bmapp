# Spec Delta

## MODIFIED Requirements

### Requirement: The board page

The system SHALL present a team's board at the team's own address. It SHALL show one meeting's metrics as tiles under the board's groups, in the board's order, with the ungrouped metrics last under a heading of their own and a group that shows no metric left out, each tile with its value, colour, change and sparkline. It SHALL move between the team's meetings, opening at its first meeting dated today or later, or else its latest. All text SHALL be in the active language.

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
