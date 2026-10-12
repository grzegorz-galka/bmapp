## Purpose

Keeps the problems a team identifies at its board meetings and the tasks it agrees there, follows each through the PDCA stages to its close, archives it when closed, and presents the active ones on the board and the closed ones in its Archived view.

## Requirements

### Requirement: Raise a problem

The system SHALL allow a problem to be raised on a team with a summary, a reason, a solution proposal, a responsible person, a due date, a metric it concerns and a stage. Only the summary SHALL be required. Texts SHALL be trimmed; the summary SHALL be at most 500 characters, the reason and the solution proposal at most 4000 each, blank ones stored as empty. A problem SHALL be returned with when it was raised.

#### Scenario: A problem is raised

- **WHEN** a member raises a problem on their team with the summary "Builds are flaky", the reason "Shared test database" and no other field
- **THEN** the problem is returned with that summary and reason, an empty solution proposal, no responsible person, no due date, no metric, the stage `not_started`, and the time it was raised

#### Scenario: A problem with every field

- **WHEN** a problem is raised with a summary, a reason, a solution proposal, a responsible member, a due date, a metric of the team's board and the stage `plan`
- **THEN** each is returned as given

#### Scenario: The summary is missing or blank

- **WHEN** a problem is raised with no summary, or one made only of spaces
- **THEN** it is rejected with `item_summary.blank` against `summary`, and nothing is recorded

#### Scenario: A text is too long

- **WHEN** a problem is raised with a summary of 501 characters, or a reason or solution proposal of 4001 characters
- **THEN** it is rejected with `item_summary.too_long` against `summary`, or `item_text.too_long` against that field, and nothing is recorded

#### Scenario: An unknown stage

- **WHEN** a problem is raised with the stage `done`
- **THEN** it is rejected with `request.invalid_field` against `stage`

#### Scenario: The team does not exist

- **WHEN** a problem is raised on a team that does not exist
- **THEN** it is rejected with `team.not_found` and HTTP 404

### Requirement: Raise a task

The system SHALL allow a task to be raised on a team with a summary, details, a responsible person, a due date, a metric it concerns, a problem of the same team it comes from, and a stage. Only the summary SHALL be required, with the limits that apply to a problem; details SHALL be at most 4000 characters. A task SHALL be returned with when it was raised.

#### Scenario: A task is raised

- **WHEN** a member raises a task with the summary "Update the agenda", a responsible member and a due date
- **THEN** the task is returned with that summary, empty details, that responsible person and due date, no metric, no problem, the stage `not_started`, and the time it was raised

#### Scenario: A task raised from a problem

- **WHEN** a task is raised naming an active problem of the same team
- **THEN** the task is returned carrying that problem's identifier and summary

#### Scenario: The problem belongs to another team

- **WHEN** a task is raised naming a problem of another team, or one that does not exist
- **THEN** it is rejected with `task_problem.not_found` against `problem_id`, and nothing is recorded

#### Scenario: The problem is archived

- **WHEN** a task is raised naming an archived problem of the same team
- **THEN** it is rejected with `task_problem.archived` against `problem_id`, and nothing is recorded

#### Scenario: Details too long

- **WHEN** a task is raised with details of 4001 characters
- **THEN** it is rejected with `item_text.too_long` against `details`

### Requirement: Change a problem or a task

The system SHALL allow any field of an active problem or task to be changed, leaving the fields not given unchanged and clearing an optional one given as empty, under the rules for raising it. A task's problem SHALL be changeable to another active problem of the team or to none. A change SHALL be returned with the item as it now is and when it was last changed.

#### Scenario: The due date is moved

- **WHEN** a member changes only the due date of a problem
- **THEN** the problem carries the new due date and every other field is unchanged

#### Scenario: The responsible person is cleared

- **WHEN** a task's responsible person is changed to none
- **THEN** the task has no responsible person

#### Scenario: A task is detached from its problem

- **WHEN** a task raised from a problem has its problem changed to none
- **THEN** the task carries no problem, and the problem is unchanged

#### Scenario: The item does not belong to the team

- **WHEN** a problem of one team is changed under another team, or a problem that does not exist is changed
- **THEN** it is rejected with `problem.not_found` and HTTP 404, and the same holds for a task with `task.not_found`

#### Scenario: An invalid change leaves the item as it was

- **WHEN** a change sets a valid due date and a blank summary at once
- **THEN** it is rejected with `item_summary.blank`, and the due date is unchanged too

### Requirement: Progress is a PDCA stage

The system SHALL record an item's progress as one of five stages, in order: `not_started`, `plan`, `do`, `check`, `act`. A new item SHALL start at `not_started` unless raised at another stage. An active item's stage SHALL be changeable to any stage, forwards or back. Reaching `act` SHALL close the item.

#### Scenario: A stage is moved on

- **WHEN** a task at `plan` is changed to `do`
- **THEN** the task is at `do` and is still active

#### Scenario: A stage is moved back

- **WHEN** a problem at `check` is changed to `plan`
- **THEN** the problem is at `plan` and is still active

#### Scenario: Setting the same stage twice changes nothing more

- **WHEN** two members both change a task from `plan` to `do` one after the other
- **THEN** the task is at `do`, not one stage further

### Requirement: A closed item is archived

The system SHALL archive an item when it reaches `act`, recording when it was closed. An archived item SHALL NOT be changed: any change SHALL be rejected with `problem.archived` or `task.archived` and HTTP 409. No problem or task SHALL be deleted, active or archived.

#### Scenario: Closing archives

- **WHEN** a member changes a problem to `act`
- **THEN** the problem is returned as archived, with the time it was closed, and is no longer among the team's active problems

#### Scenario: An item raised as done is archived at once

- **WHEN** a task is raised at the stage `act`
- **THEN** it is recorded as archived, with the same time raised and closed

#### Scenario: An archived item cannot be changed

- **WHEN** a member changes the summary or the stage of an archived task
- **THEN** it is rejected with `task.archived` and HTTP 409, and the task is unchanged

#### Scenario: There is no way to delete an item

- **WHEN** a delete is requested for a problem or a task
- **THEN** the request is refused as a method the resource does not offer, and the item remains

### Requirement: The meetings at which an item was raised and closed

The system SHALL record, when an item is raised, the meeting at which it was raised, and when it is closed, the meeting at which it was closed. That meeting SHALL be the team's first meeting dated today or later in Europe/Warsaw, or else its latest meeting, or none if the team has none. Deleting a meeting SHALL leave its items recording no meeting.

#### Scenario: Raised before the coming meeting

- **WHEN** today is Monday, the team's next meeting is on Wednesday, and a member raises a problem
- **THEN** the problem was raised at Wednesday's meeting

#### Scenario: Raised at the meeting itself

- **WHEN** a task is raised on the date of one of the team's meetings
- **THEN** it was raised at that meeting

#### Scenario: Closed after the last meeting, before the next is opened

- **WHEN** today is Thursday, the team met yesterday and has opened no later meeting, and a member closes a task
- **THEN** the task was closed at yesterday's meeting

#### Scenario: A team without meetings

- **WHEN** a problem is raised on a team that has opened no meeting
- **THEN** it is recorded and returned with no meeting at which it was raised

#### Scenario: The meeting is deleted

- **WHEN** a meeting at which a task was raised is deleted
- **THEN** the deletion succeeds and the task records no meeting at which it was raised

### Requirement: The responsible person is a member of the team

The system SHALL accept as an item's responsible person only an employee who is a member of the item's team when the responsible person is set. An item SHALL keep its responsible person if they later leave the team.

#### Scenario: A non-member is named responsible

- **WHEN** a problem is raised, or a task changed, naming as responsible an employee who is not a member of the team
- **THEN** it is rejected with `item_responsible.not_member` against `responsible_employee_id`, and nothing is changed

#### Scenario: The responsible person leaves the team

- **WHEN** a member responsible for an active task is removed from the team
- **THEN** the task still carries them as its responsible person

### Requirement: A linked metric is on the team's board

The system SHALL accept as an item's metric only a metric placed on the item's team's board when it is linked, whether the board's own or an included global metric. A link SHALL remain when the metric is later retired or removed from the board, and SHALL be cleared when the metric is deleted.

#### Scenario: A metric of another board

- **WHEN** a problem is raised linked to a metric that is not on its team's board
- **THEN** it is rejected with `item_metric.not_on_board` against `metric_id`, and nothing is recorded

#### Scenario: An included global metric

- **WHEN** a task is linked to a global metric the team's board includes
- **THEN** the task is recorded carrying that metric's identifier and name

#### Scenario: The metric is deleted

- **WHEN** a metric without values that a problem is linked to is deleted from the board
- **THEN** the deletion succeeds and the problem carries no metric

### Requirement: List a team's problems and tasks

The system SHALL return a team's problems and, separately, its tasks, either the active or the archived ones. Active items SHALL be ordered by due date, those without one last, then by when they were raised. Archived items SHALL be ordered by when they were closed, latest first. Each item SHALL carry whether it is overdue.

#### Scenario: Active items in order of due date

- **WHEN** a team has active tasks due on 20 October, on 15 October and with no due date, and an archived task
- **THEN** the active tasks are returned in the order 15 October, 20 October, no due date, and the archived task is not among them

#### Scenario: Archived items, latest closed first

- **WHEN** the archived problems of a team are requested
- **THEN** only archived problems are returned, the most recently closed first, each with the meetings at which it was raised and closed

#### Scenario: An overdue item

- **WHEN** today is 14 October in Europe/Warsaw and an active task is due on 13 October and another on 14 October
- **THEN** the first is overdue and the second is not

#### Scenario: An archived item is never overdue

- **WHEN** a problem due on 1 October was closed on 5 October
- **THEN** it is not overdue

#### Scenario: A team with no items

- **WHEN** the problems of a team that has none are requested
- **THEN** an empty list is returned rather than an error

### Requirement: The board shows the active problems and tasks

The board page SHALL show, beside the metrics of the meeting shown, the team's active problems and its active tasks as two lists, in the order the system returns them. Each entry SHALL show its summary, its responsible person, its due date with an overdue mark, and its stage. Entries raised at the meeting shown SHALL be marked new, and the count of items closed at it SHALL be shown.

#### Scenario: The lists are shown

- **WHEN** a team's board is opened and the team has two active problems and three active tasks
- **THEN** both lists are shown beside the metrics, with each entry's summary, responsible person, due date and stage

#### Scenario: The overdue mark and the stage are not colour alone

- **WHEN** an entry is overdue, and another is at the stage `do`
- **THEN** the first is marked overdue in words, and the second's stage is named in words alongside its PDCA symbol

#### Scenario: New at this meeting

- **WHEN** the board shows a meeting at which one of the active tasks was raised
- **THEN** that task is marked new, and the others are not

#### Scenario: Closed at this meeting

- **WHEN** the board shows a meeting at which two items were closed
- **THEN** the board says that two items were closed at this meeting

#### Scenario: The lists do not depend on the meeting shown

- **WHEN** the board is moved from the coming meeting to an older one
- **THEN** the same active problems and tasks are shown

#### Scenario: Nothing is open

- **WHEN** a team has no active problems
- **THEN** the problems list says so in the active language rather than showing an empty area

### Requirement: Problems and tasks are added and changed in a dialog

The board SHALL offer adding a problem and adding a task, each opening a dialog with the item's fields, and SHALL open the same dialog to change an entry. The stage SHALL also be movable to the next one from the entry itself. A problem's dialog SHALL offer raising a task from it. Due dates SHALL be shown in the active language's format.

#### Scenario: A problem is added

- **WHEN** a member adds a problem through the dialog with a summary and a reason
- **THEN** it appears in the problems list without reloading the page

#### Scenario: A stage is moved on from the list

- **WHEN** a member activates the stage symbol of a task at `do`
- **THEN** the task moves to `check`, and the list shows it there

#### Scenario: Closing is confirmed

- **WHEN** a member moves an entry to `act`, from the list or in the dialog
- **THEN** the board asks them to confirm that the item will be archived, and only on confirmation does the item close and leave the list

#### Scenario: A task is raised from a problem

- **WHEN** a member chooses to raise a task from a problem's dialog and saves it
- **THEN** the task is raised linked to that problem, and its entry names the problem it comes from

#### Scenario: A rejection is shown in the active language

- **WHEN** a member saves a dialog naming a responsible person who has meanwhile left the team
- **THEN** the dialog stays open and shows the `item_responsible.not_member` message in the active language against the responsible person

### Requirement: The Archived view

The board page SHALL offer an Archived view, kept in the page's address, listing the team's archived problems and tasks with their summary, responsible person, due date and the dates of the meetings at which each was raised and closed, in the order the system returns them. The view SHALL offer no change to any item.

#### Scenario: The archived items are listed

- **WHEN** a team's board is switched to the Archived view
- **THEN** its archived problems and tasks are listed, the most recently closed first, each with the dates of the meetings at which it was raised and closed

#### Scenario: The view has its own address

- **WHEN** the Archived view is open and the page is reloaded
- **THEN** the Archived view is shown again

#### Scenario: Nothing has been archived

- **WHEN** the Archived view of a team with no archived items is opened
- **THEN** it says so in the active language

### Requirement: Problem and task events are logged

The system SHALL log at INFO when an item is raised, when its stage changes and when it is closed, with the item's kind and identifier, the team's identifier and the email of the person who did it, and SHALL NOT log the item's texts.

#### Scenario: Closing is logged without the texts

- **WHEN** a member closes a problem whose reason mentions a person by name
- **THEN** an INFO entry records the problem's identifier, the team and the member's email, and the reason's text does not appear in the log
