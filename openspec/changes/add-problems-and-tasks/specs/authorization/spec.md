## ADDED Requirements

### Requirement: A team's members keep its problems and tasks

The system SHALL permit any member of a team, its leader included, and an administrator, to raise the team's problems and tasks and to change its active ones. It SHALL refuse that to anyone else with `auth.forbidden`. Reading a team's problems and tasks, active or archived, SHALL be open to anyone signed in.

#### Scenario: A member raises a task

- **WHEN** a member of a team who does not lead it raises a task on that team
- **THEN** the task is recorded as the `problems-and-tasks` capability requires

#### Scenario: An administrator closes a problem

- **WHEN** an administrator who is not a member of a team moves one of its problems to `act`
- **THEN** the problem is closed and archived

#### Scenario: A stranger cannot raise or change an item

- **WHEN** an authenticated person who is not a member of a team raises a problem on it, or changes one of its tasks
- **THEN** the request is refused with `auth.forbidden` and HTTP 403, and nothing is recorded or changed

#### Scenario: A stranger reads the items

- **WHEN** an authenticated person who is not a member of a team reads its active and its archived problems and tasks
- **THEN** both are returned

#### Scenario: The refusal comes before the archive

- **WHEN** a stranger changes an archived task of a team
- **THEN** the request is refused with `auth.forbidden`, not `task.archived`

### Requirement: The problems and tasks offer only what their viewer may do

The board SHALL offer adding a problem or a task, opening an entry to change it, moving its stage and raising a task from a problem only to a viewer permitted to keep that team's problems and tasks. Any other viewer SHALL see the same lists, read-only. The Archived view SHALL offer no change to anyone.

#### Scenario: A member sees the controls

- **WHEN** a member of a team opens its board
- **THEN** adding a problem and a task is offered, and each entry's stage can be moved and the entry opened for changing

#### Scenario: A stranger sees the lists without controls

- **WHEN** an authenticated person who is not a member of a team opens its board
- **THEN** the active problems and tasks are shown, with no control to add one, to move a stage or to change an entry

#### Scenario: Nobody changes an archived item

- **WHEN** an administrator opens a team's Archived view
- **THEN** the archived items are shown with no control to change, reopen or delete them
