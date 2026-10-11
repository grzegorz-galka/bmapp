## MODIFIED Requirements

### Requirement: Delete a meeting

The system SHALL allow a meeting to be deleted, after which it SHALL no longer be returned and its date SHALL be free for another meeting of the team. A meeting identifier that names no meeting of that team SHALL be rejected with the code `meeting.not_found`. A meeting at which any metric value is recorded SHALL NOT be deleted: the request SHALL be rejected with the code `meeting.has_values`. A meeting at which any pulse answer is recorded SHALL NOT be deleted either: the request SHALL be rejected with the code `meeting.has_pulse_answers`.

#### Scenario: A meeting opened by mistake is deleted

- **WHEN** a meeting is deleted
- **THEN** it no longer appears among its team's meetings, and a new meeting can be opened on its date

#### Scenario: The meeting does not exist

- **WHEN** a meeting is deleted by an identifier that names no meeting of that team
- **THEN** the request is rejected with the code `meeting.not_found` and HTTP 404

#### Scenario: A meeting with values cannot be deleted

- **WHEN** a meeting at which a metric value is recorded is deleted
- **THEN** the request is rejected with the code `meeting.has_values` and HTTP 409, and the meeting and its values remain

#### Scenario: A meeting with pulse answers cannot be deleted

- **WHEN** a meeting at which a pulse answer is recorded, and no metric value, is deleted
- **THEN** the request is rejected with the code `meeting.has_pulse_answers` and HTTP 409, and the meeting and its answers remain

#### Scenario: A meeting with pulse answers can be moved

- **WHEN** a meeting at which a pulse answer is recorded, and no metric value, is moved to another free date
- **THEN** the meeting is returned on the new date, and its answers remain with it
