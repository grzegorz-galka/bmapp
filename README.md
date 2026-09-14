# BMAPP — Board Meetings Application

BMAPP provides an online board for the weekly team briefings ("board meetings")
that software teams here run along Kaizen / Lean lines: performance indicators
with their trends, the problems the team is working through, and the tasks it
has agreed.

This repository currently contains the **walking skeleton**. One vertical slice
is real end to end through the UI, the API, a service layer and PostgreSQL:
register a team and see the registered teams, at `/teams`. On top of it sits
the **hub** at `/`, the landing page built from the mockup in `mockups/` — the
company declarations, your teams and the countdown to the next board meeting,
what happens at a board meeting, and the problem and task funnel. See
`openspec/` for what is specified and `CLAUDE.md` for the conventions.

> **The hub's figures are placeholder data.** They come from one read-only
> endpoint, `GET /hub`, built from constants: no tables, no migration, nothing
> recorded. The response says so in a `provisional` field and the page says so
> at the foot. It exists so the shell is real while the capabilities behind it
> — meetings, metrics, problems, tasks — are built; each will replace a slice
> of it.

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

Then open <http://localhost:5173>. You land on the hub; the team registration
page is at `/teams`, reachable from the header. The header also carries the
English/Polish switcher and the dark/light theme toggle — dark by default, and
your choice is remembered.

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

The frontend needs one flag more. Its dependencies live in an anonymous
`/app/node_modules` volume that survives both a rebuild and `up -d`, so after
adding or upgrading an npm package the dev server keeps resolving against the
old tree and fails on the new import:

```bash
docker compose up -d --build --renew-anon-volumes frontend
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

## Language

The interface reads in **English** or **Polish**. Which one you get is decided
once at startup: a language you chose explicitly before, else the first
supported language the browser asks for (`pl-PL` counts as Polish), else
English.

To read it in Polish, pick Polish in the switcher in the page header. The
choice is remembered in `localStorage` under `bmapp.language` and applies on
your next visit, so to get back to browser detection, clear that key. You can
also set it directly — this is how the Playwright specs pin a language:

```js
localStorage.setItem('bmapp.language', 'pl');   // in the browser console, then reload
```

### Adding a language

Catalogues are TypeScript, not JSON, so that the compiler owns completeness: a
key present in one language and missing from another is a `tsc` error rather
than a silent English fallback in a translated page. To add German, say:

1. Add `'de'` to `SUPPORTED_LANGUAGES` in `frontend/src/i18n/languages.ts`.
2. Add a `language.de` entry to `en.ts`, naming the language *in* that language
   (`Deutsch`). The switcher lists whatever `SUPPORTED_LANGUAGES` holds.
3. Create `frontend/src/i18n/de.ts` exporting `const de: Translations = {…}`.
   Annotating it as `Translations` is what makes the next step tell you exactly
   which keys you still owe.
4. Register it in `frontend/src/i18n/index.ts` under `resources`.
5. Run `npm run typecheck`. A missing key and a stray key are both compile
   errors; `npm run test` additionally compares the key sets, which catches a
   loosened annotation.

Domain vocabulary follows the glossary in the `add-i18n-en-pl` change's
`design.md` — translate against it rather than inventing synonyms.

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
