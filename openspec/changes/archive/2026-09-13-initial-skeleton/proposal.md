## Why

bmapp is an empty repository: there is no build, no running process, and `openspec/specs/` contains zero capabilities. Nothing about the intended board-meeting product can be specified with confidence until one path through the system has actually been proven end to end.

Specs written before anything runs are hypotheses. Committing the whole product to specs up front would mean validating dozens of hypotheses at once and discovering the wrong ones only after the artifacts have gone stale. A single thin vertical slice — one real user action travelling through UI, API, service, and database and back — validates the architecture and the spec-driven workflow together, on something observable, before the expensive decisions are made.

## What Changes

- Establish the repository structure described in `CLAUDE.md`: a Python backend layered into routers, services, schemas and models; a React + TypeScript frontend; and a PostgreSQL database, with the whole stack orchestrated by docker-compose for local development.
- Introduce the `team-board` capability: a team can be registered and the registered teams can be listed. Registering a team creates the one board definition that belongs to it.
- Expose a REST API for that capability: create a team, and retrieve the list of teams ordered by name.
- Add a single frontend page that registers a team through a form and renders the current list, so the slice is observable without API tooling.
- Add database schema migrations, so the schema is versioned from the first commit rather than retrofitted.
- Add an operational health endpoint and automated tests covering the slice at the API and persistence layers.
- Establish the toolchain `CLAUDE.md` mandates — Ruff, mypy, ESLint and Prettier — and the backend coverage floor, so that the quality gates exist before there is code to retrofit them onto.
- No breaking changes: nothing exists yet to break.

## Capabilities

### New Capabilities

- `team-board`: Registering teams and the board definition belonging to each one. Covers the registration of a team with its board and the retrieval of the team list. This is deliberately the seed capability because the team and its board are the root entities that every plausible later capability depends on — metrics hang off a board, meetings are held by a team and carry the metric values recorded at them, and problems and tasks are tracked against the team that owns the board — so it is safe to build before the wider product shape is settled.

### Modified Capabilities

None. This is the first change in the project and `openspec/specs/` is empty, so there are no existing requirements to modify.

## Impact

- **New code**: `backend/` (FastAPI application, data model, migrations, tests) and `frontend/` (React + TypeScript single page). No existing code is affected because none exists.
- **New API surface**: team registration and team listing endpoints, plus a health endpoint. Nothing consumes these yet, so the contract is free to evolve in later changes.
- **Data**: introduces the first PostgreSQL tables — teams and board definitions — and the migration chain that every later change extends.
- **Local development**: establishes `docker compose up -d` as the way the whole stack is run locally, and the commands for building, testing, linting and type-checking both halves.
- **Non-goals**: authentication and authorization; employees and team membership; meetings; metrics, their values and targets; problems; tasks; archiving; and deployment to any shared environment. Each is a capability of its own in a later change. The board definition created here holds only its name — the metrics and custom targets that `CLAUDE.md` gives it arrive with the capability that needs them.

## Assumptions

These were not stated in the request and are recorded here so they can be challenged before implementation begins:

- **Walking skeleton, not bootstrap-only.** The change includes one real end-to-end feature rather than scaffolding alone, so that it produces a genuine capability spec and something observable.
- **Stack and layout follow `CLAUDE.md`**, which is treated as authoritative wherever it speaks. The choices it leaves open — the Python web framework, the mapper, the identifier type — are decided in `design.md`.
- **The slice is team registration and listing.** Chosen because it is the thinnest action that is still real, and because the team and its board are needed regardless of which direction the product takes.
- **A team gets exactly one board, created with it.** `CLAUDE.md` gives a team "one board definition"; creating it implicitly means there is no window in which a team exists without a board, and no second endpoint to reach before the slice is observable.
- **Team names are unique, compared case-insensitively.** Not stated in `CLAUDE.md`. Assumed because a team is chosen by name wherever a board is selected, and two teams named "Platform" would be indistinguishable there. If the organization genuinely has same-named teams, this constraint is the thing to drop.
- **Recharts is the chosen charting library but is not installed in this change.** No chart is rendered by this slice, and `CLAUDE.md` requires that a dependency be added only when it removes meaningful code. It arrives with the capability that charts metric values. TanStack Query, by contrast, is adopted now, because this slice already fetches server state and `CLAUDE.md` makes it the standing convention for that.
- **No authentication in this change.** Every endpoint is open in local development. This is acceptable only because nothing is deployed and no real board material exists yet; access control is a prerequisite before any shared deployment.
