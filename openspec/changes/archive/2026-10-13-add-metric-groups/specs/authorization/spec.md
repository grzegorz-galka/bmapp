# Spec Delta

## ADDED Requirements

### Requirement: Arranging a board's metrics is part of configuring it

The system SHALL permit adding, renaming and deleting a board's metric groups, and replacing its layout, to exactly those permitted to configure that board's metrics, and SHALL refuse them to anyone else with `auth.forbidden`, changing nothing.

How a board's metrics are grouped and ordered is part of what the team measures and how it reads its board, so it follows the permission to configure the board rather than having one of its own.

#### Scenario: A leader arranges their board

- **WHEN** the leader of a team, who is not an administrator, adds a group to its board, renames it, replaces the layout and deletes the group
- **THEN** each is done as the `metrics` capability requires

#### Scenario: An ordinary member cannot arrange the board

- **WHEN** a member of a team who may not configure its board adds, renames or deletes a group, or replaces the layout
- **THEN** each request is refused with `auth.forbidden`, and the board's groups and layout are unchanged

#### Scenario: An administrator arranges any board

- **WHEN** an administrator who does not belong to a team replaces its board's layout
- **THEN** the layout is replaced
