## ADDED Requirements

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

## MODIFIED Requirements

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
