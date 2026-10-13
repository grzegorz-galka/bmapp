# Spec Delta

## ADDED Requirements

### Requirement: A leader deputy stands in for the leader

The system SHALL permit a leader deputy of a team every write this capability permits that team's leader, except appointing, revoking or removing a deputy, which stay with the leader and administrators. A deputy SHALL NOT hand over the leadership, which stays an administrator's. A deputy's authority SHALL reach only the team they are a deputy of.

#### Scenario: A deputy configures the board

- **WHEN** a deputy of a team, who is not an administrator, adds a metric to its board, records a threshold version for it and sets the board's meeting schedule
- **THEN** each is done as the `metrics` and `team-board` capabilities require

#### Scenario: A deputy manages ordinary members

- **WHEN** a deputy of a team adds an employee to it and then removes a member who is neither the leader nor a deputy
- **THEN** the member is added and then removed as the `team-membership` capability requires

#### Scenario: A deputy cannot hand over the leadership

- **WHEN** a deputy of a team, who is not an administrator, makes a member the leader of that team
- **THEN** the request is refused with `auth.forbidden` and the team's leader is unchanged

#### Scenario: A deputy's authority does not reach another team

- **WHEN** a deputy of one team adds a metric to the board of a team where they are an ordinary member
- **THEN** the request is refused with `auth.forbidden`, and adding it to the board of the team they are a deputy of succeeds

#### Scenario: Revoking a deputy removes the authority

- **WHEN** a deputy is revoked and then sets the board's meeting schedule
- **THEN** the request is refused with `auth.forbidden` and the schedule is unchanged

### Requirement: Only a team's leader or an administrator chooses its deputies

The system SHALL permit only the leader of a team, as well as an administrator, to appoint a deputy of that team, to revoke one, and to remove from the team a member who is a deputy. It SHALL refuse those writes to anyone else, deputies of that team included.

The leader chooses who stands in for them; a deputy SHALL NOT widen or narrow the circle of deputies they belong to.

#### Scenario: A leader appoints and revokes a deputy

- **WHEN** the leader of a team, who is not an administrator, appoints a member a deputy and then revokes them
- **THEN** both are done as the `team-membership` capability requires

#### Scenario: A deputy cannot appoint or revoke deputies

- **WHEN** a deputy of a team, who is not an administrator, appoints another member a deputy, revokes another deputy, or revokes themselves
- **THEN** each request is refused with `auth.forbidden` and the team's deputies are unchanged

#### Scenario: A deputy cannot remove another deputy

- **WHEN** a deputy of a team removes another deputy from the team
- **THEN** the request is refused with `auth.forbidden` and the team's members are unchanged

#### Scenario: An ordinary member cannot appoint a deputy

- **WHEN** a member of a team who is neither its leader nor a deputy appoints themselves or another member a deputy
- **THEN** the request is refused with `auth.forbidden` and the team's deputies are unchanged

#### Scenario: An administrator appoints a deputy of any team

- **WHEN** an administrator who does not belong to a team appoints one of its members a deputy
- **THEN** the member is appointed

## MODIFIED Requirements

### Requirement: Permission is decided per team, not per role

The system SHALL decide every write from two facts and no others: whether the
person is an administrator, and what relationship they have to the team the write
concerns. The relationship SHALL be read from the team's recorded membership — a
member is someone the team records as a member, a leader is the member the
team records as its leader, and a leader deputy is a member the team records as
one of its deputies.

The system SHALL NOT hold a role for a person. Leadership and deputyship SHALL NOT
be configured anywhere outside the team's own records, so that a person who leads
or deputises for one team holds no authority over a team they do not.

An administrator SHALL be permitted every action this capability governs.

#### Scenario: A leader's authority does not reach another team

- **WHEN** the leader of one team attempts a write that only a leader may perform on a
  team they do not lead
- **THEN** the write is refused, and performing the same write on the team they lead
  succeeds

#### Scenario: Leadership comes from the team's records

- **WHEN** leadership of a team is handed from one member to another
- **THEN** the new leader is permitted what a leader may do on that team and the
  previous leader is not, with no other change made anywhere

#### Scenario: Deputyship comes from the team's records

- **WHEN** a member of a team is appointed its deputy
- **THEN** they are permitted what a deputy may do on that team, with no other change
  made anywhere

#### Scenario: An administrator may act on any team

- **WHEN** an administrator performs a write on a team they neither lead nor belong to
- **THEN** the write succeeds

### Requirement: A team's leader manages that team's membership

The system SHALL permit the leader of a team, its leader deputies, as well as an
administrator, to add a member to that team and to remove from it a member who is
not a deputy. Removing a deputy is decided by the requirement on choosing deputies.
It SHALL refuse those writes to anyone else, including a member of that team who
neither leads it nor is its deputy.

The routine arrival and departure of people belongs to whoever runs the team, so
that an administrator is not required for it.

#### Scenario: A leader adds a member to their team

- **WHEN** the leader of a team adds an employee to it by email
- **THEN** the member is added as the `team-membership` capability requires

#### Scenario: A leader removes a member from their team

- **WHEN** the leader of a team removes one of its members who is not the leader
- **THEN** the member is removed as the `team-membership` capability requires

#### Scenario: An ordinary member cannot change membership

- **WHEN** a member of a team who neither leads it nor is its deputy adds or removes a member
- **THEN** the request is refused and the team's members are unchanged

#### Scenario: A stranger cannot change membership

- **WHEN** an authenticated person who is not a member of a team adds a member to it
- **THEN** the request is refused and the team's members are unchanged

### Requirement: The interface offers only what its viewer may do

The system SHALL offer a control for an action only to a viewer permitted to
perform it. The members page SHALL offer adding a member, removing a member,
handing over the leadership, and appointing and revoking a deputy only to a viewer
permitted each, and SHALL offer removing a deputy only to a viewer permitted to
choose deputies; the team page SHALL offer registering a team only to an administrator. The meetings page SHALL
offer setting the schedule only to a viewer permitted to set it, and opening,
moving, re-hosting and deleting meetings only to a viewer permitted to manage
that team's meetings. The board SHALL offer recording values only to a viewer
permitted to record them at the meeting shown, and the metric settings SHALL offer
changing metrics and thresholds, copying a metric and including a global metric
only to a viewer permitted to configure the board. The global metrics page SHALL
offer adding and changing global metrics and their thresholds only to an
administrator.

A viewer who may perform nothing on a page SHALL still see the page and everything
it reads, since reading is open to everyone signed in.

#### Scenario: A leader sees the controls they may use

- **WHEN** the leader of a team, who is not an administrator, opens that team's members
  page
- **THEN** adding and removing members and appointing and revoking deputies are
  offered, and handing over the leadership is not

#### Scenario: A deputy sees the controls they may use

- **WHEN** a deputy of a team, who is not an administrator, opens that team's members
  page, its meetings page and its metric settings
- **THEN** adding a member and removing an ordinary member are offered; removing a
  deputy, appointing or revoking a deputy and handing over the leadership are not; and
  setting the schedule and changing metrics and thresholds are offered

#### Scenario: An ordinary member sees no membership controls

- **WHEN** a member of a team who neither leads it nor is its deputy opens that team's
  members page
- **THEN** the team and its members are shown, and no add, remove, hand-over, appoint
  or revoke control is offered

#### Scenario: An administrator sees every control

- **WHEN** an administrator opens a team's members page
- **THEN** adding, removing, handing over the leadership and appointing and revoking
  deputies are all offered

#### Scenario: Registering a team is offered only to an administrator

- **WHEN** an authenticated person who is not an administrator opens the team page
- **THEN** the registered teams are shown and no control for registering a team is
  offered

#### Scenario: An ordinary member manages meetings but not the schedule

- **WHEN** a member of a team who neither leads it nor is its deputy opens that team's
  meetings page
- **THEN** opening, moving, re-hosting and deleting meetings are offered, and setting
  the schedule is not

#### Scenario: A stranger sees the meetings and no controls

- **WHEN** an authenticated person who is not a member of a team opens that team's
  meetings page
- **THEN** the schedule and the meetings are shown, and no control for the schedule or
  the meetings is offered

#### Scenario: A member records values but does not configure metrics

- **WHEN** a member of a team who neither leads it nor is its deputy opens the board at
  a meeting that can be edited, and then the metric settings
- **THEN** recording values is offered on the board, and the settings show the metrics
  and thresholds without controls to change them, to copy a metric or to include a
  global metric

#### Scenario: A frozen meeting offers recording only to an administrator

- **WHEN** a leader and then an administrator open the board at a frozen meeting
- **THEN** recording is offered to the administrator only, as a correction asking for a
  reason

#### Scenario: A leader sees the global metrics without controls

- **WHEN** the leader of a team, who is not an administrator, opens the global metrics
  page, and then an administrator opens it
- **THEN** the leader sees the catalogue with no control to add or change a global metric
  or its thresholds, and the administrator is offered all of them

### Requirement: A team's leader sets its meeting schedule

The system SHALL permit the leader of a team, its leader deputies, as well as an administrator, to set the meeting schedule of that team's board. It SHALL refuse it to anyone else, including a member of the team who neither leads it nor is its deputy.

When a team meets is part of configuring its board, which belongs to whoever runs the team.

#### Scenario: A leader sets the schedule of their team

- **WHEN** the leader of a team sets its board's meeting schedule
- **THEN** the schedule is set as the `team-board` capability requires

#### Scenario: An ordinary member cannot set the schedule

- **WHEN** a member of a team who neither leads it nor is its deputy sets its board's meeting schedule
- **THEN** the request is refused with the code `auth.forbidden` and the schedule is unchanged

#### Scenario: An administrator sets any team's schedule

- **WHEN** an administrator who does not belong to a team sets its board's meeting schedule
- **THEN** the schedule is set

### Requirement: A team's leader configures its metrics and thresholds

The system SHALL permit the leader of a team, its leader deputies, as well as an administrator, to add, change, retire, bring back and delete the metrics of that team's board, to record threshold versions for them, to copy a metric of any board onto it, and to include, place and remove global metrics on it. It SHALL refuse those writes to anyone else, including a member who neither leads the team nor is its deputy.

What the team measures, and what counts as green, is part of configuring its board. Copying needs no permission on the source board, since anyone signed in may read it.

#### Scenario: A leader adds a metric and its threshold

- **WHEN** the leader of a team adds a metric to its board and records a threshold version for it
- **THEN** both are recorded as the `metrics` capability requires

#### Scenario: An ordinary member cannot configure metrics

- **WHEN** a member of a team who neither leads it nor is its deputy adds a metric, changes one, records a threshold version, copies a metric onto the board or includes a global metric in it
- **THEN** each request is refused with `auth.forbidden`, and nothing is changed

#### Scenario: An administrator configures any team's metrics

- **WHEN** an administrator who does not belong to a team records a threshold version for one of its metrics
- **THEN** the version is recorded

#### Scenario: A leader copies from a board they do not belong to

- **WHEN** the leader of a team copies a metric of another team's board, of which they are not a member, onto their own board
- **THEN** the copy is added, and copying the same metric onto a board they do not lead is refused with `auth.forbidden`

#### Scenario: A leader includes a global metric

- **WHEN** the leader of a team, who is not an administrator, includes a global metric in its board and changes its placement there
- **THEN** both are done as the `global-metrics` capability requires
