# Spec Delta

## ADDED Requirements

### Requirement: A team's leader manages its projects and products

The system SHALL permit the leader of a team, its leader deputies and an administrator to add, change, deactivate, reactivate and delete that team's projects and products, and to add and configure their metrics as they configure the board's. It SHALL refuse those writes to anyone else, a named project manager or product owner included. The team's members SHALL record the values of those metrics as of any of the board's metrics.

#### Scenario: A deputy adds a product

- **WHEN** a deputy of a team, who is not an administrator, adds a product to it and a metric to that product
- **THEN** both are added as the `projects-and-products` capability requires

#### Scenario: An ordinary member cannot manage projects

- **WHEN** a member of a team who neither leads it nor is its deputy adds a project, changes one, deactivates one, deletes one or adds a metric to one
- **THEN** each request is refused with `auth.forbidden`, and nothing is changed

#### Scenario: An administrator manages any team's projects

- **WHEN** an administrator who does not belong to a team adds a project to it
- **THEN** the project is added

#### Scenario: A leader cannot manage another team's projects

- **WHEN** the leader of one team changes a project of a team they do not lead and are not a deputy of
- **THEN** the request is refused with `auth.forbidden`

#### Scenario: A member records a project's metric

- **WHEN** an ordinary member of a team records a value for a metric of one of its active projects at an editable meeting
- **THEN** the value is recorded as the `metric-values` capability requires

#### Scenario: Anyone signed in reads projects and products

- **WHEN** a signed-in employee who belongs to no team requests a team's projects, one of its products, and the page of either
- **THEN** each is returned, and the pages offer no control to change anything
