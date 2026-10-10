## ADDED Requirements

### Requirement: A team's leader sets its meeting schedule

The system SHALL permit the leader of a team, as well as an administrator, to set the meeting schedule of that team's board. It SHALL refuse it to anyone else, including a member of the team who does not lead it.

When a team meets is part of configuring its board, which belongs to whoever runs the team.

#### Scenario: A leader sets the schedule of their team

- **WHEN** the leader of a team sets its board's meeting schedule
- **THEN** the schedule is set as the `team-board` capability requires

#### Scenario: An ordinary member cannot set the schedule

- **WHEN** a member of a team who does not lead it sets its board's meeting schedule
- **THEN** the request is refused with the code `auth.forbidden` and the schedule is unchanged

#### Scenario: An administrator sets any team's schedule

- **WHEN** an administrator who does not belong to a team sets its board's meeting schedule
- **THEN** the schedule is set

### Requirement: A team's members manage its meetings

The system SHALL permit any member of a team, its leader included, as well as an administrator, to open a meeting for that team, to move one of its meetings, to name or clear its host, and to delete it. It SHALL refuse those writes to anyone who is not a member of the team.

Holding the meeting is the team's shared work, and it does not wait on the leader.

#### Scenario: A member opens a meeting

- **WHEN** a member of a team who does not lead it opens a meeting for that team
- **THEN** the meeting is opened as the `meetings` capability requires

#### Scenario: A member changes a meeting

- **WHEN** a member of a team moves one of its meetings, names its host, and then deletes it
- **THEN** each change is made as the `meetings` capability requires

#### Scenario: A stranger cannot open or change a meeting

- **WHEN** an authenticated person who is not a member of a team opens a meeting for it, or moves, re-hosts or deletes one of its meetings
- **THEN** each request is refused with the code `auth.forbidden` and the team's meetings are unchanged

#### Scenario: A member of another team cannot manage this team's meetings

- **WHEN** the leader of one team opens a meeting for a team they do not belong to
- **THEN** the request is refused, and opening a meeting for their own team succeeds

#### Scenario: An administrator manages any team's meetings

- **WHEN** an administrator who does not belong to a team opens a meeting for it
- **THEN** the meeting is opened

## MODIFIED Requirements

### Requirement: The interface offers only what its viewer may do

The system SHALL offer a control for an action only to a viewer permitted to
perform it. The members page SHALL offer adding a member, removing a member and
handing over the leadership only to a viewer permitted each, and the team page
SHALL offer registering a team only to an administrator. The meetings page SHALL
offer setting the schedule only to a viewer permitted to set it, and opening,
moving, re-hosting and deleting meetings only to a viewer permitted to manage
that team's meetings.

A viewer who may perform nothing on a page SHALL still see the page and everything
it reads, since reading is open to everyone signed in.

#### Scenario: A leader sees the controls they may use

- **WHEN** the leader of a team, who is not an administrator, opens that team's members
  page
- **THEN** adding and removing members is offered, and handing over the leadership is
  not

#### Scenario: An ordinary member sees no membership controls

- **WHEN** a member of a team who does not lead it opens that team's members page
- **THEN** the team and its members are shown, and no add, remove or hand-over control
  is offered

#### Scenario: An administrator sees every control

- **WHEN** an administrator opens a team's members page
- **THEN** adding, removing and handing over the leadership are all offered

#### Scenario: Registering a team is offered only to an administrator

- **WHEN** an authenticated person who is not an administrator opens the team page
- **THEN** the registered teams are shown and no control for registering a team is
  offered

#### Scenario: An ordinary member manages meetings but not the schedule

- **WHEN** a member of a team who does not lead it opens that team's meetings page
- **THEN** opening, moving, re-hosting and deleting meetings are offered, and setting
  the schedule is not

#### Scenario: A stranger sees the meetings and no controls

- **WHEN** an authenticated person who is not a member of a team opens that team's
  meetings page
- **THEN** the schedule and the meetings are shown, and no control for the schedule or
  the meetings is offered
