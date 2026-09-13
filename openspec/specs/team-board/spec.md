## Purpose

Registers the teams that hold board meetings and the board that belongs to each one. This capability owns the team record and its board definition — the root entities every later capability attaches to, since indicators and their metrics hang off a board, and problems and tasks are tracked against the team that owns it.

## Requirements

### Requirement: Register a team with its board

The system SHALL allow a team to be registered with a name. Registering a team SHALL create exactly one board definition belonging to that team, named after the team. Each team and each board definition SHALL be assigned an identifier that is unique across all records of its kind and stable for the life of the record.

A team name SHALL be stored with leading and trailing whitespace removed, SHALL be no longer than 200 characters once trimmed, and SHALL be unique across teams when compared without regard to case.

#### Scenario: Team is registered successfully

- **WHEN** a team is submitted with a non-empty name that no other team uses
- **THEN** the team is persisted, assigned a unique identifier, given exactly one board definition named after the team, and returned to the caller carrying the team identifier, the team name, and the board's identifier and name

#### Scenario: Name is missing or blank

- **WHEN** a team is submitted with a name that is absent, empty, or consists only of whitespace
- **THEN** the submission is rejected with a validation error that identifies the name as the offending field, and neither a team nor a board definition is created

#### Scenario: Name exceeds the maximum length

- **WHEN** a team is submitted with a name longer than 200 characters after trimming
- **THEN** the submission is rejected with a validation error that identifies the name as the offending field, and neither a team nor a board definition is created

#### Scenario: Name duplicates an existing team

- **WHEN** a team is submitted with a name that an already registered team uses, differing at most in letter case or in surrounding whitespace
- **THEN** the submission is rejected with an error that identifies the name as the offending field, and no second team is created

#### Scenario: Surrounding whitespace is removed from the name

- **WHEN** a team is submitted with a name that has leading or trailing whitespace around otherwise valid text
- **THEN** the team is registered under the trimmed name, and the trimmed name is what is returned and what later submissions are compared against

### Requirement: Retrieve the registered teams

The system SHALL return the registered teams ordered by name, ascending. Each returned team SHALL carry its identifier, its name, and the identifier and name of its board definition.

#### Scenario: Registered teams are returned in order

- **WHEN** the team list is requested and one or more teams have been registered
- **THEN** every registered team is returned, in ascending order of name, each carrying its board definition

#### Scenario: No teams have been registered

- **WHEN** the team list is requested and no teams have been registered
- **THEN** an empty list is returned rather than an error
