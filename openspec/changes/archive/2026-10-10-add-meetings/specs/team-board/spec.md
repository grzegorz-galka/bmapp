## ADDED Requirements

### Requirement: Set a board's meeting schedule

The system SHALL allow a board definition's weekly meeting schedule to be set: an ISO weekday from 1 (Monday) to 7 (Sunday) and a start time, both in Europe/Warsaw wall-clock time. Setting it SHALL replace any schedule the board had. A board SHALL have no schedule until one is set. The response SHALL be the team as the team list returns it.

#### Scenario: A schedule is set

- **WHEN** a board's schedule is set to weekday 3 at 13:00
- **THEN** the team is returned with its board carrying the schedule Wednesday, 13:00

#### Scenario: A schedule is replaced

- **WHEN** a board that meets on Wednesdays at 13:00 has its schedule set to weekday 2 at 09:30
- **THEN** the board's only schedule is Tuesday, 09:30

#### Scenario: Weekday out of range

- **WHEN** a schedule is submitted with weekday 0 or 8
- **THEN** the request is rejected with the code `schedule_weekday.out_of_range` against the field `weekday`, and the schedule is unchanged

#### Scenario: Weekday or time missing or malformed

- **WHEN** a schedule is submitted without a weekday, or with a time that is not a valid time of day
- **THEN** the request is rejected with the code `request.invalid_field` against the offending field, and the schedule is unchanged

#### Scenario: Setting a schedule leaves existing meetings alone

- **WHEN** a board's schedule is changed while its team has meetings opened on the previous weekday
- **THEN** those meetings keep their dates and start times

## MODIFIED Requirements

### Requirement: Retrieve the registered teams

The system SHALL return the registered teams ordered by name, ascending. Each returned team SHALL carry its identifier, its name, the identifier and name of its board definition, the board's meeting schedule or none, the identifier and email of its leader, and the number of its members.

#### Scenario: Registered teams are returned in order

- **WHEN** the team list is requested and one or more teams have been registered
- **THEN** every registered team is returned, in ascending order of name, each carrying its board definition, its leader and its member count

#### Scenario: Member count follows membership changes

- **WHEN** a member is added to a team and the team list is then requested
- **THEN** that team's member count is one higher than before, and its leader is unchanged

#### Scenario: No teams have been registered

- **WHEN** the team list is requested and no teams have been registered
- **THEN** an empty list is returned rather than an error

#### Scenario: A board's schedule is returned with its team

- **WHEN** the team list is requested and one team's board has a schedule and another's has none
- **THEN** the first team's board carries its weekday and start time, and the second's carries no schedule
