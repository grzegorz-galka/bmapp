## Purpose

Registers the teams that hold board meetings and the board that belongs to each one. This capability owns the team record and its board definition — the root entities every later capability attaches to, since metrics hang off a board, and the team's members and leader, its problems and its tasks are tracked against the team that owns it.

## Requirements

### Requirement: Register a team with its board

The system SHALL allow a team to be registered with a name. Registering a team SHALL create exactly one board definition belonging to that team, named after the team. Each team and each board definition SHALL be assigned an identifier that is unique across all records of its kind and stable for the life of the record.

A team name SHALL be stored with leading and trailing whitespace removed, SHALL be no longer than 200 characters once trimmed, and SHALL be unique across teams when compared without regard to case.

Every rejection SHALL identify the offending field and SHALL carry a stable code naming the reason for the rejection, so that a client can present its own wording for that reason in the language its user reads. A code SHALL NOT change once published, and the same reason SHALL always be reported under the same code. The codes for this requirement are `team_name.blank` for a name that is empty or whitespace, `team_name.too_long` for a name over the maximum length, and `team_name.duplicate` for a name another team already uses. A submission malformed before those rules can be applied — no name at all, or a name that is not text — SHALL carry the general code `request.invalid_field`. A rejection SHALL also carry human-readable English text describing the failure; that text is developer-facing and clients are not expected to display it.

#### Scenario: Team is registered successfully

- **WHEN** a team is submitted with a non-empty name that no other team uses
- **THEN** the team is persisted, assigned a unique identifier, given exactly one board definition named after the team, and returned to the caller carrying the team identifier, the team name, and the board's identifier and name

#### Scenario: Name is missing or blank

- **WHEN** a team is submitted with a name that is empty or consists only of whitespace, or with no name at all, or with a name that is not text
- **THEN** the submission is rejected with a validation error that identifies the name as the offending field, carrying the code `team_name.blank` when a name was submitted but is blank and the code `request.invalid_field` when no name was submitted or it is not text, and neither a team nor a board definition is created

#### Scenario: Name exceeds the maximum length

- **WHEN** a team is submitted with a name longer than 200 characters after trimming
- **THEN** the submission is rejected with a validation error that identifies the name as the offending field and carries the code `team_name.too_long`, and neither a team nor a board definition is created

#### Scenario: Name duplicates an existing team

- **WHEN** a team is submitted with a name that an already registered team uses, differing at most in letter case or in surrounding whitespace
- **THEN** the submission is rejected with an error that identifies the name as the offending field and carries the code `team_name.duplicate`, and no second team is created

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
