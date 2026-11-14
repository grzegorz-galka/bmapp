# Spec Delta

## Purpose

Lets a team record the projects and products it follows, with who manages or owns each, and track their own metrics on the team's board at its meetings, alongside the board's other metrics.

## ADDED Requirements

### Requirement: Register a project

The system SHALL allow a project to be added to a team with a code, a name, a project manager named by email, a start date and an end date. The code SHALL be trimmed, at most 50 characters and unique company-wide regardless of case. The name SHALL be trimmed and at most 200 characters. The end date SHALL NOT be before the start date. A new project SHALL be active.

#### Scenario: A project is added

- **WHEN** a leader adds to their team the project "PRJ-042" named "Billing rewrite", managed by `anna@example.com`, from 2026-09-01 to 2027-03-31
- **THEN** it is returned with a unique identifier, those properties, the manager's display name, the owning team and the status active

#### Scenario: The code is taken in another team

- **WHEN** a project is added with the code "prj-042" while another team has a project "PRJ-042"
- **THEN** it is rejected against `code` with `project_code.duplicate`, and no project is added

#### Scenario: Code or name is blank or too long

- **WHEN** a project is added with a blank code, a code over 50 characters, a blank name or a name over 200 characters
- **THEN** it is rejected with `project_code.blank`, `project_code.too_long`, `project_name.blank` or `project_name.too_long` against the field, and no project is added

#### Scenario: The end is before the start

- **WHEN** a project is added with the start date 2026-09-01 and the end date 2026-08-31
- **THEN** it is rejected against `end_date` with `project_dates.order`, and no project is added

#### Scenario: A project lasting one day

- **WHEN** a project is added with the same start and end date
- **THEN** it is added

### Requirement: Register a product

The system SHALL allow a product to be added to a team with a name, a product owner named by email and an optional link to its Jira board. The name SHALL be trimmed, at most 200 characters and unique among the team's products regardless of case. The link, when given, SHALL be an absolute `http` or `https` address of at most 2000 characters. A new product SHALL be active.

#### Scenario: A product is added

- **WHEN** a leader adds to their team the product "Customer portal" owned by `jan@example.com` with the link `https://jira.example.com/secure/RapidBoard.jspa?rapidView=17`
- **THEN** it is returned with a unique identifier, those properties, the owner's display name, the owning team and the status active

#### Scenario: A product without a Jira board

- **WHEN** a product is added with no link
- **THEN** it is added with no link

#### Scenario: The name is taken in the team

- **WHEN** a product is added with the name "customer portal" to a team that has the product "Customer portal"
- **THEN** it is rejected against `name` with `product_name.duplicate`

#### Scenario: Two teams have a product of the same name

- **WHEN** two different teams each add a product named "Customer portal"
- **THEN** both are added

#### Scenario: Name is blank or too long

- **WHEN** a product is added with a blank name or a name over 200 characters
- **THEN** it is rejected against `name` with `product_name.blank` or `product_name.too_long`

#### Scenario: The link is not a web address

- **WHEN** a product is added with the link `jira/board/17`, `ftp://jira.example.com` or an address over 2000 characters
- **THEN** it is rejected against `jira_url` with `product_jira_url.invalid` or `product_jira_url.too_long`

### Requirement: A project manager or product owner is named by email

The system SHALL take a project's manager and a product's owner as an email, under the rules for an employee's email, and SHALL record that person as an employee when they are not one yet. The person SHALL NOT need to be a member of the owning team, and being named SHALL give them no permission and no membership.

#### Scenario: A manager from outside the team

- **WHEN** a project is added with the manager `ewa@example.com`, who belongs to no team and was never recorded
- **THEN** the project is added, `ewa@example.com` is recorded as an employee, and is not a member of the team

#### Scenario: Naming someone gives no permission

- **WHEN** the manager of a project, who is not a member of its team, changes the project or records a value for its metric
- **THEN** each request is refused with `auth.forbidden`

#### Scenario: The email is malformed

- **WHEN** a project is added with the manager `not-an-email`
- **THEN** it is rejected against `manager_email` with `employee_email.invalid`, and nothing is recorded

### Requirement: Change a project or a product

The system SHALL allow every property of a project or a product to be changed, except the team that owns it, subject to the rules for registering one. A project's code SHALL be changeable. The owning team SHALL NOT change.

#### Scenario: A project is extended and handed over

- **WHEN** a leader changes the end date of "PRJ-042" to 2027-06-30 and its manager to `piotr@example.com`
- **THEN** the project is returned with the new end date and manager, and its metrics and their values are unchanged

#### Scenario: A product's link is removed

- **WHEN** a leader clears a product's Jira link
- **THEN** the product is returned with no link

#### Scenario: A change breaking a rule is refused

- **WHEN** a project's code is changed to one another project uses
- **THEN** it is rejected with `project_code.duplicate`, and the project is unchanged

### Requirement: Deactivate and reactivate a project or a product

The system SHALL allow a project or a product to be made inactive and active again, by hand only. Reaching or passing the end date SHALL NOT change a project's status.

#### Scenario: A project is deactivated

- **WHEN** a leader makes the project "PRJ-042" inactive
- **THEN** it is returned with the status inactive

#### Scenario: A project is reactivated

- **WHEN** a leader makes an inactive project active again
- **THEN** it is returned with the status active

#### Scenario: The end date passes

- **WHEN** an active project's end date is 2026-10-31 and it is read on 2026-11-06
- **THEN** it is still active

### Requirement: An active project past its end date is flagged

The system SHALL return with a project whether it is past its end date: active, with an end date before today on the organization's clock (Europe/Warsaw). The interface SHALL mark such a project wherever it lists or shows it.

#### Scenario: An active project past its end

- **WHEN** an active project ending on 2026-10-31 is read on 2026-11-06
- **THEN** it is returned flagged as past its end date, and its page marks it so

#### Scenario: A project ending today

- **WHEN** an active project ending on 2026-11-06 is read on 2026-11-06 in Europe/Warsaw
- **THEN** it is not flagged

#### Scenario: An inactive project is never flagged

- **WHEN** an inactive project ending on 2026-10-31 is read on 2026-11-06
- **THEN** it is not flagged

### Requirement: Delete a project or a product

The system SHALL allow a project or a product to be deleted, with its metrics and their threshold versions, only while no value is recorded for any of its metrics. Otherwise it SHALL be rejected with `project.has_values` or `product.has_values` and HTTP 409. While one of its metrics is the source of a derivation, deleting SHALL be rejected with `metric.derivation_source` and HTTP 409.

#### Scenario: A project without values is deleted

- **WHEN** a project whose two metrics have no recorded values is deleted
- **THEN** neither it nor its metrics are returned any more, and its code is free for another project

#### Scenario: Deleting a project with values is refused

- **WHEN** a project one of whose metrics has a recorded value is deleted
- **THEN** it is rejected with `project.has_values` and HTTP 409, and the project and its metrics are unchanged

#### Scenario: Deleting a product with values is refused

- **WHEN** a product one of whose metrics has a recorded value is deleted
- **THEN** it is rejected with `product.has_values` and HTTP 409

#### Scenario: Deleting a project whose metric is a source is refused

- **WHEN** a project with no values is deleted while one of its metrics is a source of another team's derived metric
- **THEN** it is rejected with `metric.derivation_source` and HTTP 409

### Requirement: List and read a team's projects and products

The system SHALL return a team's projects, ordered by code, and its products, ordered by name, each with its properties, the manager's or owner's email and display name, its status and, for a project, whether it is past its end date. Inactive ones SHALL be included and marked. One project or product SHALL be readable by its identifier with the same content.

#### Scenario: Projects are listed by code

- **WHEN** a team has the projects "PRJ-050" (inactive) and "PRJ-042", and its projects are requested
- **THEN** "PRJ-042" then "PRJ-050" are returned, the second marked inactive

#### Scenario: A project of another team

- **WHEN** a project is requested under a team that does not own it
- **THEN** it is rejected with `project.not_found` and HTTP 404

### Requirement: A project's or product's metric

The system SHALL allow a metric to be added to a project or a product, as a metric of the owning team's board, with every property and rule of a board's own metric except where this capability says otherwise. It SHALL carry the project or product it belongs to on every read of it. It SHALL take threshold versions, an owner, a group and a position like any of the board's own metrics.

#### Scenario: A metric is added to a project

- **WHEN** a leader adds the metric "Budget consumed" (unit "%", `lower_is_better`) to the project "PRJ-042"
- **THEN** it is returned as a metric of the team's board, belonging to "PRJ-042", with no threshold

#### Scenario: A project's metric takes a threshold version

- **WHEN** a leader records for "Budget consumed" the target value 100 with tolerances 0 and 10
- **THEN** the version is recorded and a value is judged against it as for any metric

#### Scenario: The project is another team's

- **WHEN** a leader adds a metric to their board naming a project of another team
- **THEN** it is rejected against `project_id` with `project.not_found` and HTTP 404

#### Scenario: A metric of an inactive project

- **WHEN** a metric is added to an inactive project
- **THEN** it is added, and it is retired on the board while the project stays inactive

### Requirement: A project's or product's metric is added hidden

The system SHALL add a project's or product's metric hidden on the board unless the request asks to show it. Showing it SHALL place it in the board's ordinary layout, where it is arranged, grouped and hidden again like any other metric.

#### Scenario: A project's metric has no tile at first

- **WHEN** a metric is added to a project without asking to show it
- **THEN** it is marked hidden, the board shows no tile for it, and a value can be recorded for it at an editable meeting

#### Scenario: A project's metric is shown as a tile

- **WHEN** a leader shows the project's metric "Budget consumed" and moves it into the board's group "Delivery"
- **THEN** the board shows its tile in "Delivery" at the position it was given

### Requirement: The owner of a project's or product's metric

The system SHALL make the project's manager or the product's owner the owner of a new metric of it when no owner is given and that person is a member of the team, and leave it without an owner otherwise. An owner given in the request SHALL follow the rules for any metric's owner.

#### Scenario: The manager is a member

- **WHEN** a metric is added with no owner to a project whose manager is a member of the team
- **THEN** the manager owns the metric

#### Scenario: The manager is not a member

- **WHEN** a metric is added with no owner to a project whose manager is not a member of the team
- **THEN** the metric has no owner

#### Scenario: Another member is named

- **WHEN** a metric is added to a product naming a team member other than the product owner as its owner
- **THEN** that member owns it

### Requirement: A project's or product's metric name is unique within it

The system SHALL keep a project's or product's metric name, trimmed and regardless of case, unique among the metrics of that project or product. It MAY repeat the name of the board's own metrics, of an included global metric, or of a metric of another project or product.

#### Scenario: Two projects measure the same thing

- **WHEN** a team adds "Budget consumed" to the projects "PRJ-042" and "PRJ-050", and has a board metric "Budget consumed" of its own
- **THEN** all three are added

#### Scenario: The name is taken in the project

- **WHEN** a metric named "budget consumed" is added to a project that has "Budget consumed"
- **THEN** it is rejected against `name` with `metric_name.duplicate`

### Requirement: A project's or product's metric is labelled with it

The interface SHALL label a project's metric with the project's code and a product's metric with the product's name, as "PRJ-042 · Budget consumed", wherever it appears among the board's other metrics: the tiles, the metric detail, the recording view, the readiness panel, the settings page and the source picker of a derivation. The project's or product's own page SHALL show the metric's name alone.

#### Scenario: A tile names the project

- **WHEN** the board shows the tile of the project "PRJ-042"'s metric "Budget consumed"
- **THEN** the tile reads "PRJ-042 · Budget consumed"

#### Scenario: The readiness panel names the product

- **WHEN** the product "Customer portal"'s metric "NPS" has no number at a meeting and the readiness panel is open
- **THEN** it is listed as "Customer portal · NPS" with its owner

#### Scenario: The project page uses the bare name

- **WHEN** the page of "PRJ-042" lists its metrics
- **THEN** the metric reads "Budget consumed"

### Requirement: An inactive project's or product's metrics are retired

The system SHALL treat every metric of an inactive project or product as retired on the board: it SHALL show no tile, SHALL not be owed or counted as missing, and SHALL accept no new value, refused with `metric.retired`. Its values, thresholds and trend SHALL stay readable. Reactivating SHALL restore each metric to what its own placement says.

#### Scenario: Deactivating stops the chase

- **WHEN** the project "PRJ-042", whose metric "Budget consumed" owned by `anna@example.com` has no number at the next meeting, is made inactive
- **THEN** the board shows no tile for it, the meeting no longer counts it as missing, and `anna@example.com` no longer owes data for it

#### Scenario: A value for an inactive project's metric is refused

- **WHEN** a member records a value for a metric of an inactive project
- **THEN** it is rejected with `metric.retired`, and nothing is recorded

#### Scenario: History stays readable

- **WHEN** the trend of a metric of an inactive project is requested
- **THEN** its recorded values are returned

#### Scenario: The settings page offers no bring-back while the project is inactive

- **WHEN** a leader opens the metric settings page while the project "PRJ-042" is inactive, and while the product "Customer portal" is inactive
- **THEN** each of their metrics is marked retired with a note that it is retired while its project or product is inactive, and offers no control to bring it back, while a metric retired by hand on the board still offers one

#### Scenario: Reactivating restores the metrics

- **WHEN** a project is made active again, with one metric shown, one hidden and one retired on the board
- **THEN** the first shows its tile again, the second is active and hidden, and the third stays retired

### Requirement: The team's projects and products page

The interface SHALL offer, from the team's pages, a page listing the team's projects and products with their status, manager or owner by display name and, for a project, its dates and whether it is past its end date. It SHALL offer whoever may manage them to add, change, deactivate, reactivate and delete one, in a dialog, and offer nobody else those controls. All text SHALL be in the active language.

#### Scenario: A leader adds a project

- **WHEN** a leader opens the team's projects and products page, chooses "Add project", fills in the form and saves
- **THEN** the project is listed with its code, name, manager, dates and the status active

#### Scenario: A member sees no controls

- **WHEN** a member who neither leads the team nor is its deputy opens the page
- **THEN** the projects and products are listed, with no control to add, change or delete one

#### Scenario: A refused deletion is explained

- **WHEN** a leader deletes a project with recorded values
- **THEN** the page says the project has values and can be made inactive instead, and the project is still listed

### Requirement: A project's or product's page

The interface SHALL show, for one project or product, its details, a link to the product's Jira board opening in a new tab, and its metrics, each with its latest recorded value and that value's status, a trend over the team's meetings, and whether it is shown on the board. Whoever may configure the board SHALL be offered to add a metric, record its threshold versions, show it on the board or hide it, retire it and delete it there.

#### Scenario: The page shows a metric's latest value and trend

- **WHEN** "Budget consumed" of "PRJ-042" has the values 40, 55 and 71 at the team's last three meetings and the page of "PRJ-042" is opened
- **THEN** the metric shows 71 with its status and a trend through 40, 55 and 71

#### Scenario: A metric is added from the project page

- **WHEN** a leader adds the metric "Scope change" on the page of "PRJ-042"
- **THEN** it is listed there not shown on the board, and appears on the board's settings page as "PRJ-042 · Scope change", marked hidden

#### Scenario: The Jira link opens the board

- **WHEN** a product has a Jira link and its page is opened
- **THEN** the link is shown and opens in a new tab

#### Scenario: An inactive project's page

- **WHEN** the page of an inactive project is opened
- **THEN** it is marked inactive, and its metrics show their history with no control to record a value
