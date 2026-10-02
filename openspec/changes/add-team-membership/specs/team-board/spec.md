## MODIFIED Requirements

### Requirement: Register a team with its board

The system SHALL allow a team to be registered with a name and the email of its leader. Registering a team SHALL create exactly one board definition belonging to that team, named after the team, and SHALL make the employee with that email the team's first member and its leader, creating the employee if no employee with that email exists yet. Each team and each board definition SHALL be assigned an identifier that is unique across all records of its kind and stable for the life of the record.

A team name SHALL be stored with leading and trailing whitespace removed, SHALL be no longer than 200 characters once trimmed, and SHALL be unique across teams when compared without regard to case. The leader's email SHALL be subject to the same rules as any employee email in the `team-membership` capability.

Every rejection SHALL identify the offending field and SHALL carry a stable code naming the reason for the rejection, so that a client can present its own wording for that reason in the language its user reads. A code SHALL NOT change once published, and the same reason SHALL always be reported under the same code. The codes for this requirement are `team_name.blank` for a name that is empty or whitespace, `team_name.too_long` for a name over the maximum length, and `team_name.duplicate` for a name another team already uses. A leader email that breaks an email rule SHALL be reported against the field `leader_email`, with the code that rule defines. A submission malformed before those rules can be applied — a missing name or leader email, or one that is not text — SHALL carry the general code `request.invalid_field`. When several fields are invalid, each SHALL be reported. A rejection SHALL also carry human-readable English text describing the failure. That text is for developers, and clients are not expected to display it. A rejected registration SHALL create no team, no board definition, no membership and no employee.

#### Scenario: Team is registered successfully

- **WHEN** a team is submitted with a non-empty name that no other team uses and a valid leader email
- **THEN** the team is persisted, assigned a unique identifier, given exactly one board definition named after the team, given the employee with that email as its only member and its leader, and returned to the caller carrying the team identifier, the team name, the board's identifier and name, the leader's identifier and email, and a member count of one

#### Scenario: The leader is an employee who already exists

- **WHEN** a team is submitted whose leader email belongs to an employee already recorded, written in different letter case or with surrounding whitespace
- **THEN** that existing employee becomes the team's leader and no second employee is created

#### Scenario: Name is missing or blank

- **WHEN** a team is submitted with a name that is empty or consists only of whitespace, or with no name at all, or with a name that is not text
- **THEN** the submission is rejected with a validation error that identifies the name as the offending field, carrying the code `team_name.blank` when a name was submitted but is blank and the code `request.invalid_field` when no name was submitted or it is not text, and neither a team nor a board definition is created

#### Scenario: Name exceeds the maximum length

- **WHEN** a team is submitted with a name longer than 200 characters after trimming
- **THEN** the submission is rejected with a validation error that identifies the name as the offending field and carries the code `team_name.too_long`, and neither a team nor a board definition is created

#### Scenario: Name duplicates an existing team

- **WHEN** a team is submitted with a name that an already registered team uses, differing at most in letter case or in surrounding whitespace
- **THEN** the submission is rejected with an error that identifies the name as the offending field and carries the code `team_name.duplicate`, no second team is created, and no employee is created for the submitted leader email

#### Scenario: Surrounding whitespace is removed from the name

- **WHEN** a team is submitted with a name that has leading or trailing whitespace around otherwise valid text
- **THEN** the team is registered under the trimmed name, and the trimmed name is what is returned and what later submissions are compared against

#### Scenario: Leader email is missing or invalid

- **WHEN** a team is submitted with a valid name and a leader email that is absent, not text, blank, too long, or not an email address
- **THEN** the submission is rejected with a validation error that identifies `leader_email` as the offending field, carrying `request.invalid_field` when it is absent or not text and otherwise the email rule's code, and no team, board definition or employee is created

#### Scenario: Name and leader email are both invalid

- **WHEN** a team is submitted with a blank name and a blank leader email
- **THEN** the rejection reports both fields, each with its own code

### Requirement: Retrieve the registered teams

The system SHALL return the registered teams ordered by name, ascending. Each returned team SHALL carry its identifier, its name, the identifier and name of its board definition, the identifier and email of its leader, and the number of its members.

#### Scenario: Registered teams are returned in order

- **WHEN** the team list is requested and one or more teams have been registered
- **THEN** every registered team is returned, in ascending order of name, each carrying its board definition, its leader and its member count

#### Scenario: Member count follows membership changes

- **WHEN** a member is added to a team and the team list is then requested
- **THEN** that team's member count is one higher than before, and its leader is unchanged

#### Scenario: No teams have been registered

- **WHEN** the team list is requested and no teams have been registered
- **THEN** an empty list is returned rather than an error
