# Design

## Context

See `proposal.md` for why. What exists and shapes the approach:

- **Definition and placement are separate.**
  - `metrics` holds the definition; `team_id` is null for a global metric.
  - `board_metrics` holds the placement on one board: group, position,
    owner, `hidden` and `retired`.
  - A board's own metric has exactly one placement, on its own team.
- **Values are `(metric_id, meeting_id)`.** A meeting belongs to one team.
  A metric's values are therefore per team, which is what lets one owning
  team record a project's numbers.
- **Hidden already means the right thing.** A hidden metric takes values,
  is owed in readiness and counts in completeness, but has no tile
  (`metrics`: Hide a metric on the board).
- **Derivation sources are `(team, metric)` pairs.** `check_derivation`
  accepts any metric placed on the named team's board, and
  `ck_metrics_derivation_own` already limits derivations to own metrics.
- **"Active" is spelled out in SQL in five places:**
  - the board read (`metric_values.py`);
  - `owing_by_meeting` (`metric_values.py`);
  - the derivation's sources (`metric_values.py`);
  - two dashboard counts (`dashboard.py`).

  Each spells it as `retired_on_board IS FALSE AND metrics.retired IS FALSE`.
  `BoardMetric.retired` is the Python twin of that predicate.
- **Names are unique per team.** `uq_metrics_team_name_lower` covers every
  own metric of a team. The service checks clashes with included global
  metrics (`metrics.py`).
- **Employees are created by `get_or_create_employee`**
  (`services/employees.py`) when assigned to a team.

## Goals / Non-Goals

**Goals:**

- A project's or product's metric goes through the same create, threshold,
  layout, hide, retire, record, derive and readiness code as any other
  metric. The few differences are explicit checks, not a parallel code path.
- Whether a placement is active is decided by one SQL expression and one
  Python property, and every reader uses them.

**Non-Goals:**

- Moving a metric between projects, or between a project and the board.
  The `project_id` and `product_id` of a metric never change.
- An aggregated read for a project's page. The page uses the existing
  metric list and per-metric trend endpoints (decision 6).
- Unifying projects and products under one stored entity (decision 1).

## Decisions

### 1. Two tables, `projects` and `products`

```
projects
  id                    UUID PK
  team_id               FK teams ON DELETE CASCADE, NOT NULL
  code                  VARCHAR(50)  NOT NULL, btrim <> ''
  name                  VARCHAR(200) NOT NULL, btrim <> ''
  manager_employee_id   FK employees ON DELETE RESTRICT, NOT NULL
  start_date, end_date  DATE NOT NULL, CHECK (start_date <= end_date)
  active                BOOLEAN NOT NULL DEFAULT true
  created_at
  UNIQUE INDEX (lower(code))                    -- company-wide
  UNIQUE (id, team_id)                          -- target of the metrics FK below

products
  id, team_id, created_at, active               as above
  name                  VARCHAR(200) NOT NULL, btrim <> ''
  owner_employee_id     FK employees ON DELETE RESTRICT, NOT NULL
  jira_url              VARCHAR(2000) NULL
  UNIQUE INDEX (team_id, lower(name))
  UNIQUE (id, team_id)
```

Both live in a new `app/models/project.py`.

**Alternative: one table with a `kind` column.** It gives a single foreign
key from `metrics` and one router. It was rejected because:

- half the columns would be null for each kind;
- the two uniqueness rules differ (a code company-wide, a name per team),
  so each would need a partial index;
- the API and the interface would keep saying "project" and "product"
  anyway.

The shared behaviour (team ownership, status, deletion, metrics) is small
enough to live in one service module. The duplication is in the schemas and
routers, which are thin.

### 2. A metric points at its project or product, on the same team

```
metrics.project_id   UUID NULL
metrics.product_id   UUID NULL
  FK (project_id, team_id) -> projects (id, team_id) ON DELETE CASCADE
  FK (product_id, team_id) -> products (id, team_id) ON DELETE CASCADE
  ck_metrics_one_parent:   num_nonnulls(project_id, product_id) <= 1
  ck_metrics_derivation_own (replaced):
      derivation_kind IS NULL
      OR (team_id IS NOT NULL AND project_id IS NULL AND product_id IS NULL)
  INDEX (project_id), INDEX (product_id)
```

- **Same team, enforced by the database.** The composite foreign key means
  a metric can only belong to a project of its own team; a global metric
  (`team_id` null) can belong to none. No trigger is needed.
- **CASCADE is safe.** It removes a project's metrics, and with them their
  placements and threshold versions. The service refuses the delete first
  while any value exists (`project.has_values`). RESTRICT on
  `metric_values` and `metric_derivation_sources` is the backstop.
- **A project's metric is a board's own metric.** `team_id` is set and it
  has one placement, so everything keyed on the placement works unchanged.

**Alternative: a link table `project_metrics`.** It would allow a metric in
several projects, which nobody asked for, and every reader would need one
more join to label a metric.

### 3. Name uniqueness by partial indexes

`uq_metrics_team_name_lower` becomes one of three partial unique indexes:

```
uq_metrics_team_name_lower     (team_id,    lower(name)) WHERE project_id IS NULL AND product_id IS NULL
uq_metrics_project_name_lower  (project_id, lower(name)) WHERE project_id IS NOT NULL
uq_metrics_product_name_lower  (product_id, lower(name)) WHERE product_id IS NOT NULL
```

The board's index keeps its name and is only narrowed. The service maps a
unique violation to `metric_name.duplicate` by index name, so keeping it
leaves that mapping as it was; the two new names map to the same error.

The service's clash check against included global metrics applies only to a
metric with no project or product. Including a global metric whose name a
project metric already uses is allowed.

### 4. Inactive means retired, decided in one place

Two shared definitions in `app/services/metrics.py`:

- **`active_placement()`** returns the SQL predicate:
  `retired_on_board IS FALSE AND metrics.retired IS FALSE`, and no project
  or product of the metric that is inactive. The last part is
  `NOT EXISTS (SELECT 1 FROM projects WHERE id = metrics.project_id AND NOT
  active)`, and the same for products.
- **`BoardMetric.retired`** gains the same third term through `Metric.project`
  and `Metric.product`. Both relationships are joined, so this costs no
  extra statement.

All five readers listed under Context switch to `active_placement()`, and so
does the value-recording check (`metric.retired`).

A metric's `retired` read therefore says nothing about why. Where that
matters, the interface tells from `project.active` and `product.active`:
the settings page marks a metric of an inactive project or product with a
note and offers no "Bring back", because the placement's switch is not what
retired it. A global metric retired in the catalogue is handled the same
way.

**Alternative: copy the status onto the placements** when a project is
deactivated, by setting `retired_on_board`. That is cheaper to read, but
reactivating could not tell a metric retired by hand from one retired by the
project. The spec requires the hand-retired one to stay retired.

### 5. The metric endpoints take a project or a product

- **Create.** `POST /teams/{id}/metrics` takes an optional `project_id` or
  `product_id`. Giving both is rejected by a Pydantic validator with
  `metric.project_and_product`.
- **`hidden` becomes optional on create.** When it is not given, a
  project's or product's metric is hidden and any other metric is shown.
- **Default owner.** When no owner is given, the owner is the project
  manager or product owner, if that person is a member of the team at
  creation time. Otherwise the metric has no owner, because the existing
  rule that an owner is a team member stands.
- **Refusals.**
  - A `derivation` on a project's or product's metric, at create or change,
    is refused with `derivation.project_metric` or
    `derivation.product_metric`.
  - Copying one is refused with `metric_copy.source_project` or
    `metric_copy.source_product`.
- **Reads.** Every read that names a metric carries:
  - `project`: `{id, code, name, active}` or null;
  - `product`: `{id, name, active}` or null.

  That covers the metric as listed, on the board and in a trend. It also
  covers a metric named inside another read: a derivation's source
  (`NamedMetricRead`), a derived value's source (`DerivedSource`) and a
  completeness entry for a missing metric (`MissingMetric`). Without the
  last two, the recording view and the readiness panel could not label
  "Customer portal · NPS". The fields are required and nullable, so a reader
  that forgets them fails to type-check.

  The interface builds the label "PRJ-042 · Budget consumed" from these with
  one helper, `metricLabel()`, used by every view the spec lists.

Everything else stays on the existing endpoints and is gated by the same
`may_configure_the_board` check (`app/services/authz.py`): thresholds,
layout, hide, retire and delete. The projects and products routers use it
too, through `require_board_configurer`.

### 6. Projects and products API, and pages

```
GET    /teams/{team_id}/projects                 list, ordered by code
POST   /teams/{team_id}/projects                 manager_email, code, name, start_date, end_date
GET    /teams/{team_id}/projects/{project_id}
PATCH  /teams/{team_id}/projects/{project_id}    any property, including active
DELETE /teams/{team_id}/projects/{project_id}    204, or 409 has_values / derivation_source
...the same five for /products, with owner_email and jira_url
```

- **Read shape.** A read returns the manager or owner as `{id, email,
  display_name}`. The `id` is the employee's, so the interface can tell
  whether the person is a member without matching emails. A project's read
  also carries `past_end`. It is computed by a pure
  `past_end(active, end_date, today)` from `today()` in
  `app/services/meetings.py`, the same organization-clock date that
  "editable" and "overdue" use. `app/core/time.py` holds the zone, not the
  date.
- **Writes.** They name the person by email, and
  `get_or_create_employee` records them.
- **Delete order.** The service checks for values first, then for any of
  the project's metrics being a derivation source (`refuse_removing_a_source`),
  then deletes.

**Pages:**

- `/teams/:teamId/projects-and-products` is the list page, with add and
  edit in `components/Modal.tsx` dialogs.
- `/teams/:teamId/projects/:projectId` and
  `/teams/:teamId/products/:productId` are the detail pages.
- They live in `features/projectsAndProducts/` and follow the team pages'
  back-link convention. The board's team navigation links to the list.
- **What a detail page reads:** the board's metric list (`GET
  /teams/{id}/metrics`), filtered on the project, and each metric's
  existing `/trend`.

**Alternative: one detail endpoint returning the metrics with trends.**
It would save the round trips. Projects carry a handful of metrics, so the
per-metric calls are cheap, and an aggregate can come later if the page is
slow.

### 7. Error codes

| Code | Field | HTTP |
|---|---|---|
| `project_code.blank` / `.too_long` / `.duplicate` | `code` | 422 / 422 / 409 |
| `project_name.blank` / `.too_long` | `name` | 422 |
| `project_dates.order` | `end_date` | 422 |
| `project.not_found` | `project_id` | 404 |
| `project.has_values` | - | 409 |
| `product_name.blank` / `.too_long` / `.duplicate` | `name` | 422 / 422 / 409 |
| `product_jira_url.invalid` / `.too_long` | `jira_url` | 422 |
| `product.not_found` | `product_id` | 404 |
| `product.has_values` | - | 409 |
| `metric.project_and_product` | `project_id` | 422 |
| `derivation.project_metric` / `derivation.product_metric` | `derivation` | 409 |
| `metric_copy.source_project` / `.source_product` | `source_metric_id` | 409 |

`employee_email.*` is reused for `manager_email` and `owner_email`. HTTP
statuses for duplicates follow the existing `metric_name.duplicate`.

### 8. Polish terms

- Project: *Projekt*
- Product: *Produkt*
- Project manager: *Kierownik projektu*
- Product owner: *Właściciel produktu*
- The list page: *Projekty i produkty*
- Inactive: *Nieaktywny*
- Past its end date: *Po terminie zakończenia*

## Risks / Trade-offs

- **[Risk] A reader is missed and still treats an inactive project's
  metric as active.** → Mitigation: the five readers and value recording
  switch to `active_placement()`. One integration test deactivates a
  project and checks every reader together: board tiles, completeness,
  `owing`, the dashboard row and recording.
- **[Risk] Leaders lose a new metric because it is added hidden.** →
  Mitigation: the project page marks each metric "Not on board" with a
  switch beside it. The settings page lists it, labelled and marked
  hidden.
- **[Trade-off] Labels can get long in the derivation picker**, for
  example "Customer portal · Net promoter score". The picker already
  wraps. No truncation is added.
- **[Trade-off] A default owner is judged at creation only.** If the
  manager joins the team later, existing metrics stay without an owner.
  The leader sets one, as for any metric.
- **[Risk] Downgrading the migration** fails once two project metrics on a
  team share a name, because the old team-wide index cannot be rebuilt. →
  Mitigation: this is accepted; the downgrade states it in its docstring.

## Migration Plan

- `0014_add_projects_and_products.py` creates both tables, adds the two
  columns, foreign keys and indexes, narrows the name index, and replaces
  `ck_metrics_derivation_own`. It revises `0013`, the weighted-mean
  derivation, which reached `main` first. The two touch no common
  constraint.
- A database migrated by an early build of this branch, where projects
  were `0013`, is moved onto this numbering without losing data: stamp
  `0012`, upgrade to `0013`, stamp `0014`.
- No data moves. Existing metrics have no project or product, so the swapped
  index admits exactly what the old one did.
- Rollback is the downgrade, subject to the risk above.
