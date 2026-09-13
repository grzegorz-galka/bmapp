## Why

The frontend's dependency ranges were written by hand when the skeleton was scaffolded, as caret ranges that cannot cross a major version. The result is that the frontend sits a full major behind on almost everything — React, Vite, Vitest, TypeScript, ESLint — while the backend, resolved from open lower bounds, is already at the newest release of every package. The gap is not drift; it was baked in on day one.

Now is when this costs least. The application is one page, three components, one API client, five component tests and two end-to-end tests. Every one of these upgrades is a mechanical edit today. Once meetings, metrics, charts, problems and tasks exist, the same upgrades become a project. The runtime and database upgrades bundled here follow the same logic: the database holds seven teams of test data and no production deployment exists, so a major PostgreSQL upgrade is currently a dump and restore rather than a migration plan.

## What Changes

- Move the frontend to the current major of every outdated package: React and React DOM 18 → 19 (with their `@types`), Vite 6 → 8, Vitest 3 → 5, TypeScript 5 → 7, ESLint 9 → 10 with `@eslint/js`, `@vitejs/plugin-react` 4 → 6, `eslint-plugin-react-hooks` 5 → 7, `globals` 15 → 17, `jsdom` 25 → 30, `@testing-library/jest-dom` 6 → 7.
- Leave the packages that are already current at their present major: TanStack Query 5, Playwright 1.x, Prettier 3, `@testing-library/react` 16, `typescript-eslint` 8, `@types/node`.
- Leave every backend Python package as it is. All nine are already at the newest release on PyPI; there is nothing to raise.
- Move the backend runtime from Python 3.12 to 3.14, including the pinned interpreter, the Docker base image, and the Ruff and mypy target versions.
- Move the frontend Docker base image from Node 22 to Node 24. Vitest 5 requires Node `^22.12 || ^24 || >=26` and ESLint 10 requires `^20.19 || ^22.13 || >=24`, so the current `node:22-slim` only just qualifies and any future patch could push it off.
- **BREAKING** — move PostgreSQL from 16 to 18. The `bmapp-db-data` volume holds a version 16.15 cluster; a version 18 server will refuse to start against it. The data must be dumped before the upgrade and restored after, and the volume recreated.
- Update the stack table in `CLAUDE.md`, which currently names Python 3.12, React 18 and PostgreSQL 16 as the agreed versions.
- No change to any endpoint, request or response shape, database schema, or Alembic revision. The migration chain is untouched.

## Capabilities

### New Capabilities

None. This change introduces no behaviour.

### Modified Capabilities

None. `team-board` is the only capability in the project, and neither of its requirements nor any of its seven scenarios changes. The whole point of the change is that behaviour stays identical while the platform underneath it moves, so the existing suite is the acceptance criterion rather than a new spec. `.openspec.yaml` therefore sets `skip_specs: true`.

## Impact

- **Frontend**: `package.json`, `package-lock.json`, and whatever source changes the majors force. React 19 is the likeliest to touch code — `main.tsx` calls `createRoot`, and the test suite renders through `@testing-library/react`. TypeScript 7 is a compiler replacement rather than a version bump, so `tsc --noEmit` and the ESLint type-aware rules are where trouble would surface.
- **Backend**: `pyproject.toml` (`requires-python`, Ruff `target-version`, mypy `python_version`), `.python-version`, `backend/Dockerfile`. No application code is expected to change.
- **Database**: `docker-compose.yml`, and the `bmapp-db-data` volume, which is destroyed and rebuilt. This is the only step in the change that can lose something.
- **Documentation**: the stack table in `CLAUDE.md`; `README.md` if any documented command changes.
- **Not affected**: the API contract, the schema, the Alembic revision, and every requirement in `openspec/specs/team-board/`.

## Assumptions

Recorded so they can be challenged before implementation begins:

- **"Latest stable" means the newest non-prerelease major at implementation time.** The versions named above were observed while writing this proposal; if a newer stable major appears before the work is done, it takes precedence and the difference is noted.
- **The upgrade is all-or-nothing per package, not a gradual migration.** Every dependency moves in one change, because partial upgrades of a coupled set are what create the version conflicts this change exists to clear. Vite and Vitest in particular must move together — they were already the source of one such conflict when the skeleton was built.
- **The existing test suite is a sufficient acceptance criterion.** 22 backend tests, 5 component tests and 2 end-to-end tests, plus the lint and type gates and the 85% coverage floor, all passing unchanged. No new test is written for the upgrade itself.
- **The database's current contents are test data and are worth preserving but not critical.** They are dumped and restored so that the procedure is exercised properly, but the change is not blocked if the restore has to be abandoned and the schema recreated from migrations.
