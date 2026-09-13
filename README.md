# BMAPP — Board Meetings Application

BMAPP provides an online board for the weekly team briefings ("board meetings")
that software teams here run along Kaizen / Lean lines: performance indicators
with their trends, the problems the team is working through, and the tasks it
has agreed.

This repository currently contains the **walking skeleton**: one vertical slice
— register a team and see the registered teams — proven end to end through the
UI, the API, a service layer and PostgreSQL. See `openspec/` for what is
specified and `CLAUDE.md` for the conventions.

> **Not deployable.** No endpoint is authenticated. Every service binds to
> `127.0.0.1` and the stack must not be exposed to a network or hold real board
> material until an access-control capability exists.

## Prerequisites

- Docker with Compose v2
- [uv](https://docs.astral.sh/uv/) — backend dependencies and commands
- Node.js 24+ and npm — frontend

## Run the stack

```bash
cp .env.example .env          # optional; the defaults below are the same
docker compose up -d          # PostgreSQL + backend + frontend
docker compose exec backend alembic upgrade head
```

Then open <http://localhost:5173>.

| Service  | URL                                            |
|----------|------------------------------------------------|
| Frontend | <http://localhost:5173>                        |
| API      | <http://localhost:8000>, docs at `/docs`       |
| Health   | <http://localhost:8000/health>                 |
| Database | `localhost:5432`                               |

Sources are bind-mounted and both dev servers watch them, so edits reload
without a rebuild. Rebuild only when a dependency changes:

```bash
docker compose build && docker compose up -d
```

**Port already in use?** Every published port is configurable, so the stack can
coexist with another Postgres or API on the same machine:

```bash
BMAPP_DB_PORT=55432 docker compose up -d      # or BMAPP_API_PORT / BMAPP_WEB_PORT
```

## Run it natively instead

The container reload loop is fine, but running either half on the host is
faster. Start the database from Compose and point the app at it.

```bash
docker compose up -d db

cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload

cd ../frontend
npm install
npm run dev
```

## Tests

The backend suite runs against a **real PostgreSQL**, not an in-memory
substitute: the ordering and case-insensitive uniqueness requirements are
database behaviours. It creates and migrates its own database
(`bmapp_test`) and rolls every test back, so it can be run repeatedly with no
manual reset.

```bash
cd backend
uv run pytest                     # everything (needs the db service up)
uv run pytest tests/unit          # fast, no I/O
uv run pytest --cov=app --cov-report=term-missing   # fails below 85%
```

```bash
cd frontend
npm run test                      # Vitest + Testing Library
npm run test:e2e                  # Playwright, needs the stack running
```

First Playwright run only:

```bash
npx playwright install chromium
```

Dependency majors are upgraded as a change of their own; see
`openspec/changes/archive/` for what landed and why any version is held back.

If the database is not on the default port, point the suite at it:

```bash
export BMAPP_TEST_DATABASE_URL=postgresql+psycopg://bmapp:bmapp@localhost:55432/bmapp_test
```

## Quality gates

CI runs these; they must be green before merge.

```bash
cd backend  && uv run ruff check . && uv run ruff format --check . && uv run mypy app
cd frontend && npm run lint && npm run typecheck
```

## Database changes

Every schema change goes through a migration; never edit one that has merged.

```bash
cd backend
uv run alembic revision --autogenerate -m "describe change"
uv run alembic upgrade head
```

## Configuration

All configuration comes from environment variables — see `.env.example` for
the full list. Never commit `.env`.
