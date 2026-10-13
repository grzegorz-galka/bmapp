## ADDED Requirements

### Requirement: A team's pages lead back to where they were opened from

The board, the meetings page, the members page and the metric settings page SHALL each carry a back link that returns to the screen the page was opened from and names it in the active language. The board SHALL keep that origin while its own view changes. With no recorded origin, the back link SHALL lead where it does by default: the team list, or the board from the metric settings page.

#### Scenario: The board leads back to the screen it was opened from

- **WHEN** a person opens a team's board from My meetings and follows its back link
- **THEN** the link reads "Back to My meetings" and returns them to My meetings

#### Scenario: The board's own views keep the origin

- **WHEN** a person opens a team's board from the dashboard, switches to the pulse check, then to the archive, then back to the tiles
- **THEN** the back link still reads "Back to the dashboard" and returns them to the dashboard

#### Scenario: A page opened from the board leads back to the board, which still knows its origin

- **WHEN** a person opens a board from My teams, opens its meetings page from the board, follows the meetings page's back link and then the board's back link
- **THEN** the first link reads "Back to the board" and returns to that board, and the second reads "Back to My teams" and returns to My teams

#### Scenario: A page with no recorded origin falls back to its default

- **WHEN** a person opens a team's board, meetings page or members page from a bookmark, and a team's metric settings page from a bookmark
- **THEN** the first three read "Back to the teams" and lead to the team list, and the metric settings page reads "Back to the board" and leads to that team's board

#### Scenario: The back link reads in Polish

- **WHEN** the active language is Polish and a person opens a team's board from the dashboard
- **THEN** the back link names the dashboard in Polish, taken from the Polish catalogue
