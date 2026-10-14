# Tasks

## 1. Backend rule

- [x] 1.1 Rewrite `dev_password` in `backend/app/services/dev_login.py` to take the first two characters of each run of letters and digits, and update its docstring and the module docstring example (`grzegorz.galka@pse.pl` → `grgapspl`); verify `uv run mypy app` passes
- [x] 1.2 Update `backend/tests/unit/test_the_development_password_is_derived_from_the_email.py` to the new rule: `grzegorz.galka@pse.pl` → `grgapspl`, `admin@company.com` → `adcoco`, `admin@example.com` → `adexco`, `jan_k-x@a.pl` → `jakxapl`, `a..b@c.pl` → `abcpl`, `a@b.` → `ab`, `jan2@a1.pl` → `jaa1pl`, plus a one-character run (`a.b@c.pl` → `abcpl`); verify `uv run pytest tests/unit/test_the_development_password_is_derived_from_the_email.py` passes
- [x] 1.3 Update `backend/tests/integration/test_development_mode_substitutes_for_the_broker.py` so each spec scenario has its named test with the new passwords: dots and the at-sign, the administrator's password (`admin@example.com` / `adexco`, no employee record), any separator, a run of separators, the normalised email, a wrong password (`""`, `grgapsp`, `grgapsplx`, `GRGAPSPL`, `wrong`), the one-letter password of the earlier rule (`ggpp`), and the logging test's passwords; verify `uv run pytest tests/integration/test_development_mode_substitutes_for_the_broker.py` passes against the compose database
- [x] 1.4 Run the backend gates and verify they pass: `uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest --cov=app` with coverage not below its previous figure

## 2. Web app hint and e2e copy

- [x] 2.1 Rewrite `auth.devLoginHint` in `frontend/src/i18n/en.ts` and `pl.ts` to state the new rule with the example `grzegorz.galka@pse.pl` → `grgapspl`, keeping the glossary's Polish wording; verify `npm run typecheck` passes
- [x] 2.2 Update the typed passwords in `src/features/auth/DevAuthProvider.test.tsx` (`grgapspl`) and `src/features/auth/DevLoginDialog.test.tsx` (`adcoco`); verify `npm run test` passes
- [x] 2.3 Rewrite `devPassword` and its comment in `frontend/e2e/auth.ts` as a match over runs of `[\p{L}\p{N}]`, each sliced to two characters; verify `npm run test:e2e -- sign-in-and-out` passes against the running stack with the new backend
- [x] 2.4 Run the frontend gates and verify they pass: `npm run lint && npm run typecheck && npm run test`

## 3. Documentation

- [x] 3.1 Update the rule and the example table in `README.md` ("Signing in locally": `admin@example.com` → `adexco`, `grzegorz.galka@pse.pl` → `grgapspl`, `admin@company.com` → `adcoco`); verify each listed password signs in against the local stack
- [x] 3.2 Update the rule, the example and the request body example (`user@company.com` → `uscoco`) in `SECURITY.md`, and the dev-mode paragraph in `CLAUDE.md`; verify `grep -rn "ggpp\|\"ucc\"\|\baec\b" README.md SECURITY.md CLAUDE.md frontend/src backend/app` finds nothing

## 4. End to end

- [x] 4.1 Rebuild the local stack (`docker compose up -d --build`), sign in through the login window as `admin@example.com` / `adexco`, confirm `aec` is refused with the password-field message in both languages, and run the full `npm run test:e2e`

## Workflow follow-up

- Redeploy the Railway demo backend and frontend after merge, so the demo accepts `adexco` and its login hint states the new rule.
- Archive the change with `/opsx:archive` once merged.
