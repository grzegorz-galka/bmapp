## MODIFIED Requirements

### Requirement: The metric settings page

The system SHALL present a board's metrics on its metric settings page with, in one row at the top, "Create new metric", "Copy from another board" and "Include global metric", each opening its form in a dialog over the page. No form for a new metric SHALL be shown on the page itself. The page SHALL carry no links to the board or the meetings beyond its back link, which returns to the screen the page was opened from, or to the board when that is not known.

#### Scenario: The three ways to add a metric are offered at the top

- **WHEN** a leader opens their team's metric settings
- **THEN** "Create new metric", "Copy from another board" and "Include global metric" are offered in one row above the metrics, no field for a new metric is shown, and no Board or Meetings button is shown

#### Scenario: A metric is created from the dialog

- **WHEN** the leader chooses "Create new metric", fills in the name, unit, decimals and direction and saves
- **THEN** the dialog closes and the new metric is listed on the page

#### Scenario: Cancelling leaves the board unchanged

- **WHEN** the leader opens "Create new metric", types a name and cancels
- **THEN** the dialog closes and no metric is added

#### Scenario: A rejection keeps the dialog open

- **WHEN** creating a metric is rejected because its name is already on the board
- **THEN** the dialog stays open showing the reason next to the name, with what was typed kept

#### Scenario: Opened from Team metrics, the page leads back there

- **WHEN** a leader opens their team's metric settings from Team metrics and follows the back link
- **THEN** the link reads "Back to Team metrics" and returns them to Team metrics
