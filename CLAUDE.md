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
   trend chart per metric and colours the current value green, amber or red
   against the threshold in force at that meeting.
2. Register new problems and update the status of tracked problems.
3. Register new tasks and update the status of tracked tasks.

## Functional requirements

1. The company-wide mission, vision, values and strategic targets are visible on
   every board. These are declarations in prose, not numbers.
2. Every team has its own board with its own metrics, problems table and tasks
   table.
3. The team leader configures the board for their team: its metrics with their
   thresholds, and custom targets. Company-wide targets are inherited.
4. An employee can be a member of one or many teams.
5. Closed problems and completed tasks are archived and can be viewed in an
   "Archived" tab.
6. Current metric values are shown green, amber or red depending on status,
   together with charts showing their trend.
7. Board meetings are recorded. Every metric value belongs to the meeting at
   which it was recorded, so a value has no date of its own and the trend runs
   along the sequence of meetings.

## Domain model

| Entity            | Main properties                                                                    |
|-------------------|------------------------------------------------------------------------------      |
| Employee          | email, teams (many)                                                                |
| Team              | name, team leader, members (many), board definition                                |
| Board definition  | name, metric groups (many, ordered), metrics (many) each placed in at most one group with position and owner; custom targets (optional), schedule |
| Meeting           | team, date and time, the metric values recorded at it                              |
| Metric            | board (none if global), name, unit, decimals, direction, thresholds (many), values (many) |
| Threshold         | metric, effective from, green and amber boundaries, reason, who recorded it        |
| Metric value      | metric, meeting, the number recorded, comment, colour set by hand (optional)       |
| Pulse answer      | meeting, respondent (a member), rating 1–5, what helped, what hurt, what could be better |
| Problem           | team, summary, reason, solution proposal, responsible member, due date, metric (optional), PDCA stage, meetings raised and closed at |
| Task              | team, summary, details, responsible member, due date, metric and problem (optional), PDCA stage, meetings raised and closed at |

Glossary (use these exact terms in code, UI and tests):

- **Dashboard** (*Pulpit*) — the landing page at `/`: the company declarations,
  the viewer's teams and the countdown to their next meeting, their board
  meetings with the actions to prepare data, fill the pulse check and start
  one, and their teams' problems and tasks with those assigned to them. Not a
  board; the way in to them. It was called the hub until
  `rework-hub-into-dashboard`; do not bring that name back.
- **Board** — a team's page: metrics + problems + tasks.
- **Meeting** — one occurrence of a team's board meeting. Metric values are recorded at a meeting and belong to it. Opened explicitly by a member; a skipped week simply has none.
- **Schedule** — the weekday and start time a board's team meets, on the organization's clock (Europe/Warsaw). It proposes the next meeting's date; it never creates meetings.
- **Host** — the member who runs one meeting (*prowadzący*). Rotates from meeting to meeting; not the team leader.
- **Leader deputy** (*zastępca lidera*) — a member who stands in for the team leader: configures the board and schedule and adds and removes ordinary members. A team has any number, never the leader. Only the leader or an administrator appoints, revokes or removes one; who leads stays an administrator's decision. Code `deputy`.
- **Metric** — a named thing the team measures (e.g. "Open bugs"), with a unit and a fixed **direction**: higher is better, lower is better, or within a band. Teams track metrics directly. A metric with values is **retired**, never deleted.
- **Global metric** (*wskaźnik globalny*) — a metric defined once by an administrator in the company-wide catalogue at `/global-metrics`, with its thresholds, and **included** in any number of boards. A board sets only its placement (group, position, owner) and may remove or retire it there; its definition and thresholds are read-only on the board. Each team still records its own values for it. A board's own metric can be **copied** onto another board with its thresholds; the copy is independent.
- **Threshold** (*próg*) — one version of what green and amber mean for a metric, from an effective date on, with a reason. Versions are append-only and may be back-dated; a value is judged against the version in force on its meeting's date.
- **Metric value** — one number, recorded at one meeting, for one metric. Its date is the meeting's date; it has none of its own. It may carry a comment and a **colour set by hand**, which needs the comment.
- **Status** — green, amber, red, no data or no threshold. Computed when read by `status_of`, never stored; boundaries count as the better zone.
- **Target** — a declaration in prose, *not* a numeric range: what the company or the team is aiming at. Company-wide targets appear on every board; a team may add **custom targets**. A colour never comes from a target — only from the metric's threshold.
- **Problem** — an obstacle identified at the board meeting; has a root cause ("reason") and a proposed solution.
- **Task** — an action item, possibly raised from a problem. Problems and tasks are **archived**, never deleted, once closed: an archived item is read-only and cannot be reopened.
- **PDCA stage** — a problem's or task's progress: not started, plan, do, check, act. Any member moves it forwards or back; reaching *act* closes and archives the item. Each item records the meeting it was raised at and the one it was closed at: the team's first meeting dated today or later, else its latest, else none. Overdue means a due date before today (Europe/Warsaw) on an active item, decided on the server.
- **Pulse check** — the weekly survey each member answers for a meeting: a rating 1–5 and three optional texts (what had a positive effect, a negative one, what could be better). The four questions are fixed. A rating's colour comes from fixed bands (4–5 green, 3 amber, 1–2 red), not from a threshold: the pulse check is not a metric. Answers are open at the same meetings as metric values; only the team's members and administrators see who answered what. Kept as "Pulse check" in Polish too.

**Indicator** is deliberately *not* a concept here. An earlier draft had metrics
grouped under indicators (KPIs); teams track metrics directly instead. Do not
reintroduce it without a change that says why.

## Tech stack

Three-tier web application hosted on-premise.

| Layer    | Choice                                                                             | Notes                                |
|----------|------------------------------------------------------------------------------------|--------------------------------------|
| Database | PostgreSQL 18                                                                      | Migrations via Alembic               |
| Backend  | Python 3.14, FastAPI, SQLAlchemy 2.x, Pydantic v2, PyJWT                           | REST API, OpenAPI generated          |
| Frontend | React 19 + TypeScript 6, Vite 8, react-router, TanStack Query, Recharts, i18next + react-i18next, oidc-client-ts, IBM Plex via @fontsource | Vue was an option; React was chosen  |
| Tests    | pytest, pytest-cov, httpx (API), Vitest + Testing Library, Playwright              | pytest-bdd for BDD where it pays off |
| Tooling  | uv (Python deps), Ruff (lint+format), mypy, ESLint + Prettier                      |                                      |
| Runtime  | Docker Compose for local dev; single Compose stack on-prem; Railway for a dev-mode demo only | Node 24 and Python 3.14 base images  |

Recharts is pinned at an exact version and draws the board's sparklines and
the metric detail's trend. Charts plot floats; no status is ever decided from
them. Everything in the table is in the tree and exercised by the test suite.

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
browser, then English. The app header carries a language toggle twinned with
the theme toggle: captioned with the flag and own-language name of the language
it switches to, flags drawn as inline SVG. A toggle means exactly two languages;
`languages.test.ts` pins that.

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

**Buttons come from `src/styles/controls.module.css`, nowhere else.** Four
classes: `.button`, an outlined action; `.default`, the group's default
(a form's submit, Start meeting), accent-outlined; `.segmented`, a set of
views; `.link`, navigation drawn as a link with an icon. Solid accent fill
only marks an on state (`aria-pressed`, `aria-expanded`), never an action.
`src/styles/controls.test.ts` reads every CSS module and fails on a page's
own button rules or a filled action.

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
language. `dashboard` and `appearance` are implemented too: the application opens on
the dashboard at `/`, and the interface has a dark and a light theme with dark the
default. The header names what a person does - Dashboard, My teams (`/my-teams`),
My meetings (`/my-meetings`), My pulse check (`/my-pulse`) - and groups the set-up
pages under a Configuration disclosure: Teams (`/teams`), Team metrics
(`/team-metrics`, a chooser into `/teams/:teamId/metrics`) and Global metrics.
The personal pages read the dashboard summary and the per-team endpoints; there
is no `/me/*` API. Forms that are rarely needed (creating, copying or including
a metric, adding a global metric) open in `components/Modal.tsx`, a native
`<dialog>` in the top layer, which every new dialog should reuse. Two add forms
are deliberately in the page instead: registering a team is a section of the
teams page opened by "Register team", and adding a member is an always-visible
field on the members page.

A team's pages - the board, its meetings, members and metric settings - lead
back to where they were opened from. The entry link records its origin in
react-router location state, the back link names it ("Back to My meetings"),
the board carries it across its own views, and a page with no recorded origin
(a bookmark, a new tab) falls back to its fixed target. Nothing under the
routes renders without a session: after signing out, or when the session
ends, a "Signed out" panel takes the page's place, and in development mode the
login window opens again.
`team-membership` is implemented as well: employees are identified by a lower-cased email and recorded the first time
they are assigned to a team; a team has members and exactly one leader, who is
always one of them, set when the team is registered and handed over between
members on the members page at `/teams/:teamId/members`. One employee may lead
any number of teams. `meetings` is implemented: a board has an optional weekly
schedule set by its leader, and any member opens, moves, hosts and deletes the
team's meetings on the meetings page at `/teams/:teamId/meetings`, one per date
at most, with the next date proposed from the schedule. Dates and times are
wall-clock values on the organization's clock, Europe/Warsaw, fixed in
`app/core/time.py`; instants are stored in UTC.

**The dashboard reads recorded data, except the declarations.** `GET /dashboard`
returns one read-only payload in a fixed number of statements: the caller's
identity from the token, their teams with role, schedule and next meeting, their
board meetings dated today or later (or the schedule's proposal, marked as not
yet opened) with host, recording progress and whether they answered the pulse
check, the problem/task funnel and the items assigned to them. "Editable",
"proposed" and "today" come from the functions the board and the meetings page
use, so the pages cannot disagree. The company declarations are still constants
in `app/services/dashboard.py`, in English and Polish, until the targets
capability makes them editable: headlines only - the mission, the vision, the
values by name, a strategic declaration and goals grouped by horizon, each
horizon travelling with the text. An action on a proposed row opens the meeting
through `POST /teams/:id/meetings` first; the summary itself never writes. The
board's address opens the recording view (`?meeting=…&mode=record`), the pulse
answer form (`?meeting=…&view=pulse&mode=answer`) and a list (`#problems`,
`#tasks`) directly. The My teams and My board meetings tiles show at most three
rows, soonest first, and a "More…" link to `/my-teams` or `/my-meetings` when
there are more. On My teams a team's name leads to its members, its next
meeting (or "No next meeting") to its meetings, and only the nearest row
carries the countdown.

`authentication` and `authorization` are implemented too: every endpoint needs a
verified token, the dashboard reports the caller rather than a placeholder, and writes
are decided per team — administrators from `BMAPP_ADMIN_EMAILS` register teams and
name leaders, a team's leader or its deputies manage its members (only the leader
or an administrator chooses the deputies), and anyone signed in may read
everything.

`metrics` and `metric-values` are implemented: a board's leader defines its
metrics and their versioned thresholds on the settings page at
`/teams/:teamId/metrics`, and members record values at the latest held and the
next meeting on the board at `/teams/:teamId`, which shows a meeting's tiles,
sparklines and each metric's trend. Older meetings are frozen; an administrator
corrects a frozen value with a reason, and the correction is logged. Numbers
are exact decimals (`NUMERIC(21, 6)`) and travel as strings. A meeting with
values can no longer be deleted or moved to another date.

Global metrics and copying are implemented too: administrators keep the
catalogue of global metrics at `/global-metrics`, and a leader includes them in
a board or copies another board's metric from the settings page. A metric's
position, group, owner and retirement on a board live on its placement
(`board_metrics`), not on the metric, so one global metric can sit on many
boards; `metrics.team_id` is null for a global one.

Metric groups are implemented: a board has groups of its own (`metric_groups`),
named, ordered and unique on the board regardless of case, possibly empty. A
placement sits in at most one group (`board_metrics.group_id`) with a position
inside it; there is no group label any more. Whoever configures the board adds,
renames, reorders and deletes groups and arranges the metrics on the settings
page by drag and drop or the keyboard move controls, and the page saves the
whole arrangement at once (`PUT /teams/:teamId/metric-layout`), refused as
stale if the board changed meanwhile. The board shows the groups in that order,
the ungrouped metrics last.

`pulse-check` is implemented: each member answers the weekly pulse check for a
meeting (`PUT …/meetings/:meetingId/pulse/me`, only ever one's own answer), and
the board at `/teams/:teamId?view=pulse` shows the meeting's results laid out as
in the legacy board - answers received, the average on a gauge, the
distribution, the trend and the answers table, with names hideable for screen
sharing. A meeting with answers can no longer be deleted.

`problems-and-tasks` is implemented: members raise and change a team's problems
and tasks at any time (`/teams/:teamId/problems`, `/teams/:teamId/tasks`), the
board shows the active ones beside the metric tiles with a PDCA ball that steps
the stage on and asks before closing, and `/teams/:teamId?view=archived` lists
the closed ones. Problems, tasks and archiving are one capability because they
share one lifecycle. Deleting a meeting leaves its items recording no meeting.

Everything else in the domain model above — targets — is agreed but
not built. It is a capability of its own;
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
│   │   ├── features/     # dashboard, teams, board (problems, tasks), meetings, metrics, auth
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

`backend/tests/features/` holds the BDD features: `metric_status.feature`, the
status rule and the threshold in force at a meeting, against the pure functions
in `app/services/metric_status.py`; and `item_lifecycle.feature`, the PDCA
stages, archiving and the meeting an item is raised or closed at, against
`app/services/item_lifecycle.py`. Step definitions
live in `tests/features/steps/`.

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
- **GUI tests** (Playwright) for the main flows: the dashboard and its actions
  (prepare data, fill the pulse check, reach an assigned item's list), view
  board, record a meeting's metric values, add/close problem, add/complete task,
  configure metrics (copy one, include a global one), define global metrics,
  answer and review the pulse check, view archive.
- **BDD tests** (pytest-bdd) only for business rules worth stating in plain
  language, e.g. the status of a metric value against its threshold
  (`metric_status.feature`) and archiving (`item_lifecycle.feature`). Do not write BDD for CRUD plumbing. Target inheritance is not one
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
- `SECURITY.md` is the agreed security concept in full — the federation, the
  token handling and the permission table. This section is the summary; when the
  two disagree, `SECURITY.md` is the one to fix.
- Authentication (agreed, not yet built): a **federated chain of two OIDC /
  OAuth2 hops** — the application delegates to an identity broker
  (`identity.intra.pse.pl`), which in turn delegates to ADFS. BMAPP is a
  **public client** using Authorization Code Flow with PKCE and holds no client
  secret; the backend validates the resulting JWT against the broker's JWKS and
  keeps no session. The employee's email is the identity BMAPP keys on. This gets
  its own change; nothing about it exists yet.
- Until that lands, a **dev mode behind a toggle** (`BMAPP_MODE=dev`, plus
  `VITE_AUTH_MODE=dev` for the web app): `POST /auth/dev-login` takes an email and
  the password derived from it (the first two characters of each run of letters
  and digits: `admin@example.com` → `adexco`; not a secret), accepts only
  a recorded employee or an administrator, and returns a JWT of the same shape;
  the web app asks for both in a login window, so authorization is exercised
  through the same code path production uses. It is off by default and cannot work
  in a deployed environment: the route is not registered when the mode is off, the
  server refuses to start when the mode is on and `BMAPP_OIDC_ISSUER` is set, and
  the two modes sign and accept **disjoint algorithms** (dev `HS256` against a
  per-process secret, broker `RS256` against the published JWKS), so a dev token
  fails on the algorithm before any key is consulted. Anything deployed uses the
  federated chain or is not deployed - with one sanctioned exception.
- **The Railway demo is that exception.** A public demonstration instance runs
  on Railway in dev mode (`*/Dockerfile.railway`), because the
  broker is internal-only. Anyone with its URL is an administrator, so it holds
  invented data only, is disposable, and never sets `BMAPP_OIDC_ISSUER`.
  `SECURITY.md` ("The one exception") states the terms; do not extend them to
  any other environment, and do not put real board material on it.
- Authorization has **no roles**: a global admin flag from `BMAPP_ADMIN_EMAILS`,
  and membership read from `team_members`. The question is always "may this user
  do X to *this team*", never "what role is this user". Admins register teams and
  assign their leaders; a team's leader or its deputies configure that team's
  board and manage its members, and only the leader or an admin appoints,
  revokes or removes a deputy; members edit the meeting data of their own teams; a valid token
  reads everything - except individual pulse answers, which only the team's
  members and administrators read; others get the aggregates. Only a member
  answers the pulse check, for themselves - not even an administrator for them.
  Reading is not gated on an Employee record.
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
- Retention period for archived items and recorded meetings.
- Whether a meeting records attendance. (Whether a problem or task is tied to
  the meeting that raised or closed it is settled in `add-problems-and-tasks`:
  it records both.)
