## Purpose

Tells a team, before a board meeting starts, which metric values and pulse answers are still missing and who owes them, so the host can chase those people and the meeting can start with its data in.

## Requirements

### Requirement: Who still owes data for a meeting

The system SHALL count as owing data for a meeting every owner of an active metric that has no number recorded there, and every current member of the team who has not answered its pulse check. Each person SHALL count once, however many gaps they leave. A metric without an owner SHALL leave a gap but add no one.

#### Scenario: A person with two gaps counts once

- **WHEN** a meeting has no number for two metrics owned by anna@example.com, and anna@example.com and jan@example.com have not answered its pulse check
- **THEN** two people owe data for it: anna@example.com and jan@example.com

#### Scenario: A metric without an owner adds no one

- **WHEN** the only gap at a meeting is a metric with no owner
- **THEN** nobody owes data for it, and the metric is still reported as missing

#### Scenario: Everything is in

- **WHEN** every active metric has a number at a meeting and every current member has answered its pulse check
- **THEN** nobody owes data for it

#### Scenario: A former member is not chased for the pulse check

- **WHEN** a member who never answered a meeting's pulse check is removed from the team
- **THEN** they no longer owe data for that meeting unless they own a metric still missing there

### Requirement: A meeting's board reports how many owe data

The system SHALL return, with a meeting's board and to every viewer who may read the board, how many people owe data for that meeting. The figure SHALL equal the one the dashboard reports for the same meeting.

#### Scenario: The board and the dashboard agree

- **WHEN** three people owe data for a meeting
- **THEN** that meeting's board reports 3, and so does its row in the dashboard summary of a member of its team

#### Scenario: A viewer from outside the team gets the figure

- **WHEN** a signed-in employee who is not a member of the team requests the board of a meeting for which two people owe data
- **THEN** the board reports 2, and names no member who has not answered the pulse check

### Requirement: The readiness panel

The system SHALL show, on a team's board, a readiness panel for the meeting shown when that meeting still takes values and is dated today or later. It SHALL be shown collapsed, its heading alone, unless the board was opened from the panel's own address; the viewer SHALL be able to expand and collapse it. Expanded, it SHALL list the metrics still without a number, each with its owner or "no owner", and the members who have not answered the pulse check, and state how many people owe data. Its text SHALL be in the active language.

#### Scenario: The panel is collapsed by default

- **WHEN** a member opens the board of the coming meeting from an address that does not name the readiness panel
- **THEN** the readiness panel shows only its heading, and expanding it shows what is missing

#### Scenario: The panel lists what is missing

- **WHEN** a member expands the panel on the board of the coming meeting, at which 3 of 5 metrics have a number, one missing metric owned by anna@example.com and one with no owner, and 4 of 6 members have answered
- **THEN** the panel lists both missing metrics, one with anna@example.com and one with "no owner", the two members who have not answered, and the number of people who owe data

#### Scenario: A complete meeting says so

- **WHEN** the panel is expanded on the board of a coming meeting at which nothing is missing
- **THEN** the panel says that every metric is recorded and everyone has answered, and offers no addresses to copy

#### Scenario: A past meeting has no panel

- **WHEN** the board is shown on a meeting dated before today, or on one that no longer takes values
- **THEN** no readiness panel is shown

#### Scenario: The panel stays current

- **WHEN** a member records the number of a missing metric while the panel is expanded
- **THEN** the panel no longer lists that metric, without reloading the page

### Requirement: The readiness panel has its own address

The system SHALL let the board's address open the board on a meeting with its readiness panel expanded and in view, so the panel can be linked to, survives a reload, and is what "Check readiness" on the dashboard opens.

#### Scenario: The panel is opened from its address

- **WHEN** a member opens the address of a team's board naming the coming meeting and the readiness panel
- **THEN** that meeting's board is shown with the readiness panel expanded and scrolled into view

#### Scenario: Check readiness opens the panel expanded

- **WHEN** a member chooses "Check readiness" on a coming meeting's row on the dashboard
- **THEN** that meeting's board is shown with the readiness panel expanded and scrolled into view

#### Scenario: Leaving the panel's address collapses it again

- **WHEN** a member who opened the board from the panel's address switches to another view of the board or to another meeting, and comes back to a coming meeting's metrics
- **THEN** the readiness panel is shown collapsed

### Requirement: Copy the addresses of those who owe data

The system SHALL offer, in the readiness panel, a control that copies the email addresses of the people owing data that the viewer may see, each once, in email order, separated by a semicolon and a space. It SHALL confirm in words, announced to assistive technology, how many addresses were copied, and say so when copying fails.

#### Scenario: The addresses are copied

- **WHEN** a member chooses "Copy addresses" while jan@example.com and anna@example.com owe data
- **THEN** the clipboard holds `anna@example.com; jan@example.com`, and the panel says that 2 addresses were copied

#### Scenario: Copying fails

- **WHEN** the browser refuses to write to the clipboard
- **THEN** the panel says the addresses could not be copied and shows them as text that can be selected

### Requirement: The panel shows pulse names only to those who may read them

The system SHALL name the members who have not answered the pulse check only to a viewer whom the `authorization` capability permits to read individual pulse answers. Any other viewer SHALL see only how many have not answered, an address list holding metric owners only, and a statement that it does.

#### Scenario: A viewer from outside the team

- **WHEN** a signed-in employee who is not a member of the team, and not an administrator, opens the readiness panel of a meeting with 2 unanswered members and one missing metric owned by anna@example.com
- **THEN** the panel says that 2 members have not answered without naming them, still states how many people owe data, copies only `anna@example.com`, and says that the list holds metric owners only
