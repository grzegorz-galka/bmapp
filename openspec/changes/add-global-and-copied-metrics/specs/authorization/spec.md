## ADDED Requirements

### Requirement: Only an administrator defines global metrics

The system SHALL permit only an administrator to add, change, retire, bring back and delete a global metric, and to record its threshold versions. It SHALL refuse those writes to anyone else, a team's leader included, with `auth.forbidden`.

A metric measured the same way across the organization is the organization's decision, not one team's.

#### Scenario: An administrator defines a global metric and its threshold

- **WHEN** an administrator adds a global metric and records a threshold version for it
- **THEN** both are recorded as the `global-metrics` capability requires

#### Scenario: A leader cannot define a global metric

- **WHEN** the leader of a team, who is not an administrator, adds a global metric, changes or retires one, or records a threshold version for one
- **THEN** each request is refused with `auth.forbidden`, and nothing is changed

## MODIFIED Requirements

### Requirement: A team's leader configures its metrics and thresholds

The system SHALL permit the leader of a team, as well as an administrator, to add, change, retire, bring back and delete the metrics of that team's board, to record threshold versions for them, to copy a metric of any board onto it, and to include, place and remove global metrics on it. It SHALL refuse those writes to anyone else, including a member who does not lead the team.

What the team measures, and what counts as green, is part of configuring its board. Copying needs no permission on the source board, since anyone signed in may read it.

#### Scenario: A leader adds a metric and its threshold

- **WHEN** the leader of a team adds a metric to its board and records a threshold version for it
- **THEN** both are recorded as the `metrics` capability requires

#### Scenario: An ordinary member cannot configure metrics

- **WHEN** a member of a team who does not lead it adds a metric, changes one, records a threshold version, copies a metric onto the board or includes a global metric in it
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

### Requirement: The interface offers only what its viewer may do

The system SHALL offer a control for an action only to a viewer permitted to
perform it. The members page SHALL offer adding a member, removing a member and
handing over the leadership only to a viewer permitted each, and the team page
SHALL offer registering a team only to an administrator. The meetings page SHALL
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
