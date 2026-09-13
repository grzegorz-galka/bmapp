## Context

See `proposal.md` — Why. This design covers how a platform-wide version move is sequenced and verified when the application's behaviour must come out identical on the other side.

Three facts shape everything below. First, there is no new behaviour to design: the acceptance criterion already exists as 22 backend tests, 5 component tests, 2 end-to-end tests, the lint and type gates, and the 85% coverage floor. The design question is therefore not *what to build* but *in what order to move, and how to tell which move broke something*. Second, the upgrades are not independent — Vite and Vitest are coupled by a shared Vite installation, and TypeScript sits underneath the type gate, the ESLint type-aware rules and the build. Third, exactly one step in the change can destroy something: the PostgreSQL major upgrade rebuilds the data volume. Everything else is recoverable with `git revert`.

There is no spec delta; `.openspec.yaml` sets `skip_specs: true` and `openspec/specs/team-board/` is the contract this change must not alter.

## Goals / Non-Goals

**Goals:**

- Each upgrade lands in a step small enough that a failing gate names its own cause, rather than arriving as one large diff that has to be bisected by hand.
- The riskiest upgrade is the last one, so that abandoning it still leaves every other upgrade delivered and green.
- The database upgrade cannot lose data through a mistake in ordering: the dump exists and is verified before the volume is destroyed.
- The end state has no version pin that silently forbids the next upgrade.

**Non-Goals:**

- Adopting automated dependency updates. Worth doing, and raised under Open Questions, but it is a separate change with its own configuration and review burden.
- Refactoring code to *use* anything the new versions offer — React 19's new hooks, Vite 8's build options. This change moves versions and leaves the code saying what it already says. Anything else makes "behaviour is identical" impossible to verify.
- Changing the coverage floor, the lint rule set, or the formatter's configuration to accommodate a new tool's defaults. If a new major reports a genuine problem, it gets fixed; the gate is not relaxed to hide it.

## Decisions

### Sequence the change in four stages, gated independently

The upgrades are grouped by what they can break, and each stage ends with the full suite green before the next begins:

```
  stage 1   Python 3.12 -> 3.14          backend gates + 22 backend tests
  stage 2   PostgreSQL 16 -> 18          backend integration tests against the new cluster
  stage 3   Node 22 -> 24, then          npm gates + 5 component tests + 2 e2e
            React 19, then
            Vite 8 + Vitest 5 + plugin-react 6,
            then ESLint 10 and friends
  stage 4   TypeScript 5 -> 7            typecheck, lint, build, all frontend tests
```

Landing everything as one commit was rejected. The frontend alone moves nine packages across twelve majors; when a type error or a failing render appears, the diff would give no signal about which of them caused it. The staging costs nothing but a few extra runs of a suite that takes seconds.

Stages 1 and 2 are ordered before the frontend because they are genuinely independent of it — the backend does not care what builds the UI — and because stage 2 is the only irreversible one. Doing it while the change is otherwise untouched means a failure there is unambiguous.

### Vite, Vitest and the React plugin move as one atomic step

Vitest embeds a Vite installation. When the two disagree on major version, npm resolves a second copy of Vite under `node_modules/vitest/`, and the TypeScript compiler then sees two structurally identical but nominally distinct `Plugin` types — which fails the build with an error that says nothing about version skew. This already happened once while the skeleton was being built, with Vitest 2 against Vite 6.

They therefore move in a single step together with `@vitejs/plugin-react`, and the step's verification includes asserting that `node_modules/vitest/node_modules/vite` does not exist. Moving them separately was rejected on the strength of having already paid for that mistake.

### TypeScript 7 goes last, and is separable

TypeScript 7 is the native compiler port, not an incremental release: a different implementation of the same language. Its risk is concentrated in exactly the places this project depends on — `tsc --noEmit` as a gate, the type-aware ESLint rules through `typescript-eslint`, and Vite's transform pipeline.

Putting it last means that if it proves unworkable — most plausibly because `typescript-eslint` 8 does not yet support it — the change still delivers React 19, Vite 8, Vitest 5, ESLint 10, Python 3.14 and PostgreSQL 18, and only the TypeScript step is dropped. Reversing the order would make every other upgrade hostage to the least predictable one.

If it is dropped, it is dropped explicitly: recorded in `CLAUDE.md` as the current version with the reason, not left as an unexplained lag.

### PostgreSQL upgrade by dump and restore, not `pg_upgrade`

The version 18 server will refuse to start against the version 16 cluster in `bmapp-db-data`. Two routes exist: run `pg_upgrade` against the old data directory, or dump logically, recreate the volume, and restore.

Dump and restore is chosen. `pg_upgrade` needs both major versions' binaries present in one image, which means building a custom image for a one-off migration. At this data volume — seven teams and their boards — a logical dump is a file of a few kilobytes and the whole operation is three commands. The `pg_upgrade` advantage is speed on large clusters, which is not a property this database has.

The dump is taken with `pg_dumpall` so that all three databases (`bmapp`, `bmapp_test`, and roles) come across, it is written outside the volume, and its contents are checked before anything is destroyed.

### Raise the floor of each range, keep the caret

Ranges stay in the `^major.minor.patch` form already used; the change raises the floor to the new major. Pinning exact versions was considered and rejected: it would stop patch and minor updates from ever arriving without an edit, which is the opposite of the problem this change is fixing. The lockfile continues to provide reproducibility.

The one place an exact version is kept is `.python-version`, which names `3.14` because it selects an interpreter rather than resolving a range.

### No `--legacy-peer-deps`, ever

When a peer dependency conflict appears during the frontend upgrade it is treated as information, not as an obstacle to route around. `--legacy-peer-deps` and `--force` silence exactly the signal this change needs: that two packages disagree about which major they support. A conflict means either waiting for the lagging package or accepting that its upgrade is out of scope, and both of those are decisions to record rather than flags to pass.

## Risks / Trade-offs

- **TypeScript 7 is not supported by `typescript-eslint` 8** → It is the final stage and reverts alone. If unsupported, the options are `typescript-eslint` 9 if it exists by then, or dropping the TypeScript step and recording the reason. Nothing else in the change depends on it.
- **The PostgreSQL restore fails or the dump proves incomplete** → The dump is taken and inspected before the volume is removed, and kept until the whole change is verified. The schema is reproducible from the Alembic chain in any case, so the worst realistic outcome is losing seven rows of test data, not a blocked change.
- **React 19 breaks rendering in a way the tests do not catch** → The component tests cover the list, a successful registration and two rejection paths, and the Playwright tests exercise the same flows in a real browser. That is the whole of the current UI, so the gap is small. `createRoot` in `main.tsx` is the one call with a known history of churn and is checked explicitly.
- **Vite 8 changes build output in a way that only shows at runtime** → `npm run build` proves compilation, not behaviour, so the end-to-end tests run against the built application rather than only the dev server before the change is called done.
- **Python 3.14 lacks a wheel for a compiled dependency** → `psycopg[binary]` is the only compiled dependency; if no wheel exists the stage fails at `uv sync`, immediately and unambiguously, before anything else has moved.
- **Moving everything at once means the project takes all the new majors' bugs at once** → Accepted deliberately. The alternative is staying a major behind on the argument that later is safer, which is how the gap gets to three majors instead of one. The surface being upgraded is roughly 300 lines of frontend code.
- **`node:24-slim` is newer than the Node this was tested against locally** → Local development runs Node 24 already, so the container and the host agree rather than diverge.

## Migration Plan

Stages run in the order given above. Each ends with the relevant gates green; a stage that cannot be made green is reverted before the next begins.

The only destructive step is stage 2, which runs as: dump with `pg_dumpall` to a file outside the volume, verify the file contains the `teams` and `board_definitions` tables and the expected rows, stop the stack, remove the `bmapp-db-data` volume, change the image tag to `postgres:18`, start the database, restore the dump, and confirm the row count matches what was dumped.

Rollback for stages 1, 3 and 4 is `git revert` plus `uv sync` or `npm ci` to restore the lockfile's state. Rollback for stage 2 is the same revert plus removing the version 18 volume and restoring the dump into a version 16 container — which is why the dump is kept until the end rather than deleted once stage 2 passes.

There is no deployed environment and no user to cut over.

## Open Questions

These can be answered later without changing the approach or the task breakdown:

- Whether the project adopts automated dependency updates — Renovate or Dependabot — so that this gap cannot reopen silently. The answer does not change any step here; it changes whether this change is the last of its kind or the first of many.
- Whether `CLAUDE.md` should name exact versions at all, given that naming them is what made the stack table go stale. An alternative is naming only the majors the project commits to, and letting the lockfiles carry the detail.
