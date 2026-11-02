# BMAPP — Board Meetings Application

BMAPP provides an online board for the weekly team briefings ("board meetings")
that software teams here run along Kaizen / Lean lines: metrics judged green,
amber or red against their thresholds, with their trends, the problems the team is working through, and the tasks it
has agreed.

This repository currently contains the **walking skeleton**. One vertical slice
is real end to end through the UI, the API, a service layer and PostgreSQL:
register a team and see the registered teams, at `/teams`; each team has a
members page and a meetings page, where its weekly schedule is set and its
board meetings are prepared; a metric settings page at `/teams/:teamId/metrics`,
where its leader defines metrics and their thresholds, copies them from
another board or includes global metrics; a global metrics page at
`/global-metrics`, where administrators define metrics shared by every board
that includes them; and its board at
`/teams/:teamId`, where members record each meeting's values and read their
trends, answer and review the weekly pulse check, and keep the team's
problems and tasks from raising to the archive. On top of it sits
the **dashboard** (*Pulpit*) at `/`, the landing page — the company
declarations, your teams and the countdown to the next board meeting, your
coming board meetings with what is still to be recorded and answered, and your
teams' problems and tasks with the ones assigned to you. From a meeting row you
prepare its data, fill your pulse check or, on the day, start it. See
`openspec/` for what is specified and `CLAUDE.md` for the conventions.

> **The dashboard's declarations are constants.** Everything else on it comes
> from recorded data through one read-only endpoint, `GET /dashboard`. The
> company mission, vision, goals and values live in `app/services/dashboard.py`
> until the targets capability makes them editable.

> **Not deployable, except as a demo.** Every service in the Compose stack
> binds to `127.0.0.1`. The only deployment is a public demonstration on
> Railway, in development mode, holding invented data only - see
> [Railway demo](#railway-demo) and `SECURITY.md`.

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

Then open <http://localhost:5173>. You land on the dashboard. The header leads to
your teams, meetings and pulse checks, and its Configuration group to the team
registration page at `/teams`, the team metrics and the global metrics. The header also carries the
English/Polish language toggle, the dark/light theme toggle — dark by default, and
your choice is remembered — and the account control.

### Signing in locally

Everything now requires a signed-in person, and the identity broker is not
reachable from a developer machine. The stack therefore runs in **development
mode** (`BMAPP_MODE=dev` for the API, `VITE_AUTH_MODE=dev` for the web app),
which signs you in through a login window instead of the broker. The window
opens when the page loads and asks for an email and a password.

The first time you sign in as an email, the password is derived from it: the
first two characters of each run of letters and digits, in order - the parts
between the dots, the at-sign and any other characters that are not letters or
digits. A one-character part gives its one character. That password is not a
secret, so it does not sign you in by itself: the window then asks you to choose
a password of your own (at least 8 characters), twice, with your name and
surname proposed from the email for you to correct. From then on only the
chosen password works.

| Email                   | First-time password |
|-------------------------|---------------------|
| `admin@example.com`     | `adexco`            |
| `grzegorz.galka@pse.pl` | `grgapspl`          |
| `admin@company.com`     | `adcoco`            |

Only a recorded employee - someone who has been put on a team - or an
administrator can sign in. The compose file makes `admin@example.com` the
administrator, and it needs no employee record. Sign in as it first and
register a team.

Forgot a chosen password? There is no screen for that: delete the email's row
from `dev_credentials` and the derived password works again.

```bash
docker compose exec db psql -U bmapp -d bmapp \
  -c "DELETE FROM dev_credentials WHERE email = 'admin@example.com'"
```

The end-to-end suite gives everyone it signs in the password `e2e-password`, so
after a run that is the administrator's password on your local stack.

Tokens live only in the page, so a reload asks again. The window remembers the
last email under `localStorage['bmapp.devEmail']` and never remembers the
password. Override the administrator list with `BMAPP_ADMIN_EMAILS` in `.env`,
and `VITE_DEV_EMAIL` sets the email the window shows before you have signed in
at all.

Development mode is for local work only, and the application enforces that
rather than asking you to remember it: a server in development mode refuses to
start if an identity broker is configured, the local login endpoint does not
exist outside it, and the two modes sign and accept tokens with different
algorithms, so a token minted here cannot be used against a deployed server.

A database created before team membership arrived (migration `0002`) holds teams
with no leader, and the migration refuses to run over it rather than invent one.
Nothing is deployed, so reset the local volume and migrate again:

```bash
docker compose down -v && docker compose up -d
docker compose exec backend alembic upgrade head
```

| Service  | URL                                            |
|----------|------------------------------------------------|
| Frontend | <http://localhost:5173>                        |
| API      | <http://localhost:8000>, docs at `/docs`       |
| Health   | <http://localhost:8000/health>                 |
| Database | `localhost:5433`                               |

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

To read it in Polish, click the language toggle in the page header — while the
page is in English it shows the Polish flag and "Polski". The
choice is remembered in `localStorage` under `bmapp.language` and applies on
your next visit, so to get back to browser detection, clear that key. You can
also set it directly — this is how the Playwright specs pin a language:

```js
localStorage.setItem('bmapp.language', 'pl');   // in the browser console, then reload
```

### Adding a language

The header's language control is a two-state toggle, so a third language first
needs a control that can offer every language: `src/i18n/languages.test.ts`
fails as soon as `SUPPORTED_LANGUAGES` grows past two, to make that impossible
to miss. With that control in place:

Catalogues are TypeScript, not JSON, so that the compiler owns completeness: a
key present in one language and missing from another is a `tsc` error rather
than a silent English fallback in a translated page. To add German, say:

1. Add `'de'` to `SUPPORTED_LANGUAGES` in `frontend/src/i18n/languages.ts`.
2. Add a `language.de` entry to `en.ts`, naming the language *in* that language
   (`Deutsch`).
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

## Loading a legacy Boardmeeting board

`backend/scripts/import_legacy_board.py` loads the legacy single-file
Boardmeeting tool into BMAPP as one team: its participants as employees (named
`firstname.lastname@pse.pl`), the team, board and schedule, a meeting per week,
its KPIs as metrics with threshold versions derived from the tool's own colour
rule, every recorded value with its comment, every problem and task at its
PDCA stage (archived where the tool closed it, with the meetings it was raised
and closed at), and every pulse answer at its week's meeting. It needs both the
backup (`boardmeeting-backup` JSON) and the tool's HTML, which holds the KPI
definitions. The KPI projects are counted and skipped. An item with several
owners gets the first as its responsible person and names the others in its
text.

```bash
cd backend
uv run python -m scripts.import_legacy_board BACKUP.json TOOL.html \
    --team "Zarząd" --board "Board Zarządu" --actor you@pse.pl --dry-run
```

Drop `--dry-run` to commit; `--replace` deletes a team of that name first. It
writes to `BMAPP_DATABASE_URL`, or `--database-url`. The backup is real board
material: load it on-premise only, never into the Railway demo
(see `SECURITY.md`).

The import writes each legacy week's rule as a threshold version with a
target value: the week's target (or the KPI's fixed green) with green 0% and
the gap as the amber tolerance, a band's centre with half its width, and a
range where the target is 0. Where a tolerance quantised to 6 places would
colour a value differently, the legacy colour is kept as a colour set by hand.

## Converting thresholds to target values

Threshold versions recorded before target values existed keep their
boundaries and no target value; versions are append-only, so none is edited.
`backend/scripts/convert_thresholds.py` proposes, for each such version, a
**twin**: the same effective date, recorded now, with a target value, by the
reason "Conversion to target value: …". Run it once per database, dry run
first:

```bash
cd backend
uv run python -m scripts.convert_thresholds --actor you@pse.pl
uv run python -m scripts.convert_thresholds --mapping mapping.csv --actor you@pse.pl
uv run python -m scripts.convert_thresholds --mapping mapping.csv --actor you@pse.pl --apply
```

It reads `BMAPP_DATABASE_URL`, or `--database-url`. Without a mapping row a
version converts by default: a one-sided version becomes its green boundary
as the target value, green 0% and amber `|green − amber| / |green|` in per
cent; a green boundary of 0 becomes the target value 0 with the same range.
A band, or an amber tolerance that does not fit 6 decimal places, needs a
mapping row. A version superseded by one recorded later on the same date
judges nothing and gets no twin, so running again after `--apply` proposes
nothing.

**The mapping file** is a comma-separated CSV with a header row naming these
columns (decimals with a dot):

| Column | Meaning |
|---|---|
| `team` | the team's name; empty for a global metric |
| `metric` | the metric's name (case does not matter) |
| `effective_from` | `YYYY-MM-DD` of the version it converts; empty for every version of the metric (a dated row wins) |
| `target_value` | the twin's target value |
| `green_pct`, `amber_pct` | tolerances in per cent, for a target value other than 0 |
| `green_lo`, `green_hi`, `amber_lo`, `amber_hi` | the range, for the target value 0: `green_lo`/`amber_lo` higher-is-better, `green_hi`/`amber_hi` lower-is-better, all four for a band |
| `accept_changes` | `yes` lets `--apply` write although the row changes colours; `no` or empty refuses |

```csv
team,metric,effective_from,target_value,green_pct,amber_pct,green_lo,green_hi,amber_lo,amber_hi,accept_changes
Zarząd,OTIF projektów KPI,2026-10-19,100,5,10,,,,,no
Zarząd,Aneksy,2026-10-19,0,,,,5,,10,no
```

A row is checked as the API checks a new version, and against the database:
an unknown team, metric or date, or a row repeated, stops the run with each
problem and its line, before anything is planned.

**Reading the report.** *Proposed twin versions* lists every twin with the
version it replaces (`was`) and its new reading (`now`, with the boundaries
it amounts to), and where the reading came from (`default` or the mapping
file's line). Check each `now` before applying: a default can be exact and
still wrong, like a target value 5 where 0 was meant. *Needs a mapping row*
lists what the default cannot convert. *Status changes* lists every recorded
value, on any board, whose colour the twins would change, and whether its
mapping row accepts it; colours set by hand are kept and not listed. Unused
mapping rows are listed last.

A dry run writes nothing and exits 0, saying whether `--apply` would be
refused. `--apply` writes every twin in one transaction, only when nothing
needs a mapping row and every status change is accepted; otherwise it writes
nothing and exits 1. A bad mapping file exits 2. To undo an applied
conversion, record newer versions: history is never rewritten.

## Configuration

All configuration comes from environment variables — see `.env.example` for
the full list. Never commit `.env`.

The identity settings are the ones to get right:

| Variable | Meaning |
|------------------------|--------------------------------------------------|
| `BMAPP_MODE` | `broker` (default) or `dev`. Never `dev` anywhere deployed. |
| `BMAPP_OIDC_ISSUER` | The identity broker. Setting it alongside `dev` stops the server starting. |
| `BMAPP_OIDC_CLIENT_ID` | What BMAPP is registered as. |
| `BMAPP_OIDC_AUDIENCE` | What a token must name as its audience; defaults to the client id. |
| `BMAPP_ADMIN_EMAILS` | Comma-separated administrators. Empty refuses every write that needs one. |
| `VITE_AUTH_MODE` | `dev` to obtain the session locally instead of from the broker. |

`SECURITY.md` holds the whole picture: the federated chain, how tokens are
validated, and who may do what.

## Railway demo

A public demonstration instance runs on [Railway](https://railway.com) in
**development mode**: anyone with the URL signs in as an administrator. Invented
data only - the terms are in `SECURITY.md` under "The one exception".

One Railway project, three services:

| Service    | Source                                  | Variables |
|------------|-----------------------------------------|-----------|
| `Postgres` | Railway's PostgreSQL template           | - |
| `backend`  | `backend/` (`Dockerfile.railway`)       | `RAILWAY_DOCKERFILE_PATH=Dockerfile.railway`, `PORT=8000`, `BMAPP_MODE=dev`, `BMAPP_ADMIN_EMAILS=admin@example.com`, `BMAPP_FRONTEND_ORIGIN=https://<frontend domain>`, `BMAPP_DATABASE_URL=postgresql+psycopg://${{Postgres.PGUSER}}:${{Postgres.PGPASSWORD}}@${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}` |
| `frontend` | `frontend/` (`Dockerfile.railway`)      | `RAILWAY_DOCKERFILE_PATH=Dockerfile.railway`, `PORT=8080`, `VITE_API_BASE_URL=https://<backend domain>`, `VITE_AUTH_MODE=dev`, `VITE_DEV_EMAIL=admin@example.com` |

`RAILWAY_DOCKERFILE_PATH` is what selects the demo image: without it Railway
builds the development `Dockerfile` beside it, and a `railway.json` is not read
when deploying a subdirectory with `--path-as-root`. Each `PORT` matches the
target port of the service's public domain. The backend migrates the database
on every start. The web app is a static
build served by nginx and calls the API on its public URL, so the two public
domains must be named in each other's variables, and the frontend rebuilt when
the backend's domain changes (Vite inlines `VITE_*` at build time).

```bash
railway up backend --path-as-root --service backend
railway up frontend --path-as-root --service frontend
```

