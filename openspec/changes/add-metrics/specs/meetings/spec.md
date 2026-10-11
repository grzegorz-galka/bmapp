## MODIFIED Requirements

### Requirement: Move a meeting

The system SHALL allow a meeting's date, its start time, or both to be changed. The new date SHALL be subject to the same rules as when a meeting is opened. The meeting SHALL keep its identifier and its host. The response SHALL be the meeting as changed. A meeting identifier that names no meeting of that team SHALL be rejected with the code `meeting.not_found`. Once any metric value is recorded at a meeting, a change of its date SHALL be rejected with the code `meeting.has_values`, because its values are judged against the thresholds in force on that date. Its start time MAY still change.

#### Scenario: A meeting is rescheduled

- **WHEN** a meeting is moved to a date on which its team holds no other meeting, at a new start time
- **THEN** the meeting is returned with the new date and start time, the same identifier and the same host

#### Scenario: A meeting is moved onto a date already taken

- **WHEN** a meeting is moved to a date on which its team already holds another meeting
- **THEN** the request is rejected with the code `meeting_date.taken` against the field `date`, and the meeting is unchanged

#### Scenario: Only the start time changes

- **WHEN** a meeting's start time is changed and its date is left as it was
- **THEN** the meeting is returned on the same date at the new start time

#### Scenario: The meeting does not exist

- **WHEN** a meeting is moved by an identifier that names no meeting of that team, including a meeting of another team
- **THEN** the request is rejected with the code `meeting.not_found` and HTTP 404

#### Scenario: A meeting with values cannot change its date

- **WHEN** a meeting at which a metric value is recorded is moved to another date
- **THEN** the request is rejected with the code `meeting.has_values` and HTTP 409, and the meeting is unchanged

#### Scenario: A meeting with values can change its start time

- **WHEN** the start time of a meeting at which a metric value is recorded is changed, and its date is left as it was
- **THEN** the meeting is returned at the new start time

### Requirement: Delete a meeting

The system SHALL allow a meeting to be deleted, after which it SHALL no longer be returned and its date SHALL be free for another meeting of the team. A meeting identifier that names no meeting of that team SHALL be rejected with the code `meeting.not_found`. A meeting at which any metric value is recorded SHALL NOT be deleted: the request SHALL be rejected with the code `meeting.has_values`.

#### Scenario: A meeting opened by mistake is deleted

- **WHEN** a meeting is deleted
- **THEN** it no longer appears among its team's meetings, and a new meeting can be opened on its date

#### Scenario: The meeting does not exist

- **WHEN** a meeting is deleted by an identifier that names no meeting of that team
- **THEN** the request is rejected with the code `meeting.not_found` and HTTP 404

#### Scenario: A meeting with values cannot be deleted

- **WHEN** a meeting at which a metric value is recorded is deleted
- **THEN** the request is rejected with the code `meeting.has_values` and HTTP 409, and the meeting and its values remain
