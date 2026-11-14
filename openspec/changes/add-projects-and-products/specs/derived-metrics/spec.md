# Spec Delta

## ADDED Requirements

### Requirement: A project's or product's metric is never derived

The system SHALL NOT give a project's or a product's metric a derivation, when it is added or later. Such a request SHALL be rejected against `derivation` with `derivation.project_metric` or `derivation.product_metric` and HTTP 409. The settings page and the project's or product's page SHALL offer no derivation for it.

#### Scenario: A derivation on a project's metric is refused

- **WHEN** a leader adds a metric to the project "PRJ-042" with a `sum` derivation, or gives an existing metric of it one
- **THEN** it is rejected with `derivation.project_metric` and HTTP 409, and nothing changes

#### Scenario: A derivation on a product's metric is refused

- **WHEN** a leader gives a metric of the product "Customer portal" a `mean` derivation
- **THEN** it is rejected with `derivation.product_metric` and HTTP 409

#### Scenario: No derivation is offered for a project's metric

- **WHEN** a leader edits a project's metric on the settings page or on the project's page
- **THEN** no derivation editor is offered

### Requirement: A project's or product's metric may be a source

The system SHALL accept a project's or a product's metric as a source of any team's derived metric, named by the team that owns the project or product and read at that team's meetings as any other source is. A metric of an inactive project or product SHALL stay a valid source, and SHALL leave the derivation missing a number for any week in which it has none.

#### Scenario: Another team sums two projects

- **WHEN** the leader of the team "Zarząd" defines a `sum` of "PRJ-042 · Budget consumed" and "PRJ-050 · Budget consumed", both on the board of the team "CKI-P"
- **THEN** the derivation is accepted, and deriving it at a Zarząd meeting reads both numbers recorded at CKI-P's meeting that week

#### Scenario: A source from an inactive project

- **WHEN** a derived metric's source belongs to a project made inactive before anything was recorded for it that week
- **THEN** deriving it names that source as missing, and the derivation itself is unchanged
