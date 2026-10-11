## ADDED Requirements

### Requirement: A team's leader configures its metrics and thresholds

The system SHALL permit the leader of a team, as well as an administrator, to add, change, retire, bring back and delete the metrics of that team's board, and to record threshold versions for them. It SHALL refuse those writes to anyone else, including a member who does not lead the team.

What the team measures, and what counts as green, is part of configuring its board.

#### Scenario: A leader adds a metric and its threshold

- **WHEN** the leader of a team adds a metric to its board and records a threshold version for it
- **THEN** both are recorded as the `metrics` capability requires

#### Scenario: An ordinary member cannot configure metrics

- **WHEN** a member of a team who does not lead it adds a metric, changes one, or records a threshold version
- **THEN** each request is refused with `auth.forbidden`, and nothing is changed

#### Scenario: An administrator configures any team's metrics

- **WHEN** an administrator who does not belong to a team records a threshold version for one of its metrics
- **THEN** the version is recorded

### Requirement: A team's members record its metric values

The system SHALL permit any member of a team, its leader included, as well as an administrator, to record values for the team's metrics at a meeting that can still be edited. It SHALL refuse that to anyone who is not a member of the team.

#### Scenario: A member records a value

- **WHEN** a member of a team who does not lead it records a value at the team's next meeting
- **THEN** the value is recorded as the `metric-values` capability requires

#### Scenario: A stranger cannot record a value

- **WHEN** an authenticated person who is not a member of a team records a value for one of its metrics
- **THEN** the request is refused with `auth.forbidden`, and nothing is recorded

### Requirement: Only an administrator corrects a frozen value

The system SHALL permit only an administrator to correct a value at a meeting that can no longer be edited. A member or leader of the team who attempts it SHALL be refused, as the `metric-values` capability requires for a frozen meeting.

Once a meeting is past its editing window, its record belongs to the organization rather than to the team.

#### Scenario: A leader cannot correct a frozen value

- **WHEN** the leader of a team, who is not an administrator, records a value with a reason at a frozen meeting of that team
- **THEN** it is rejected with `metric_value.meeting_frozen`, and the value is unchanged

#### Scenario: An administrator corrects a frozen value

- **WHEN** an administrator records a value with a reason at a frozen meeting
- **THEN** the value is changed and the correction is logged

## MODIFIED Requirements

### Requirement: The interface offers only what its viewer may do

The system SHALL offer a control for an action only to a viewer permitted to
perform it. The members page SHALL offer adding a member, removing a member and
handing over the leadership only to a viewer permitted each, and the team page
SHALL offer registering a team only to an administrator. The meetings page SHALL
offer setting the schedule only to a viewer permitted to set it, and opening,
moving, re-hosting and deleting meetings only to a viewer permitted to manage
that team's meetings. The board SHALL offer recording values only to a viewer
permitted to record them at the meeting shown, and the metric settings SHALL offer
changing metrics and thresholds only to a viewer permitted to configure the board.

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

#### Scenario: A member records values but does not configure metrics

- **WHEN** a member of a team who does not lead it opens the board at a meeting that
  can be edited, and then the metric settings
- **THEN** recording values is offered on the board, and the settings show the metrics
  and thresholds without controls to change them

#### Scenario: A frozen meeting offers recording only to an administrator

- **WHEN** a leader and then an administrator open the board at a frozen meeting
- **THEN** recording is offered to the administrator only, as a correction asking for a
  reason
