## Purpose

Records who belongs to which team and who leads it. An employee is a person identified by email. They are recorded the first time they are assigned to a team, can be a member of many teams, and can lead any of them. Every team has exactly one leader, always one of its own members.

## ADDED Requirements

### Requirement: Employees are identified by email

The system SHALL identify an employee by email address. An email SHALL be stored with leading and trailing whitespace removed and in lower case, and two emails SHALL denote the same employee when they are equal after that normalisation. An email SHALL be at most 254 characters once trimmed, SHALL contain exactly one `@` with at least one character before it, SHALL have a domain after it that contains a `.` that is neither its first nor its last character, and SHALL contain no whitespace.

An employee SHALL be recorded the first time their email is assigned to a team, either as a new team's leader or as an added member, and SHALL be reused on every later assignment. An employee SHALL NOT be deleted when they leave a team or belong to no team. Each employee SHALL be assigned an identifier that is unique and stable for the life of the record.

The rejection codes are `employee_email.blank` for an email that is empty or whitespace, `employee_email.too_long` for one over the maximum length, and `employee_email.invalid` for one that breaks any other rule above. The offending field is whichever field carried the email.

#### Scenario: An email is normalised before it is stored

- **WHEN** an employee is assigned to a team under the email `  Jan.Kowalski@Example.COM `
- **THEN** the employee is recorded and returned with the email `jan.kowalski@example.com`

#### Scenario: The same person is recognised in a different spelling

- **WHEN** an employee recorded as `jan.kowalski@example.com` is assigned to another team as `JAN.KOWALSKI@example.com`
- **THEN** the existing employee is assigned and no second employee is recorded

#### Scenario: An email is blank

- **WHEN** an email that is empty or consists only of whitespace is submitted for assignment
- **THEN** the submission is rejected with the code `employee_email.blank` and nothing is recorded

#### Scenario: An email is too long

- **WHEN** an email longer than 254 characters after trimming is submitted for assignment
- **THEN** the submission is rejected with the code `employee_email.too_long` and nothing is recorded

#### Scenario: An email is malformed

- **WHEN** an email with no `@`, more than one `@`, nothing before the `@`, no `.` inside the domain, or whitespace inside it is submitted for assignment
- **THEN** the submission is rejected with the code `employee_email.invalid` and nothing is recorded

#### Scenario: Leaving a team does not delete the employee

- **WHEN** a member is removed from their only team and is later added to a team again under the same email
- **THEN** they are assigned under the identifier they had before

### Requirement: Read a team with its members

The system SHALL return a single team by its identifier, carrying its identifier, its name, the identifier and name of its board definition, and its members. Each member SHALL carry the employee identifier, the email and whether that member is the team's leader. Members SHALL be ordered by email, ascending. Exactly one member SHALL be marked as leader. A team identifier that matches no team SHALL be rejected with the code `team.not_found` and no offending field.

#### Scenario: A team is returned with its members

- **WHEN** a team with a leader and two further members is requested
- **THEN** the team is returned with all three members ordered by email, the leader marked as leader and the other two not

#### Scenario: The team does not exist

- **WHEN** a team is requested by an identifier that no team has
- **THEN** the request is rejected as not found with the code `team.not_found`

### Requirement: Add a member to a team

The system SHALL add an employee to a team by email, recording the employee first if no employee with that email exists. The new member SHALL NOT be the leader. The response SHALL be the team with its members, as returned when a team is read. Adding an employee who is already a member of the team SHALL be rejected with the code `team_member.duplicate` against the field `email`. Adding a member to a team that does not exist SHALL be rejected with the code `team.not_found`. A rejected addition SHALL record no employee and no membership.

#### Scenario: A new employee is added

- **WHEN** an email that no employee has is added to a team
- **THEN** an employee is recorded with that email, becomes a member of the team who is not the leader, and the team is returned with the new member among its members

#### Scenario: An existing employee is added

- **WHEN** the email of an employee who belongs to another team is added to a team
- **THEN** that employee becomes a member of this team as well, keeps their membership of the other team, and no new employee is recorded

#### Scenario: The employee is already a member

- **WHEN** an email is added to a team that the employee with that email already belongs to, in any letter case
- **THEN** the addition is rejected with the code `team_member.duplicate` against the field `email`, and the team's members are unchanged

#### Scenario: A member is added to a team that does not exist

- **WHEN** an email is added to a team identifier that no team has
- **THEN** the addition is rejected as not found with the code `team.not_found`, and no employee is recorded

### Requirement: Remove a member from a team

The system SHALL remove a member from a team, identified by the employee's identifier. The response SHALL be the team with its remaining members. The team's leader SHALL NOT be removed: removing the leader SHALL be rejected with the code `team_member.is_leader` and the team left unchanged, so that leadership must be handed over first. Removing an employee who is not a member of the team SHALL be rejected with the code `team_member.not_found`. Removing from a team that does not exist SHALL be rejected with the code `team.not_found`.

#### Scenario: A member is removed

- **WHEN** a member who is not the leader is removed from a team
- **THEN** they no longer appear among the team's members, the leader is unchanged, and their employee record and other memberships remain

#### Scenario: The leader cannot be removed

- **WHEN** the team's leader is removed from the team
- **THEN** the removal is rejected with the code `team_member.is_leader` and the leader remains a member and the leader

#### Scenario: The employee is not a member

- **WHEN** an employee who does not belong to a team is removed from it
- **THEN** the removal is rejected as not found with the code `team_member.not_found`

#### Scenario: A member is removed from a team that does not exist

- **WHEN** a removal is requested for a team identifier that no team has
- **THEN** the removal is rejected as not found with the code `team.not_found`

### Requirement: Hand over the leadership of a team

The system SHALL make a member of a team its leader, identified by the employee's identifier. The previous leader SHALL stay a member and stop being the leader, so that the team has exactly one leader at every moment, including when two handovers for the same team are requested at the same time. Making the current leader the leader again SHALL succeed and change nothing. Making leader an employee who is not a member of the team SHALL be rejected with the code `team_leader.not_member` against the field `employee_id`. Handing over the leadership of a team that does not exist SHALL be rejected with the code `team.not_found`. The response SHALL be the team with its members.

#### Scenario: Leadership passes to another member

- **WHEN** a member who is not the leader is made the leader
- **THEN** that member is the team's only leader, and the previous leader remains a member who is not the leader

#### Scenario: The current leader is made leader again

- **WHEN** the team's current leader is made the leader
- **THEN** the request succeeds and the team's members and leader are unchanged

#### Scenario: The new leader is not a member

- **WHEN** an employee who does not belong to a team is made its leader
- **THEN** the request is rejected with the code `team_leader.not_member` against the field `employee_id`, and the team's leader is unchanged

#### Scenario: Leadership of a team that does not exist

- **WHEN** a handover is requested for a team identifier that no team has
- **THEN** the request is rejected as not found with the code `team.not_found`

#### Scenario: Concurrent handovers leave one leader

- **WHEN** two different members of the same team are made its leader by requests that run at the same time
- **THEN** afterwards the team has exactly one leader, and it is one of those two members

### Requirement: An employee may belong to and lead many teams

The system SHALL allow one employee to be a member of any number of teams and the leader of any number of the teams they belong to. Each team's membership and leadership SHALL be independent of every other team's.

#### Scenario: One employee leads two teams

- **WHEN** two teams are registered with the same leader email
- **THEN** both teams are registered, the same employee leads both, and the employee is recorded once

#### Scenario: Leaving one team leaves the others untouched

- **WHEN** an employee who belongs to two teams is removed from one of them
- **THEN** they remain a member of the other team, with the same leadership there as before

### Requirement: Members are managed from the team page

The team page SHALL ask for the leader's email when a team is registered, and SHALL show each registered team with its leader's email and its member count, together with a link to that team's members page. The members page SHALL show the team's name and its members by email, with the leader marked by a word as well as by any visual marker. It SHALL let the user add a member by email, remove any member who is not the leader, and make any member who is not the leader the leader. The leader SHALL offer no remove action. A rejection SHALL be shown next to the field or member it concerns, in the active language, translated from its code. A members page for a team that does not exist SHALL say so and link back to the team list. Every text on both pages SHALL come from the catalogues of both languages.

#### Scenario: A team is registered with its leader from the page

- **WHEN** the user enters a team name and a leader email and registers the team
- **THEN** the team appears in the list with that leader's email and a member count of one, and both fields are cleared

#### Scenario: A rejected leader email is shown on its field

- **WHEN** the user registers a team with a malformed leader email
- **THEN** the translated message for `employee_email.invalid` is shown next to the leader email field and announced to assistive technology, and the entered name is kept

#### Scenario: A member is added from the members page

- **WHEN** the user enters an email on a team's members page and adds it
- **THEN** the member appears in the list, not marked as leader, and the email field is cleared

#### Scenario: A duplicate member is reported

- **WHEN** the user adds the email of someone already in the team
- **THEN** the translated message for `team_member.duplicate` is shown next to the email field and the list is unchanged

#### Scenario: A member is removed from the members page

- **WHEN** the user removes a member who is not the leader
- **THEN** that member disappears from the list

#### Scenario: The leader offers no remove action

- **WHEN** a team's members page is shown
- **THEN** every member except the leader offers a remove action and a make-leader action, and the leader offers neither

#### Scenario: Leadership is handed over from the members page

- **WHEN** the user makes another member the leader
- **THEN** that member is marked as leader, the previous leader is no longer marked, and the previous leader now offers the remove and make-leader actions

#### Scenario: The members page of a missing team

- **WHEN** the user opens the members page of a team identifier that no team has
- **THEN** the page says the team was not found and offers a link back to the team list

#### Scenario: The members page reads in Polish

- **WHEN** the members page is shown with Polish as the active language
- **THEN** its heading, labels, actions, leader marker and messages are in Polish
