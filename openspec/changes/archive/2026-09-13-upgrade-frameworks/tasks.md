## 1. Stage 1 — Python 3.12 to 3.14

- [x] 1.1 Set `backend/.python-version` to `3.14` and run `uv sync`; verify `uv run python --version` reports 3.14 and `uv run python -c "import fastapi, sqlalchemy, alembic, psycopg"` exits zero, confirming a wheel exists for every compiled dependency
- [x] 1.2 Raise `requires-python` to `>=3.14` and set Ruff `target-version = "py314"` and mypy `python_version = "3.14"` in `backend/pyproject.toml`; verify `uv run ruff check . && uv run ruff format --check . && uv run mypy app` exits zero
- [x] 1.3 Change `backend/Dockerfile` from `python:3.12-slim` to `python:3.14-slim`; verify `docker compose build backend` succeeds and `docker compose run --rm backend python --version` reports 3.14
- [x] 1.4 Run the whole backend suite on 3.14; verify all 22 tests pass, they pass a second time with no reset, and `uv run pytest --cov=app` still reports at or above the 85% floor

## 2. Stage 2 — PostgreSQL 16 to 18 (destructive)

- [x] 2.1 Dump the running 16 cluster with `pg_dumpall` to a file outside the volume and record the current row counts; verify the file contains `CREATE TABLE` for both `teams` and `board_definitions`, lists the `bmapp` and `bmapp_test` databases, and holds exactly the rows counted
- [x] 2.2 Stop the stack and remove the `bmapp-db-data` volume only after the dump has been verified; verify `docker volume ls` no longer lists it and the dump file is still present outside the project tree
- [x] 2.3 Change the `db` image in `docker-compose.yml` to `postgres:18` and start it; verify the container reaches `healthy` and `select version()` reports 18
- [x] 2.4 Restore the dump into the new cluster; verify the row counts in `teams` and `board_definitions` match those recorded in 2.1 and that team names with non-ASCII characters survived intact
- [x] 2.5 Confirm the migration chain still applies to an empty 18 database: verify `alembic upgrade head` then `alembic downgrade base` runs clean against a freshly created database, and that the unique index on `lower(name)` and the not-blank check constraint both exist afterwards
- [x] 2.6 Run the backend integration tests against PostgreSQL 18; verify all 22 pass, including the case-insensitive duplicate and the name-ordering tests, which are the ones that depend on database behaviour rather than application code

## 3. Stage 3 — Node 24 and the frontend packages

- [x] 3.1 Change `frontend/Dockerfile` from `node:22-slim` to `node:24-slim`; verify `docker compose build frontend` succeeds and the dev server inside the container serves the page on 5173
- [x] 3.2 Raise `react`, `react-dom`, `@types/react` and `@types/react-dom` to 19; verify `npm run typecheck`, `npm run test` (5 tests), `npm run build` and `npm run test:e2e` (2 tests) all pass, and inspect `src/main.tsx` to confirm the `createRoot` call still matches React 19's signature
- [x] 3.3 Raise `vite` to 8, `vitest` to 5 and `@vitejs/plugin-react` to 6 in one step; verify `node_modules/vitest/node_modules/vite` does **not** exist — a nested copy is the version-skew failure that broke the build once already — and that typecheck, build and both test suites pass
- [x] 3.4 Raise `eslint` and `@eslint/js` to 10, `eslint-plugin-react-hooks` to 7 and `globals` to 17; verify `npm run lint` exits zero with the existing flat config, fixing any genuine finding rather than disabling the rule that reported it
- [x] 3.5 Raise `jsdom` to 30 and `@testing-library/jest-dom` to 7; verify the 5 component tests pass, in particular the assertions on `aria-invalid` and `role="alert"` that depend on the DOM implementation and the matchers
- [x] 3.6 Confirm no upgrade in this stage was forced: verify neither `--legacy-peer-deps` nor `--force` appears in any command used, and that `npm ls` reports no unmet peer dependency
- [x] 3.7 Run the end-to-end tests against the built application rather than only the dev server; verify `npm run build` output served to Playwright still registers a team, shows the duplicate error, and survives a reload

## 4. Stage 4 — TypeScript 5 to 7 (separable)

- [x] 4.1 Check whether the installed `typescript-eslint` supports TypeScript 7 before changing anything; verify by reading its peer dependency range, and raise it to a supporting major if one is available
- [x] 4.2 Raise `typescript` as far as the lint gate allows; verify `npm run typecheck` exits zero with no new errors, `npm run lint` still runs the type-aware rules without crashing, `npm run build` succeeds and all 7 frontend tests pass. **Landed on 6.0.3, not 7.0.2**: `typescript-eslint` 8.70.0 is the newest release in existence and refuses to load against TypeScript 7 with `typescript-eslint does not support TS 7.0`, taking `npm run lint` to exit 2. 6.0.3 falls inside its supported range `>=4.8.4 <6.1.0` and leaves every gate green
- [x] 4.3 Record in `CLAUDE.md` the TypeScript version actually in use and why it is not the newest, so the lag reads as a deliberate decision rather than neglect; verify the recorded reason names the specific incompatibility and the version that would lift it

## 5. Documentation and final verification

- [x] 5.1 Update the stack table in `CLAUDE.md` to the versions actually landed — Python, React, PostgreSQL and anything else it names; verify no version in that table disagrees with `pyproject.toml`, `package.json` or `docker-compose.yml`
- [x] 5.2 Update `README.md` wherever a documented command or prerequisite changed; verify by following the run and test sections verbatim against the upgraded stack
- [x] 5.3 Walk the whole slice on the upgraded stack: `docker compose up -d`, migrate, register a team through the page, reload; verify the team persists across the reload, a backend restart, and a full `docker compose down && up`
- [x] 5.4 Run every gate one final time across both halves; verify backend lint, format, mypy, 22 tests and the coverage floor, plus frontend lint, typecheck, 5 component tests, build and 2 end-to-end tests, are all green together
- [x] 5.5 Confirm both lockfiles record the new versions and are committed; verify `git status` shows `uv.lock` and `package-lock.json` as modified and that no `node_modules` or `.venv` path is staged
- [x] 5.6 Delete the PostgreSQL dump taken in 2.1 only after 5.4 is green; verify it is removed and that `openspec/specs/team-board/` is byte-for-byte unchanged by this change, since no requirement was meant to move
