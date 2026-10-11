## 1. Backend: the password rule and the refusals

- [x] 1.1 Add `IncorrectDevPasswordError` (401, `auth.password_incorrect`, field `password`) and `UnknownEmployeeError` (401, `auth.employee_unknown`, field `email`) to `app/core/exceptions.py`. Verify that `tests/unit/test_auth_errors.py` maps each to its status, code and field through the existing handler.
- [x] 1.2 Add `app/services/dev_login.py`:
  - pure `dev_password(email)`;
  - `authenticate_dev_login(session, email, password, admin_emails)`. It checks the password first, then reads the employee by email (no insert), lets an administrator through without a record, and returns the email.

  Verify that a new `tests/unit/test_the_development_password_is_derived_from_the_email.py` covers `grzegorz.galka@pse.pl`→`ggpp`, `admin@company.com`→`acc`, `jan_k-x@a.pl`→`jkxap`, `a..b@c.pl`→`abcp`, and a trailing separator adding nothing.

## 2. Backend: the endpoint

- [x] 2.1 Add `password: str` to `DevLogin` in `app/schemas/auth.py`, with a docstring saying it is derived from the email and not a secret. Update the `dev-login` handler in `app/api/auth.py` to take a DB session, call `authenticate_dev_login`, then `issue_dev_token`, and to say the same in its OpenAPI description. Verify that `uv run mypy app` is clean.
- [x] 2.2 Rewrite `tests/integration/test_development_mode_substitutes_for_the_broker.py`:
  - Seed employees through the existing team fixtures.
  - Replace `test_the_local_login_takes_no_password` with a test asserting the request body is exactly `{email, password}`.
  - Add one test per new scenario: *Dots and the at-sign split the email*, *Any character that is not a letter or digit splits the email*, *A run of separators counts once*, *The password follows the normalised email*, *A wrong password is refused* (including upper case), *An administrator who is not an employee signs in*, *An unknown email is refused* (asserting no employee row is created).
  - Keep the existing mode-guard tests passing unchanged.

  Verify with `uv run pytest tests/integration/test_development_mode_substitutes_for_the_broker.py tests/unit`.
- [x] 2.3 Log a successful dev sign-in at INFO with the email only, and a refusal at INFO with the code and the email, never the password. Verify with a `caplog` assertion that the password does not appear.
- [x] 2.4 Run `uv run ruff check . && uv run ruff format --check . && uv run mypy app` and `uv run pytest --cov=app --cov-report=term-missing`. Verify that everything passes and coverage stays at or above 85% without dropping.

## 3. Frontend: the login window

- [x] 3.1 Add the `auth.devLogin*` strings (title, email, password, submit, close, a hint that the password is derived from the email) and `errors.auth.password_incorrect` / `errors.auth.employee_unknown` to `en.ts` and `pl.ts`. Follow the glossary translations. Verify that `npm run typecheck` and the catalogue parity test pass.
- [x] 3.2 Add `features/auth/DevLoginDialog.tsx` and its CSS Module: a native `<dialog>` opened with `showModal()`, email and password inputs, submit and close. On a refusal, the translated code appears beside its field. Theme tokens only, `--line-control` on the inputs. Verify that `DevLoginDialog.test.tsx` covers submit, the field-level refusal and close.
- [x] 3.3 Rework `DevAuthProvider`:
  - No sign-in on mount: it goes `restoring` → `signedOut` and opens the dialog.
  - `signIn()` opens the dialog.
  - On success it keeps the token in memory and writes only the email to `bmapp.devEmail`.
  - It pre-fills the email from `bmapp.devEmail`, then `VITE_DEV_EMAIL`.
  - It keeps `{email, password}` in a ref for the reauthenticate hook.

  Verify that `session.test.tsx` (or a new `DevAuthProvider.test.tsx`) has one test per scenario of *Development mode signs in through a login window*, plus "a 401 after a backend restart is recovered without the window" and "nothing but the email is written to storage".
- [x] 3.4 Run `npm run lint && npm run typecheck && npm run test`. Verify that everything passes.

## 4. End-to-end suite

- [x] 4.1 Make `e2e/auth.ts` add `devPassword(email)`. `signInAs(page, email)` now answers the login window through a Playwright locator handler, so it is signed in again after every navigation. Make `e2e/api.ts` send the derived password. Verify that `sign-in-and-out.spec.ts` passes.
- [x] 4.2 Specs that relied on the automatic administrator sign-in (`hub-landing`, `register-a-team`, `manage-team-members`) call `signInAs(page)` in a `beforeEach`. `permissions` signs in as the team's leader instead of an unknown "nobody". Verify that `npm run test:e2e` passes in full against `docker compose up`.
- [x] 4.3 Add e2e tests to `sign-in-and-out.spec.ts`:
  - *The window opens on a page with no session*
  - *A refusal is shown in the window*
  - *Closing the window leaves the person signed out*
  - *A reload asks again, with the email remembered*

  Verify that they pass.

## 5. Documentation

- [x] 5.1 Update the dev-mode section of `README.md` (how to sign in, the password rule with both examples, admins need no employee record, `bmapp.devEmail` now only pre-fills). Update `SECURITY.md`'s dev-mode paragraph (the endpoint takes the derived password; it adds no protection beyond the toggle). Update CLAUDE.md's *Security and configuration* dev-mode bullet. Verify by following the README from a fresh `docker compose up` and signing in as `admin@example.com` / `aec`.

## Workflow follow-up

- Archive the change with `/opsx:archive` after review, folding the `authentication` delta into `openspec/specs/`.
