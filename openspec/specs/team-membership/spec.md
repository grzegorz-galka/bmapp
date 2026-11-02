## Purpose

Records who belongs to which team and who leads it. An employee is a person identified by email. They are recorded the first time they are assigned to a team, can be a member of many teams, and can lead any of them. Every team has exactly one leader, always one of its own members.

## Requirements

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

The system SHALL return a single team by its identifier, carrying its identifier, its name, the identifier and name of its board definition, and its members. Each member SHALL carry the employee identifier, the email, the display name, whether that member is the team's leader and whether that member is one of its leader deputies. Members SHALL be ordered by email, ascending. Exactly one member SHALL be marked as leader, and no member SHALL be marked as both leader and deputy. A team identifier that matches no team SHALL be rejected with the code `team.not_found` and no offending field.

#### Scenario: A team is returned with its members

- **WHEN** a team with a leader and two further members is requested
- **THEN** the team is returned with all three members ordered by email, each with its display name, the leader marked as leader and the other two not, and none marked as deputy

#### Scenario: A team is returned with its deputies

- **WHEN** a team with a leader, one deputy and one ordinary member is requested
- **THEN** the deputy is marked as deputy and not as leader, and the leader and the ordinary member are not marked as deputy

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

The system SHALL remove a member from a team, identified by the employee's identifier. The response SHALL be the team with its remaining members. Removing a deputy SHALL remove them from the team and so end their being a deputy; appointed again later, they start as an ordinary member. The team's leader SHALL NOT be removed: removing the leader SHALL be rejected with the code `team_member.is_leader` and the team left unchanged, so that leadership must be handed over first. Removing an employee who is not a member of the team SHALL be rejected with the code `team_member.not_found`. Removing from a team that does not exist SHALL be rejected with the code `team.not_found`.

#### Scenario: A member is removed

- **WHEN** a member who is not the leader is removed from a team
- **THEN** they no longer appear among the team's members, the leader is unchanged, and their employee record and other memberships remain

#### Scenario: A deputy is removed

- **WHEN** a deputy is removed from a team and is later added to it again
- **THEN** after the removal they are not among its members, and after the addition they are a member who is not a deputy

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

The system SHALL make a member of a team its leader, identified by the employee's identifier. The previous leader SHALL stay a member and stop being the leader, so that the team has exactly one leader at every moment, including when two handovers for the same team are requested at the same time. A deputy made leader SHALL stop being a deputy; the previous leader SHALL become an ordinary member, not a deputy, and every other deputy SHALL stay one. Making the current leader the leader again SHALL succeed and change nothing. Making leader an employee who is not a member of the team SHALL be rejected with the code `team_leader.not_member` against the field `employee_id`. Handing over the leadership of a team that does not exist SHALL be rejected with the code `team.not_found`. The response SHALL be the team with its members.

#### Scenario: Leadership passes to another member

- **WHEN** a member who is not the leader is made the leader
- **THEN** that member is the team's only leader, and the previous leader remains a member who is not the leader

#### Scenario: Leadership passes to a deputy

- **WHEN** one of two deputies of a team is made its leader
- **THEN** that member is the leader and no longer a deputy, the previous leader is an ordinary member, and the other deputy is still a deputy

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

The team page SHALL ask for the leader's email when a team is registered, and SHALL show each registered team with its leader's display name and its member count, together with a link to that team's members page. The members page SHALL show the team's name and its members by display name, each with their email beside it, with the leader and each leader deputy marked by a word as well as by any visual marker. It SHALL let the user add a member by email, remove any member who is not the leader, make any member who is not the leader the leader, appoint any ordinary member a deputy, and revoke any deputy. The leader SHALL offer no remove, make-leader, appoint or revoke action. A rejection SHALL be shown next to the field or member it concerns, in the active language, translated from its code. A members page for a team that does not exist SHALL say so and link back to the team list. Every text on both pages SHALL come from the catalogues of both languages.

#### Scenario: A team is registered with its leader from the page

- **WHEN** the user enters a team name and the leader email `jan.kowalski@example.com` and registers the team
- **THEN** the team appears in the list with the leader "Jan Kowalski" and a member count of one, and both fields are cleared

#### Scenario: A rejected leader email is shown on its field

- **WHEN** the user registers a team with a malformed leader email
- **THEN** the translated message for `employee_email.invalid` is shown next to the leader email field and announced to assistive technology, and the entered name is kept

#### Scenario: A member is added from the members page

- **WHEN** the user enters an email on a team's members page and adds it
- **THEN** the member appears in the list by display name with the email beside it, not marked as leader or deputy, and the email field is cleared

#### Scenario: A duplicate member is reported

- **WHEN** the user adds the email of someone already in the team
- **THEN** the translated message for `team_member.duplicate` is shown next to the email field and the list is unchanged

#### Scenario: A member is removed from the members page

- **WHEN** the user removes a member who is not the leader
- **THEN** that member disappears from the list

#### Scenario: The leader offers no remove action

- **WHEN** a team's members page is shown
- **THEN** every member except the leader offers a remove action and a make-leader action, and the leader offers neither and offers no appoint or revoke action

#### Scenario: Leadership is handed over from the members page

- **WHEN** the user makes another member the leader
- **THEN** that member is marked as leader, the previous leader is no longer marked, and the previous leader now offers the remove and make-leader actions

#### Scenario: A deputy is appointed from the members page

- **WHEN** the user appoints an ordinary member a deputy
- **THEN** that member is marked as leader deputy, offers a revoke action instead of an appoint action, and the leader is unchanged

#### Scenario: A deputy is revoked from the members page

- **WHEN** the user revokes a deputy
- **THEN** that member is no longer marked as leader deputy and offers an appoint action again

#### Scenario: The members page of a missing team

- **WHEN** the user opens the members page of a team identifier that no team has
- **THEN** the page says the team was not found and offers a link back to the team list

#### Scenario: The members page reads in Polish

- **WHEN** the members page is shown with Polish as the active language
- **THEN** its heading, labels, actions, leader and deputy markers and messages are in Polish

### Requirement: Appoint a leader deputy

The system SHALL make a member of a team one of its leader deputies, identified by the employee's identifier, and return the team with its members. A team MAY have any number of deputies, none until one is appointed. Re-appointing a deputy SHALL change nothing. A non-member SHALL be rejected with `team_deputy.not_member`, the leader with `team_deputy.is_leader`, both against `employee_id`; a missing team with `team.not_found`.

#### Scenario: A member is appointed deputy

- **WHEN** a member who is neither the leader nor a deputy is appointed deputy
- **THEN** that member is marked as a deputy, the leader is unchanged, and the team is returned with its members

#### Scenario: A team has several deputies

- **WHEN** two different members of a team are appointed deputy one after the other
- **THEN** both are marked as deputies and the team still has exactly one leader

#### Scenario: A deputy is appointed again

- **WHEN** a member who is already a deputy is appointed deputy
- **THEN** the request succeeds and the team's members are unchanged

#### Scenario: The leader cannot be a deputy

- **WHEN** the team's leader is appointed deputy
- **THEN** the request is rejected with the code `team_deputy.is_leader` against the field `employee_id`, and the leader is not marked as a deputy

#### Scenario: The deputy is not a member

- **WHEN** an employee who does not belong to a team is appointed its deputy
- **THEN** the request is rejected with the code `team_deputy.not_member` against the field `employee_id`, and nothing is changed

#### Scenario: A deputy of a team that does not exist

- **WHEN** a deputy is appointed for a team identifier that no team has
- **THEN** the request is rejected as not found with the code `team.not_found`

### Requirement: Revoke a leader deputy

The system SHALL make a deputy of a team an ordinary member again, identified by the employee's identifier. The employee SHALL stay a member. Revoking a member who is not a deputy SHALL succeed and change nothing. Revoking for an employee who is not a member SHALL be rejected with `team_member.not_found`, and for a missing team with `team.not_found`. The response SHALL be the team with its members.

#### Scenario: A deputy is revoked

- **WHEN** a deputy of a team is revoked
- **THEN** they remain a member of the team, are no longer marked as a deputy, and the team's other deputies are unchanged

#### Scenario: Revoking a member who is not a deputy

- **WHEN** a member who is not a deputy is revoked
- **THEN** the request succeeds and the team's members are unchanged

#### Scenario: Revoking someone who is not a member

- **WHEN** a deputy is revoked for an employee who does not belong to the team
- **THEN** the request is rejected as not found with the code `team_member.not_found`

### Requirement: Deputies are independent per team

Being a deputy of one team SHALL say nothing about any other team. An employee MAY be a deputy of one team, the leader of another and an ordinary member of a third.

#### Scenario: A deputy here leads elsewhere

- **WHEN** an employee is appointed deputy of one team while leading another
- **THEN** they are marked as deputy of the first and as leader of the second, and neither team's other members change

### Requirement: An employee has a name and a surname

An employee SHALL carry an optional name and an optional surname. Each SHALL be
stored trimmed, a blank value SHALL be stored as none, and each SHALL be at most 100
characters. Assigning an employee to a team SHALL NOT set or change either. They are
set only as the `authentication` capability describes: from the broker's claims, or
in development mode at the first sign-in.

#### Scenario: A new employee has no name

- **WHEN** an employee is recorded by being added to a team
- **THEN** the employee has no name and no surname stored

#### Scenario: Reassignment keeps the name

- **WHEN** an employee whose name and surname are stored is added to another team
- **THEN** their stored name and surname are unchanged

### Requirement: A person is named by a display name

A person's display name SHALL be their stored name and surname joined by a space,
or whichever one is stored. When neither is stored, it SHALL be derived from the
part of the email before the `@`, split on `.` and `_`, empty parts dropped, each
hyphen-separated piece capitalised: one part is the name; with more, the first is
the name and the rest, joined by spaces, the surname.

#### Scenario: Two parts give a name and a surname

- **WHEN** the display name of `jan.kowalski@example.com` is needed and nothing is
  stored
- **THEN** it is "Jan Kowalski", with the name "Jan" and the surname "Kowalski"

#### Scenario: One part gives a name only

- **WHEN** the display name of `admin@example.com` is needed and nothing is stored
- **THEN** it is "Admin", with the name "Admin" and no surname

#### Scenario: More parts make up the surname

- **WHEN** the display name of `anna.maria.nowak@example.com` is needed and nothing is
  stored
- **THEN** it is "Anna Maria Nowak", with the name "Anna" and the surname "Maria Nowak"

#### Scenario: An underscore splits and a hyphen does not

- **WHEN** the display name of `ewa_kowalska-nowak@example.com` is needed and nothing is
  stored
- **THEN** it is "Ewa Kowalska-Nowak"

#### Scenario: Stored values win over the email

- **WHEN** the display name of `grzegorz.galka@pse.pl` is needed and the name "Grzegorz"
  and the surname "Gałka" are stored
- **THEN** it is "Grzegorz Gałka"

#### Scenario: Only a surname is stored

- **WHEN** the display name of `jan.kowalski@example.com` is needed and only the surname
  "Kowalski" is stored
- **THEN** it is "Kowalski"

### Requirement: Every person a response names carries their display name

Wherever a response names a person by email, it SHALL also carry that person's display
name. This covers members, leaders, meeting hosts, metric owners, the people who record
or correct values and thresholds, the people responsible for problems and tasks, pulse
respondents, the people who owe data, and the signed-in person. An ordering by email
SHALL stay an ordering by email.

#### Scenario: A meeting's host carries a display name

- **WHEN** a meeting hosted by `jan.kowalski@example.com`, with nothing stored as a name,
  is read
- **THEN** its host carries the email `jan.kowalski@example.com` and the display name
  "Jan Kowalski"

#### Scenario: A responsible member carries a stored name

- **WHEN** a problem whose responsible member has the name "Grzegorz" and the surname
  "Gałka" stored is read
- **THEN** its responsible member carries the display name "Grzegorz Gałka"

### Requirement: The interface names a person by display name

The interface SHALL name a person by their display name wherever it identifies them.
It SHALL show the email only where the address itself is the point: beside the name on
the members page, in the account control's menu, in fields where an email is entered,
and in the addresses the readiness panel copies.

#### Scenario: The board names the responsible member

- **WHEN** the board shows a task whose responsible member's display name is
  "Jan Kowalski"
- **THEN** the task's row reads "Jan Kowalski" and not the email

#### Scenario: The pulse answers name the respondent

- **WHEN** a member who may read individual answers views the pulse answers of a meeting
  answered by `anna.nowak@example.com`
- **THEN** the answer is labelled "Anna Nowak"
