## ADDED Requirements

### Requirement: Only a team's members and administrators read its individual pulse answers

The system SHALL return a meeting's individual pulse answers, and the members who have not answered, only to a member of the meeting's team or an administrator. Anyone else signed in SHALL receive the meeting's results without them: the counts, the average, the distribution and the trend. A viewer refused the answers SHALL NOT be refused the results.

#### Scenario: A member reads the answers by name

- **WHEN** a member of a team reads the pulse results of one of its meetings
- **THEN** the results include every answer with its respondent and the members who have not answered

#### Scenario: An administrator reads the answers by name

- **WHEN** an administrator who is not a member of a team reads the pulse results of one of its meetings
- **THEN** the results include every answer with its respondent and the members who have not answered

#### Scenario: A stranger reads the aggregates only

- **WHEN** an authenticated person who is not a member of a team reads the pulse results of one of its meetings
- **THEN** the counts, the average, its status and change, the distribution and the trend are returned, and no answer, respondent or missing member is

#### Scenario: A former member reads the aggregates only

- **WHEN** a person who answered at a meeting and has since left the team reads that meeting's pulse results
- **THEN** they receive the aggregates only, as any other stranger does

### Requirement: Only a member answers the pulse check, for themselves

The system SHALL permit only a member of a team, its leader included, to record a pulse answer at the team's meetings, and only as their own answer. It SHALL refuse anyone else, an administrator who is not a member included, with `auth.forbidden`.

An answer is a statement of how its respondent felt; nobody else can make it for them.

#### Scenario: The leader answers

- **WHEN** the leader of a team records a pulse answer at the team's next meeting
- **THEN** the answer is recorded with the leader as its respondent

#### Scenario: A stranger cannot answer

- **WHEN** an authenticated person who is not a member of a team records a pulse answer at one of its meetings
- **THEN** the request is refused with `auth.forbidden`, and nothing is recorded

#### Scenario: An administrator who is not a member cannot answer

- **WHEN** an administrator who is not a member of a team records a pulse answer at one of its meetings
- **THEN** the request is refused with `auth.forbidden`, and nothing is recorded

### Requirement: The pulse check view offers only what its viewer may do

The system SHALL offer the pulse answer form only to a member of the team at a meeting that takes answers, and SHALL show the answers table and the names of missing members only to a viewer permitted to read them. A viewer refused them SHALL still see the cards and the trend, with the number of missing answers and without names.

#### Scenario: A member sees the form and the answers

- **WHEN** a member of a team opens the pulse check view of a meeting that takes answers
- **THEN** answering is offered, and the answers table and the missing members' names are shown

#### Scenario: A stranger sees the aggregates and no form

- **WHEN** an authenticated person who is not a member of a team opens the pulse check view of one of its meetings
- **THEN** the cards and the trend are shown with the number of missing answers, and no answers table, no names and no answer form

#### Scenario: An administrator sees the answers and no form

- **WHEN** an administrator who is not a member of a team opens the pulse check view of a meeting that takes answers
- **THEN** the answers table and the missing members' names are shown, and no answer form is offered

## MODIFIED Requirements

### Requirement: Anyone signed in may read

The system SHALL permit every authenticated person to read every board and
everything on it, whether or not they belong to any team and whether or not they
are a recorded employee — except a meeting's individual pulse answers and who has
not answered, which only the team's members and administrators read.

Reading SHALL NOT require an employee record, so that a person who has joined the
organization but has not yet been put on a team can still see the boards, and so
that an administrator can see a system in which nothing has been recorded yet.

#### Scenario: An authenticated person who belongs to no team reads a board

- **WHEN** an authenticated person who is a member of no team reads a team's board
- **THEN** the board is returned

#### Scenario: An authenticated person who is not a recorded employee reads

- **WHEN** an authenticated person whose email matches no recorded employee reads the
  team list and a team
- **THEN** both are returned

#### Scenario: Individual pulse answers are the one exception

- **WHEN** an authenticated person who is a member of no team reads the pulse results of a team's meeting
- **THEN** the results are returned without the individual answers or the missing members
