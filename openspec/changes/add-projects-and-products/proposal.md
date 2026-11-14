# Proposal

## Why

Teams follow the projects they deliver and the products they look after at
the weekly board meeting. Today those numbers either crowd the board as
ordinary metrics, with the project typed into each name ("PRJ-042 Budget"),
or live outside BMAPP. Nothing records which project a number belongs to,
who manages the project, or that it has ended, so its metrics stay owed
after the project closes.

## What Changes

- **Projects.** A team records the projects it follows:
  - a code, unique company-wide;
  - a name;
  - a project manager, named by email;
  - a start and an end date;
  - a status, active or inactive.
- **Products.** A team records the products it looks after:
  - a name;
  - a product owner, named by email;
  - an optional link to the product's Jira board;
  - a status, active or inactive.
- **One owning team.** Each project and product belongs to exactly one team.
  The team's leader, its deputies and administrators create, change,
  deactivate, reactivate and delete it. Anyone signed in reads it.
- **Status is set by hand.** The end date is information only. An active
  project past its end date is flagged as such, but it stays active.
- **Deleting.** A project or product can be deleted only while none of its
  metrics has a recorded value. After that it is made inactive instead.
- **Naming people.** The project manager or product owner need not belong
  to the team. Naming someone records them as an employee if they are not
  one yet. Being named gives no permission.
- **A project's or product's own metrics.**
  - **Same machinery as a board metric.** A project's or product's metric
    is a metric of the owning team's board, with the same unit, decimals,
    direction, threshold versions, target values, owner, group and
    position.
  - **Recorded like any other metric.** The team's members record its
    values at the team's meetings. Readiness counts it as owed, and the
    board's completeness counts it.
  - **No tile until asked for.** It is added hidden on the board, and
    showing it puts it in the board's ordinary layout.
  - **Default owner.** The project manager or product owner owns it, when
    they are a member of the team.
  - **Names and labels.** Its name is unique within its project or
    product, not on the board. Wherever it appears beside the board's
    other metrics, it is labelled with the project's code or the product's
    name, for example "PRJ-042 · Budget consumed".
- **Never derived, but may be a source.**
  - A project's or product's metric cannot be given a derivation of any
    kind (mean, weighted mean, sum or delta).
  - It may be a source of any team's derived metric.
  - It cannot be copied onto another board.
- **Inactive works like retirement.** The metrics of an inactive project or
  product are not owed and show no tile. They take no new value, but their
  history and trends stay readable. Reactivating restores all of that.
- **A page per project and product.** It shows the details and the
  metrics, each with its latest value, status and trend. The team's
  projects and products are listed on a page of the team's.

### Out of scope

- Problems and tasks stay linked to the board. They do not name a project
  or product.
- A project or product shared by several teams. Another team reads its
  numbers only through a derived metric.
- Global metrics included in a project or product, and metric templates
  for projects.
- Reading anything from Jira. The link is only followed.
- Closing a project automatically on its end date.

## Capabilities

### New Capabilities

- `projects-and-products`: what a team records about the projects and
  products it follows, who may change them, their status and deletion,
  their metrics, and the pages that show them.

### Modified Capabilities

- `metrics`: a metric's name is unique within its project or product
  rather than on the board. A project's or product's metric is not a copy
  source.
- `derived-metrics`: a project's or product's metric is never derived, but
  may be a source.
- `team-membership`: an employee is also recorded when first named as a
  project manager or product owner.
- `authorization`: a team's leader and deputies manage its projects and
  products.

## Impact

- **Backend:**
  - new `app/models/project.py` with `projects` and `products`;
  - `metrics.project_id` and `metrics.product_id`, and new name-uniqueness
    indexes;
  - new `app/services/projects.py` for both, and routers
    `app/api/projects.py` and `app/api/products.py`;
  - hooks in `metrics.py` (create, copy, retirement read),
    `derivations.py`, `metric_values.py` (refusing values for an inactive
    project's metrics), the readiness count, and `employees.py`.
- **Migration:** `alembic/versions/0014_add_projects_and_products.py`.
- **API:**
  - `/teams/{team_id}/projects[/{project_id}]` and
    `/teams/{team_id}/products[/{product_id}]`;
  - the metric create request takes an optional `project_id` or
    `product_id`;
  - metric reads carry `project` and `product`;
  - new error codes, listed in `design.md`.
- **Frontend:**
  - a new `features/projectsAndProducts/` with the list and detail pages
    and their routes;
  - the metric label on tiles, in the recording view, in the readiness
    panel, on the settings page and in the derivation picker;
  - both catalogues.
- **Dependencies:** none.
