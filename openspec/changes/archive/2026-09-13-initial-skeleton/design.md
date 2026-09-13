## Context

See `proposal.md` — Why. This design covers the technical shape of a greenfield repository: there is no existing code, no established module boundaries, and no prior art inside this project to conform to.

Three constraints shape everything below. First, `CLAUDE.md` is authoritative wherever it speaks — the layering, the frontend conventions, the orchestration, the error-handling rule and the toolchain are settled there, and this document records them with their rationale rather than reopening them. Second, where `CLAUDE.md` is silent — which Python web framework, which mapper, which identifier type — the choice is made here, with its alternatives. Third, every decision made here becomes the default that later changes inherit by precedent — a skeleton is disproportionately influential for its size — so the bias is toward conventional, replaceable choices over clever ones.

The behavior this design must satisfy is defined in `specs/team-board/spec.md`; it is not restated here.

## Goals / Non-Goals

**Goals:**

- A single command brings the whole stack up locally, and a single command runs the tests.
- The database schema is versioned from the first commit, so no later change has to retrofit a migration chain.
- The spec's scenarios map onto automated tests one-for-one, so spec drift is visible as a failing test rather than discovered by reading.
- The layering `CLAUDE.md` prescribes is real from the first endpoint, so that later capabilities have somewhere obvious to put business logic.

**Non-Goals:**

- Pagination, filtering, or sorting options on the team list. The list returns everything; volumes are trivially small and adding query parameters now would commit the API contract before there is evidence about how it will be read.
- Any deployment target, production container image, or CI/CD pipeline beyond running the quality gates.
- Abstraction layers introduced in anticipation of future capabilities — repository interfaces, service registries, event buses. They are cheaper to add when a second consumer actually exists.

## Decisions

### Backend framework: FastAPI

Chosen over Django and Flask. Django's strengths — its ORM conventions, admin, templating — are largely unused when a separate React frontend owns the UI, and reaching the same place through Django REST Framework costs more ceremony than it returns at this size. Flask is light enough but leaves request validation and schema definition to be assembled by hand.

FastAPI's decisive advantage here is that the spec's validation scenarios — blank name, over-length name, whitespace trimmed before comparison, each rejected with the offending field identified — are exactly what Pydantic models express declaratively, so those requirements become schema definitions rather than hand-written checks. Generated OpenAPI documentation is a secondary benefit that makes the API inspectable before a frontend exists.

### Persistence: SQLAlchemy 2.x with Alembic migrations

SQLAlchemy is the default Python mapper and Alembic is its migration partner; adopting both keeps the schema versioned from the first commit, which the proposal calls for explicitly. Raw SQL with hand-rolled migration scripts was considered and rejected: it saves a dependency but costs a migration runner that would have to be written and maintained. SQLModel was considered for unifying the Pydantic and SQLAlchemy model definitions, and rejected because coupling the API contract to the storage schema makes them hard to evolve independently — a distinction that matters as soon as the API stops being a thin mirror of the table, and one that `CLAUDE.md` already builds into the layout by separating `schemas/` from `models/`.

### Backend layering: routers, services, schemas, models

`CLAUDE.md` fixes the package layout — `api/`, `core/`, `services/`, `schemas/`, `models/` as siblings under `backend/app/` — and the rule that goes with it: routers validate input and call services, services hold the business logic and are testable without HTTP, models are plain persistence.

A flatter arrangement was considered, on the argument that a two-endpoint slice does not need four layers. It is rejected because the boundary is cheap to honour now and expensive to introduce later: the uniqueness rule and the create-a-board-with-the-team rule are already business logic, and if they are written inline in a router then every subsequent capability copies that shape. The concrete commitment is that the service layer receives and returns domain values, and does not handle HTTP concerns or own session lifecycle — the session is provided to it.

### Errors: domain exceptions in services, mapped centrally

Services raise domain exceptions; a single exception handler registered on the application maps them to HTTP status codes and to a response body naming the offending field. Mapping in each router was rejected — it is how a codebase ends up with the same duplicate-name error returning three different status codes.

This matters in this change specifically because the duplicate-name scenario is the one error the API returns that Pydantic cannot express: blank and over-length names are schema validation and are rejected before a service is reached, while uniqueness is only knowable against the database. Both paths must produce the same shape of error body, and the handler is what guarantees that.

### Team and board identifiers: UUID

The spec requires identifiers that are unique and stable. A UUID stored in a native `uuid` column is preferred over a sequential integer key for two reasons: it lets a team or board be referenced by later capabilities and external systems without a round trip to allocate it, and it does not disclose how many teams exist. The second reason is weak today and significant later — board material is typically among the most confidential content an organization holds, and a monotonically increasing identifier in a URL leaks volume.

The trade-off is worse index locality than a sequential key. At these volumes it is immaterial. UUIDv7 would recover time-ordered locality if that ever changes.

### Timestamps: stored as `timestamptz`, exchanged as ISO-8601 in UTC

No timestamp is exposed by this slice, but record-keeping columns are introduced with the first table and the convention has to be set before meetings and their metric values arrive, where it is load-bearing. All timestamps are stored with timezone and handled as UTC internally, matching the rule in `CLAUDE.md`; conversion to a local time is the presentation layer's concern. Naive timestamps were rejected outright: they are the standard source of daylight-saving defects, and a metric recorded an hour out is a real-world failure rather than a cosmetic one.

### Team name uniqueness enforced in the database

The case-insensitive uniqueness the spec requires is enforced by a unique index on the lower-cased name, not by a read-then-write check in the service. A check-then-insert is a race: two concurrent registrations both read no conflict and both insert. The service translates the resulting integrity error into the domain exception that the central handler maps, so the API contract is unaffected by where the rule is enforced.

### Repository layout: `backend/` and `frontend/` in one repository

A single repository with two top-level directories and a `docker-compose.yml` at the root, as `CLAUDE.md` sets out. Separate repositories were rejected because the API contract changes in lockstep with its only consumer at this stage, and two repositories would mean coordinating two commits for one logical change.

### Python tooling: `uv`, Ruff, mypy

`uv` for dependency and environment management, chosen over Poetry and pip-tools for resolution and install speed and for using standard `pyproject.toml` metadata, which keeps the exit path open: moving to another tool later is a matter of changing how the environment is built, not how the project is described. Ruff for linting and formatting and mypy for type checking are fixed by `CLAUDE.md`; they are configured in this change so that the first code written is already subject to them.

### Frontend: React 18 + TypeScript on Vite, TanStack Query for server state

Vite is the current default for a React and TypeScript application and needs no configuration to be useful. Following `CLAUDE.md`, server state goes through TanStack Query and local UI state through React state; no global state library is introduced.

TanStack Query earns its place in this slice rather than anticipating a later one: the page both reads the team list and writes to it, so it already needs fetching, cache invalidation after a successful registration, and request state for the form — the code that would otherwise be hand-rolled in the one place every later page copies from.

Recharts is the chosen charting library but is **not** added in this change, because nothing here renders a chart and `CLAUDE.md` requires that a dependency be added only when it removes meaningful code. It arrives with the capability that charts metric values. No component library is adopted either; that question is deferred below.

A typed API client module under `src/api/` is the one abstraction included, so that the fetch details sit in one place when a second page appears.

### Local orchestration: the whole stack in docker-compose

`CLAUDE.md` makes `docker compose up -d` the way the stack runs locally, and its definition of done requires the feature to work end to end there. So compose defines all three services — PostgreSQL 16 on a named volume, the backend, and the frontend — rather than the database alone.

Running only the database in compose and both applications natively was considered, on the grounds that hot-reload loops are faster outside a container. It is rejected as the *primary* path because it makes the documented command something nobody actually runs, which is how a compose file rots. The cost is mitigated rather than accepted: source directories are bind-mounted and both dev servers run in watch mode inside their containers, so the edit-reload loop still works. Running either half natively against the compose database stays available and supported for anyone who wants the faster loop; the environment variables are the same either way.

### Tests run against real PostgreSQL

Backend tests exercise the API against an actual PostgreSQL instance rather than an in-memory SQLite substitute. This is not incidental: the spec's ordering requirement and its case-insensitive uniqueness guarantee are database behaviors, and verifying them against a different engine would demonstrate that the tests pass, not that the requirement holds. Each spec scenario becomes a named test.

`CLAUDE.md` splits the backend suite into `tests/unit`, `tests/integration` and `tests/features`, sets the coverage floor at 85% of backend lines, and restricts BDD to business rules worth stating in plain language. This change creates all three directories and wires coverage reporting, but writes no BDD feature: the rules it implements are validation and ordering, which the section explicitly calls CRUD plumbing. The red/green highlighting and archiving rules that `CLAUDE.md` names as BDD-worthy arrive with the capabilities that introduce them, and `tests/features` exists so that they have somewhere to go.

Frontend tests use Vitest and Testing Library; the Playwright setup and the first end-to-end flow are included, since "register a team and see it listed" is the flow this change exists to prove.

## Risks / Trade-offs

- **No authentication on any endpoint** → The system must not be deployed anywhere reachable by others, and must not hold real board material, until an access-control capability exists. Services bind to localhost in local development. This is the single most important constraint carried out of this change, because the eventual content of this application is highly confidential and an unauthenticated deployment would expose it wholesale.
- **The skeleton's choices become precedent by default** → Each decision above is recorded with its alternatives and rationale so a later change can revisit one deliberately rather than discovering it as an unexplained convention.
- **Specs and implementation drift apart over time** → Spec scenarios map one-to-one onto named tests, so a requirement that stops holding fails the suite instead of quietly becoming fiction.
- **Four layers over two endpoints reads as over-engineering** → Accepted deliberately, because `CLAUDE.md` fixes the layering and the alternative is that every later capability inherits business logic written inline in a router. The mitigation is that each layer stays thin: no interface, no base class, no dependency-injection machinery beyond what FastAPI already provides.
- **The board definition is currently a name and nothing else** → It is close to speculative, holding no metrics and no targets yet. It stays because `CLAUDE.md` makes the board the thing a team owns, and creating it with the team means no later change has to backfill boards for teams that predate them. If the eventual board shape differs, altering a two-column table is trivial.
- **Case-insensitive name uniqueness is an inferred rule, not a stated one** → Recorded as an assumption in `proposal.md`. It is enforced by a unique index, so relaxing it later is a migration that drops the index, not a change to application logic.
- **Requiring Docker to run the tests raises the bar for a first run** → Accepted, because testing persistence, ordering and uniqueness against the real engine is what makes those tests meaningful.

## Migration Plan

Not applicable in the usual sense: there is no existing system, no data to migrate, and no users to cut over. The rollback path for this change is deleting the repository contents.

The one forward-looking commitment is that the Alembic revision created here becomes the base of the migration chain, so it should be reviewed with the same care as a production migration even though it runs against an empty database.

## Open Questions

These can be answered later without changing the specs, the approach, or the task breakdown:

- Whether a component library is adopted when the UI grows beyond a handful of screens, and which one.
- Whether the board definition's name is allowed to diverge from its team's name once a team can be renamed. Registration names it after the team; nothing yet renames either.
- Whether `docker compose up -d` eventually builds production-shaped images or stays a development-only convenience, which is really the question of what the on-premise deployment looks like.
