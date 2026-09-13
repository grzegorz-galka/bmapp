## 1. Repository and local environment

- [x] 1.1 Initialize the git repository on `main` and add a `.gitignore` covering Python artifacts, virtualenvs, `node_modules`, build output, and local env files; verify `git status` on a freshly built tree reports no generated files
- [x] 1.2 Create the top-level layout with `backend/` and `frontend/` directories, and inside `backend/app/` the `api/`, `core/`, `models/`, `schemas/` and `services/` packages; verify every package imports cleanly and holds no build output
- [x] 1.3 Create `backend/pyproject.toml` managed by `uv`, declaring FastAPI, SQLAlchemy 2.x, Alembic, the PostgreSQL driver, pytest, pytest-cov, and httpx; verify `uv sync` completes and `uv run python -c "import fastapi, sqlalchemy, alembic"` exits zero
- [x] 1.4 Configure Ruff and mypy in `backend/pyproject.toml`; verify `uv run ruff check . && uv run ruff format --check . && uv run mypy app` exits zero on the empty skeleton
- [x] 1.5 Add `.env.example` documenting every environment variable, and backend configuration in `app/core/` that reads the database connection from the environment with a local-development default and binds the service to localhost only; verify the application starts against the compose database and that no `.env` file is tracked by git
- [x] 1.6 Add a root `docker-compose.yml` defining PostgreSQL 16 on a named volume plus the backend and frontend services, with source directories bind-mounted and both dev servers in watch mode; verify `docker compose up -d` brings all three up, that a client connects to the database, and that editing a backend and a frontend source file each triggers a reload without a rebuild

## 2. Database schema and migrations

- [x] 2.1 Define the team and board-definition models in `app/models/` — UUID primary keys, team name, board name, and the board's foreign key to its team — with the one-to-one relationship between them; verify both tables appear in the SQLAlchemy metadata and the modules import cleanly
- [x] 2.2 Initialize Alembic and generate the base revision creating both tables; verify `alembic upgrade head` against an empty database creates them and `alembic downgrade base` removes them
- [x] 2.3 Enforce in that revision the not-null and 200-character constraints on the team name, a unique index on its lower-cased value, and the one-board-per-team constraint; verify the database itself rejects a blank name, an over-length name, a name differing from an existing one only by case, and a second board for the same team

## 3. Team-board API

- [x] 3.1 Define request and response schemas in `app/schemas/` that trim the team name and require it to be non-blank and at most 200 characters once trimmed; verify unit tests reject blank, whitespace-only and over-length names, and that a padded name is accepted and trimmed
- [x] 3.2 Implement the registration service in `app/services/` that persists the team, creates its board named after it, and generates both UUIDs; verify a unit test exercises it against a session with no HTTP involved and that the returned team carries its board
- [x] 3.3 Have the service translate the unique-index violation into a domain exception for a duplicate team name; verify a test registering the same name twice, differing only in case, receives that exception rather than an integrity error
- [x] 3.4 Register a single exception handler mapping domain exceptions to status codes and to an error body naming the offending field; verify a duplicate-name request and a blank-name request both return a body identifying the name field, in the same shape
- [x] 3.5 Add the `POST /teams` and `GET /teams` routers in `app/api/`, with retrieval returning all registered teams ordered by name ascending; verify the routers only validate and delegate, and that a test with out-of-order registrations receives them in ascending order
- [x] 3.6 Add a health endpoint reporting application liveness and database reachability; verify it reports healthy with the compose database up and unhealthy with it stopped

## 4. Backend tests covering the spec

- [x] 4.1 Create `tests/unit`, `tests/integration` and `tests/features`, and configure pytest to run integration tests against a real PostgreSQL instance with per-test isolation; verify the suite passes twice in a row without a manual database reset
- [x] 4.2 Write one named test for each scenario of "Register a team with its board" — successful registration, missing or blank name, over-length name, duplicate name differing by case, and surrounding whitespace removed; verify all five pass
- [x] 4.3 Write one named test for each scenario of "Retrieve the registered teams" — ordered results and the empty list; verify both pass and that the empty case returns a list rather than an error
- [x] 4.4 Check that every scenario in `specs/team-board/spec.md` has exactly one corresponding test and no scenario is unrepresented; verify by listing test names against the spec's scenario names
- [x] 4.5 Enable coverage reporting and confirm the backend meets the 85% line floor; verify `uv run pytest --cov=app --cov-report=term-missing` reports at or above it

## 5. Frontend slice

- [x] 5.1 Scaffold a React 18 and TypeScript application on Vite in `frontend/`, with ESLint, Prettier and strict TypeScript configured; verify `npm run dev` serves the page, `npm run build` completes, and `npm run lint && npm run typecheck` exits zero
- [x] 5.2 Add a typed API client module under `src/api/` covering team registration and team listing; verify `tsc --noEmit` passes with no implicit any in the client
- [x] 5.3 Add the TanStack Query provider and a query for the team list; verify the list renders from the query and that no server state is held in React state
- [x] 5.4 Build the teams page under `src/features/` with a registration form and a list rendering the API's order, invalidating the team-list query on success; verify that submitting the form causes the new team to appear without a manual reload
- [x] 5.5 Surface API validation errors against the offending form field; verify that a blank name and a duplicate name each show an error on the name field and create no record
- [x] 5.6 Add Vitest and Testing Library and cover the page's behaviour — rendering the list, a successful registration, and a rejected one; verify `npm run test` passes
- [x] 5.7 Configure the development proxy so the frontend reaches the backend inside compose; verify the page loads teams with no CORS error in the browser console

## 6. End-to-end verification and documentation

- [x] 6.1 Add Playwright and an end-to-end test registering a team and seeing it listed; verify `npm run test:e2e` passes against the running stack
- [x] 6.2 Walk the whole slice from a clean checkout — `docker compose up -d`, run migrations, register a team through the page, reload; verify the team persists across the reload and a backend restart
- [x] 6.3 Write the README with prerequisites and the exact commands to run the stack, the tests and the quality gates; verify by following it verbatim on a clean checkout with no prior knowledge
- [x] 6.4 Reconcile `CLAUDE.md` with what was actually built — remove the "Decisions marked chosen are proposals" note, correct the repository layout and command sections if they drifted during implementation, and drop the "Current state" section that says no code exists; verify by reading it against the tree
- [x] 6.5 Confirm the deployment constraint holds — every service binds to localhost, no endpoint is exposed externally, and no real board material is present; verify by inspecting the bound addresses of the running containers
