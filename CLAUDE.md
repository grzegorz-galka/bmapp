# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

BMAPP — Board Meetings Application. Keep this file short and current: when a
convention changes, update it in the same PR.

## Project overview

BMAPP supports weekly team briefings in the organization. These meetings follow
Kaizen / Lean practice, but the teams here are software teams, not manufacturing
teams. The briefings are called "board meetings" because the team meets at a
board. BMAPP provides that board online and lets a team:

1. Record the values of the team's metrics for this meeting. The board shows a
   trend chart per metric and highlights the current value in red or green
   depending on whether it is below the acceptable minimum or above the
   acceptable maximum.
2. Register new problems and update the status of tracked problems.
3. Register new tasks and update the status of tracked tasks.

## Functional requirements

1. The company-wide mission, vision, values and strategic targets are visible on
   every board. These are declarations in prose, not numbers.
2. Every team has its own board with its own metrics, problems table and tasks
   table.
3. The team leader configures the board for their team: its metrics with their
   acceptable min / max, and custom targets. Company-wide targets are inherited.
4. An employee can be a member of one or many teams.
5. Closed problems and completed tasks are archived and can be viewed in an
   "Archived" tab.
6. Current metric values are shown in red or green depending on status, together
   with charts showing their trend.
7. Board meetings are recorded. Every metric value belongs to the meeting at
   which it was recorded, so a value has no date of its own and the trend runs
   along the sequence of meetings.

## Domain model

| Entity            | Main properties                                                              |
|-------------------|------------------------------------------------------------------------------|
| Employee          | email, teams (many)                                                          |
| Team              | name, members (many), one board definition                                   |
| Board definition  | name, metrics (many), custom targets (optional)                              |
| Meeting           | team, date and time, the metric values recorded at it                        |
| Metric            | name, unit, acceptable min / max, values over time (each bound to a meeting) |
| Metric value      | metric, meeting, the number recorded                                         |
| Problem           | summary, reason, solution proposal, responsible employee, due date, progress |
| Task              | summary, details, responsible employee, due date, progress                   |

Glossary (use these exact terms in code, UI and tests):

- **Hub** — the landing page at `/`: the company declarations, the user's teams
  and the countdown to their next meeting, what can be done at a board meeting,
  and the problem/task funnel. Not a board; the way in to them.
- **Board** — a team's page: metrics + problems + tasks.
- **Meeting** — one occurrence of a team's board meeting. Metric values are recorded at a meeting and belong to it.
- **Metric** — a named thing the team measures (e.g. "Open bugs"), with a unit and an acceptable min/max. Teams track metrics directly.
- **Metric value** — one number, recorded at one meeting, for one metric. Its date is the meeting's date; it has none of its own.
- **Target** — a declaration in prose, *not* a numeric range: what the company or the team is aiming at. Company-wide targets appear on every board; a team may add **custom targets**. Red/green never comes from a target — only from the metric's min/max.
- **Problem** — an obstacle identified at the board meeting; has a root cause ("reason") and a proposed solution.
- **Task** — an action item. Problems and tasks are **archived**, never deleted, once closed/done.

**Indicator** is deliberately *not* a concept here. An earlier draft had metrics
grouped under indicators (KPIs); teams track metrics directly instead. Do not
reintroduce it without a change that says why.

## Tech stack

Three-tier web application hosted on-premise.

| Layer    | Choice                                                                             | Notes                                |
|----------|------------------------------------------------------------------------------------|--------------------------------------|
| Database | PostgreSQL 18                                                                      | Migrations via Alembic               |
| Backend  | Python 3.14, FastAPI, SQLAlchemy 2.x, Pydantic v2                                  | REST API, OpenAPI generated          |
| Frontend | React 19 + TypeScript 6, Vite 8, react-router, TanStack Query, Recharts, i18next + react-i18next, IBM Plex via @fontsource | Vue was an option; React was chosen  |
| Tests    | pytest, pytest-cov, httpx (API), Vitest + Testing Library, Playwright              | pytest-bdd for BDD where it pays off |
| Tooling  | uv (Python deps), Ruff (lint+format), mypy, ESLint + Prettier                      |                                      |
| Runtime  | Docker Compose for local dev; single Compose stack on-prem                         | Node 24 and Python 3.14 base images  |

Recharts is the agreed charting library but is not installed yet: nothing
renders a chart until metrics arrive — the hub's bar glyph is three coloured
`div`s. Everything else in the table is in the tree and exercised by the test
suite.

**TypeScript stays on 6, not 7, deliberately.** TypeScript 7.0 is the native
compiler port and works for `tsc`, the build and the tests, but
`typescript-eslint` 8.70 — the newest release there is — refuses to load
against it (`typescript-eslint does not support TS 7.0`), which takes
`npm run lint` to exit 2. 6.0.3 sits inside its supported range and keeps every
gate green. Revisit when a `typescript-eslint` release supports TS 7.

**The interface is bilingual: English and Polish.** Every user-facing string
lives in `frontend/src/i18n/en.ts` and `frontend/src/i18n/pl.ts`, never as a
literal in a component - headings, labels, button captions, empty and loading
states, and `aria-*` text alike. `pl.ts` is annotated as `Translations`, the
type derived from the English catalogue, so a key added to one catalogue and
not the other is a `tsc` error rather than a silent English fallback in a
Polish page. `t()` keys are type-checked the same way. Translations of the
domain glossary (Tablica, Spotkanie, Zespół, Wskaźnik, Zadanie) are fixed in the
`add-i18n-en-pl` change's `design.md`; follow them rather than inventing
synonyms. Language is resolved from a remembered choice, then the
browser, then English, and a switcher sits in the app header.

**API field errors carry a stable `code`.** Every entry in an error response is
`{field, code, message}`. `code` names the reason (`team_name.duplicate`) and is
what the frontend translates; `message` is English text for a developer and is
never displayed. A code is part of the published API - once released it is not
renamed, and adding one is a spec change. Services set it on their `DomainError`
subclass; Pydantic validators carry it by raising `PydanticCustomError` with the
code as its type.

**IBM Plex is self-hosted, not fetched from a CDN.** The fonts come from
`@fontsource-variable/ibm-plex-sans` and `@fontsource/ibm-plex-mono` and are
bundled. The deployment is on-premise and cannot assume the public internet is
reachable, so a Google Fonts link would silently fall back to a system stack on
exactly the machines that run the application.

**Theme tokens live in `frontend/src/styles/theme.css`; components use CSS
Modules.** Two palettes selected by `html[data-theme="dark"|"light"]`, dark by
default, the choice remembered under `bmapp.theme`. A small inline script in
`index.html` applies a remembered theme before the bundle loads so the wrong
theme never flashes; it repeats the key and the default as literals, and
`src/theme/noFlash.test.ts` asserts those match the module's constants. Every
ink/surface pairing is held to 4.5:1 and control boundaries to 3:1 by
`src/styles/contrast.test.ts`, which parses the stylesheet rather than
restating it. Use `--line-control`, not `--line`, on anything operable.

**Changing a frontend dependency needs more than `docker compose up -d`.** The
frontend container installs into an anonymous `/app/node_modules` volume that
survives both a rebuild and `up -d`. After adding or upgrading a package, run
`docker compose up -d --build --renew-anon-volumes frontend`, or the dev server
keeps resolving against the old tree and fails on the new import.

**PostgreSQL 18 images changed where the data volume mounts.** The cluster now
lives in a version-specific subdirectory under `/var/lib/postgresql`, so
`docker-compose.yml` mounts there rather than at `/var/lib/postgresql/data`.
A version 18 server will not start against a volume mounted the old way.

## How work is done here: OpenSpec

This repository is spec-driven. Behaviour is agreed in `openspec/` **before** it
is implemented; the specs, not the code, are the record of what the system must
do. The `openspec` CLI (v1.13.0) is installed and drives the workflow.

```
openspec/
├── config.yaml           # schema: spec-driven, plus project context and rules
├── specs/<capability>/   # the current agreed behaviour (source of truth)
└── changes/
    ├── <change-name>/    # one in-flight change
    │   ├── proposal.md   # why, what changes, impact, assumptions
    │   ├── design.md     # technical decisions with alternatives and rationale
    │   ├── specs/<capability>/spec.md   # a DELTA (ADDED/MODIFIED/REMOVED), not the full spec
    │   └── tasks.md      # ordered implementation steps, each with a verification
    └── archive/          # changes that have shipped
```

The lifecycle, each step a slash command backed by a skill in `.claude/skills/`:

| Command | Purpose |
|---------------------|--------------------------------------------------------|
| `/opsx:explore` | Think a problem through before committing to a change. |
| `/opsx:propose` | Create a change and generate all four artifacts. |
| `/opsx:update` | Revise an existing change, keeping artifacts coherent. |
| `/opsx:apply` | Implement `tasks.md`, ticking items off as they pass. |
| `/opsx:sync` | Fold a change's delta spec into `openspec/specs/`. |
| `/opsx:archive` | Finalize a completed change and move it to `archive/`. |

Rules that matter:

- **Planning commands never edit project code.** `/opsx:propose` and
  `/opsx:update` produce artifacts and then stop, even if the request that
  triggered them asked for the feature to be built. Implementation starts only
  on a fresh request, through `/opsx:apply`.
- **Change specs are deltas.** A file under `changes/<name>/specs/` lists only
  what is added, modified or removed. The merged result lands in
  `openspec/specs/` at sync or archive time.
- **Every requirement carries scenarios**, and every scenario maps one-to-one
  onto a named automated test. Spec drift then shows up as a failing test
  instead of being discovered by reading.
- Useful reads: `openspec list`, `openspec status --change <name> --json`,
  `openspec show <name>`, `openspec validate <name>`.

## Current state

`initial-skeleton` is implemented: `docker compose up -d` brings up PostgreSQL,
the API and the web app, and the one slice that exists end to end is the
`team-board` capability — register a team (which creates the one board it owns)
and list the registered teams. `localization` is implemented on top of it: the
interface reads in English or Polish, and API rejections arrive as codes the
frontend translates, and dates, times and numbers are formatted for the active
language. `hub` and `appearance` are implemented too: the application opens on
the hub at `/` with the team page at `/teams`, and the interface has a dark and
a light theme with dark the default.

**The hub is served from placeholder data.** `GET /hub` returns one read-only
payload built from constants in `app/services/hub.py` — no tables, no
migration, no database session. It exists so the shell is real while the
capabilities behind it are built, and it marks itself `provisional` so nothing
mistakes its figures for recorded data. Each future capability replaces a slice
of it; the shape it returns is the shape they should return.

Everything else in the domain model above — employees and membership, meetings,
metrics and their values, targets, problems, tasks, archiving, and
authentication — is agreed but not built. Each is a capability of its own;
propose it through `/opsx:propose` rather than adding it inline.

## Repository layout

```
.
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI routers, one module per resource
│   │   ├── core/         # config, db session, security
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic request/response models
│   │   ├── services/     # business logic (no HTTP, no ORM session handling)
│   │   └── main.py
│   ├── alembic/
│   └── tests/
│       ├── unit/
│       ├── integration/  # hit the real Postgres from docker-compose
│       └── features/     # BDD .feature files + step defs
├── frontend/
│   ├── src/
│   │   ├── api/          # typed fetch wrappers; client.ts is the shared one
│   │   ├── components/   # the app shell: header, nav, language, theme
│   │   ├── features/     # hub, teams - board, problems, tasks, admin to come
│   │   ├── i18n/         # catalogues, detection, Intl formatting
│   │   ├── styles/       # theme.css: the palettes and the design tokens
│   │   ├── theme/        # theme resolution, persistence and provider
│   │   └── routes.tsx    # the route table
│   └── e2e/              # Playwright
├── mockups/              # agreed visual designs (Claude Design artboards)
├── openspec/             # specs and changes - see above
├── docker-compose.yml
├── README.md
└── CLAUDE.md
```

`backend/tests/features/` exists but is empty: what has been built so far is
validation, ordering, layout and a date calculation, which the Testing section
calls CRUD plumbing. The first BDD feature arrives with red/green highlighting
or archiving.

`src/pages/` never appeared; a feature folder holds its own page component, and
routing is one file. Reinstate it only when a page belongs to no feature.

## Common commands

Run from the repo root unless stated otherwise. `README.md` has the fuller
version, including how to run either half natively.

```bash
openspec list                    # changes in flight
openspec show <change>           # read one
```

```bash
# Start everything (Postgres + backend + frontend) for local development.
# Every published port is bound to 127.0.0.1 and overridable via
# BMAPP_DB_PORT / BMAPP_API_PORT / BMAPP_WEB_PORT if one is already taken.
docker compose up -d
docker compose exec backend alembic upgrade head

# Backend
cd backend
uv sync                          # install deps
uv run uvicorn app.main:app --reload
uv run pytest                    # all tests (needs the db service up)
uv run pytest tests/unit         # fast tests only, no I/O
uv run pytest --cov=app --cov-report=term-missing
uv run ruff check . && uv run ruff format --check . && uv run mypy app
uv run alembic revision --autogenerate -m "describe change"
uv run alembic upgrade head

# Frontend
cd frontend
npm install
npm run dev
npm run test                     # Vitest
npm run test:e2e                 # Playwright (needs backend running)
npm run lint && npm run typecheck
```

## Coding standards

- **KISS.** Prefer the simplest thing that works. No abstraction until it is
  needed twice. No frameworks-within-frameworks.
- **Pragmatic best practices.** Type hints everywhere in Python; strict
  TypeScript in the frontend. Small functions, clear names, no clever code.
- **Layering.** Routers validate input and call services. Services hold
  business logic and are testable without HTTP. Models are plain persistence.
- **Errors.** Raise domain exceptions in services; map them to HTTP status codes
  in one place (an exception handler), not in every router.
- **Database.** Every schema change goes through an Alembic migration. Never
  edit a migration that has been merged.
- **API.** REST, plural nouns (`/teams/{id}/problems`), JSON, ISO 8601 dates,
  UTC in storage.
- **Frontend.** Server state via TanStack Query; local UI state via React
  state. No global state library unless a real need appears.
- **Dependencies.** Add a dependency only if it removes meaningful code.
  Mention new dependencies explicitly in the PR description.
- **Comments.** Explain *why*, not *what*. No commented-out code.

## Testing

High coverage is a requirement, not a goal. Aim for ≥ 85% line coverage on the
backend and meaningful coverage of every user-facing flow on the frontend.

- **Unit tests** for services and pure functions. Fast, no I/O.
- **Integration tests** for API endpoints against a real Postgres. Use
  fixtures for test data; each test starts from a clean state.
- **GUI tests** (Playwright) for the main flows: view board, record a meeting's
  metric values, add/close problem, add/complete task, configure metrics, view
  archive.
- **BDD tests** (pytest-bdd) only for business rules worth stating in plain
  language, e.g. red/green highlighting of a metric value against its min/max,
  archiving. Do not write BDD for CRUD plumbing. Target inheritance is not one
  of these: targets are declarations that are displayed, not evaluated.
- A change is not done until its tests pass locally and coverage does not drop.

## Git workflow

- Branch from `main`: `feature/<short-name>`, `fix/<short-name>`.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`,
  `docs:`, `chore:`). Imperative mood, ≤ 72 chars in the subject line.
- Every change goes through a PR. PR description states *what* and *why*, lists
  new dependencies, and links the change's `design.md` if an architectural
  decision was made.
- CI must be green (lint, type check, all tests) before merge.
- Do not push directly to `main`. Do not force-push shared branches.

## Definition of done

A task is done when:

1. Code follows the standards above and passes lint + type checks.
2. Unit and integration tests exist and pass; GUI/BDD tests added where the
   Testing section requires them.
3. Migrations are included and applied cleanly on an empty database.
4. The feature works end to end in `docker compose up`.
5. Documentation (this file, the change's `design.md`, README) is updated if
   behaviour or conventions changed.

## Security and configuration

- All configuration comes from environment variables (see `.env.example`).
  Never commit `.env` or any secret.
- Authentication (agreed, not yet built): a **federated chain of two OIDC /
  OAuth2 hops** — the application delegates to an identity broker, which in turn
  delegates to ADFS. The employee's email is the identity BMAPP keys on. This
  gets its own change; nothing about it exists yet.
- Until that lands, a **`dev-basic-auth` profile behind a feature toggle**: HTTP
  Basic, user ids are employee emails, passwords in a local file. It exists so
  that authorization rules can be built and tested before the federation is
  available. Non-negotiable constraints, because the passwords are plain text:
  the toggle is **off by default**; the password file is **never committed** and
  must be added to `.gitignore` by the change that introduces it; it holds test
  accounts only, never a real
  credential; the stack stays bound to `127.0.0.1`; and enabling it must be
  impossible in a deployed environment, not merely discouraged. Anything
  deployed uses the federated chain or is not deployed.
- Authorization: team leaders can configure their own board; members can edit
  problems and tasks of their own teams; everyone can read every board.
- Validate all input at the API boundary with Pydantic. Never build SQL strings.
- Log at INFO for business events, DEBUG for details. No personal data in logs
  beyond the employee email where needed for auditing.

## Things Claude should do / avoid

Do:

- Read the relevant service and its tests before changing behaviour.
- Run the narrowest relevant test set first, then the full suite before finishing.
- Prefer editing existing modules over creating new ones.
- Ask when a requirement is ambiguous instead of guessing business rules.

Avoid:

- Adding libraries, patterns or configuration "for the future".
- Changing the public API shape without updating the frontend client and tests.
- Skipping or weakening tests to get to green.
- Deleting archived problems or tasks — archiving is the only end state.

## Open decisions

Decisions are recorded in the `design.md` of the change that settles them, under
*Decisions* (with the alternatives considered) or *Open Questions*. `docs/adr/`
does not exist yet; adopt it only if a decision genuinely spans changes, and
record that adoption itself as a decision. Remove an item below once decided.

- Whether metric values are typed in at the meeting or imported from external
  systems (Jira, CI, etc.). Partly settled: either way a value belongs to a
  meeting, so an import has to attach to one. What is still open is whether
  import exists at all.
- Whether one employee can be team leader of more than one team.
- Retention period for archived items and recorded meetings.
- Whether a meeting records attendance, and whether a problem or task is tied to
  the meeting that raised or closed it.
