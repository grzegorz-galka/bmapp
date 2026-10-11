## Why

Today development mode signs anyone in without asking. The page reads an email
from `localStorage` (or `VITE_DEV_EMAIL`) and calls `POST /auth/dev-login`, which
mints a token for any well-formed address. To act as someone else, a developer
edits `localStorage` in the browser console and reloads. A tester can't see or
choose who they are, and nothing stops them signing in as a person BMAPP has never
heard of.

A login window with an email and a password makes switching identity a normal UI
action. It also puts a sign-in step in front of the application, as production
will have with the broker. If only recorded employees may sign in, development
exercises the same population of people the real system will.

## What Changes

- **Development mode gets a login window.** While signed out, the web app shows a
  dialog that asks for an email and a password. It opens when the page loads
  without a session and when "Sign in" is pressed. It can be closed, which leaves
  the person signed out. The last email used is pre-filled; the password never is.
- **The development password is derived from the email.** It is the first
  character of the email, followed by the first character after each run of
  non-alphanumeric characters. `grzegorz.galka@pse.pl` → `ggpp`,
  `admin@company.com` → `acc`. It is a typing check that keeps a developer
  deliberate about who they become. It is not a secret and protects nothing that
  the mode toggle does not already protect.
- **BREAKING (dev only):** `POST /auth/dev-login` takes `{email, password}` and
  refuses with HTTP 401:
  - `auth.password_incorrect` when the password is not the one derived from the
    email;
  - `auth.employee_unknown` when the email belongs to no recorded employee and is
    not an administrator's.

  Administrators from `BMAPP_ADMIN_EMAILS` may sign in without an employee record,
  because on an empty database someone has to register the first team.
- **No session survives a reload.** Tokens stay in page memory, as in broker mode,
  so after a reload the login window appears again. Within the page, the
  credentials are kept in memory so that a backend restart (a new dev signing
  secret) can be recovered silently, as it is now.
- New error codes and window strings are translated in `en.ts` and `pl.ts`.
- This reverses the decision *"`dev-login` takes an email and no password"* in
  `2026-10-03-add-authentication/design.md`. `design.md` here records why.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `authentication`:
  - *Development mode substitutes for the broker*: a local token now needs the
    derived password and an employee (or administrator) email, and is obtained
    through a login window.
  - *A person signs in through the identity broker*: the statement that the system
    collects no password of its own now applies to broker mode explicitly.

## Impact

- **Backend**:
  - `app/schemas/auth.py`: `DevLogin` gains `password`.
  - `app/api/auth.py`: the handler checks the password and looks up the employee.
  - A pure `dev_password(email)` function goes in a service module.
  - Two `DomainError` subclasses carry the new codes.
  - `tests/integration/test_development_mode_substitutes_for_the_broker.py` is
    rewritten. `test_the_local_login_takes_no_password` is inverted.
- **Frontend**:
  - `features/auth/DevAuthProvider.tsx` stops signing in on its own and drives a
    new `DevLoginDialog`.
  - `AccountControl` opens the dialog in dev mode.
  - `en.ts` and `pl.ts` gain the strings.
- **E2E**:
  - `e2e/auth.ts` `signInAs` now fills the login window instead of seeding
    storage.
  - `e2e/api.ts` sends the derived password.
  - Specs that act as someone who is not an employee must first make them one,
    for example as a member of another team.
- **Docs**: README's dev-mode section, CLAUDE.md's security summary, and
  `SECURITY.md`'s dev-mode paragraph.
- **Dependencies**: none.
- **Unchanged**: broker mode, token shape and verification, the per-process HS256
  secret, the guards that keep dev mode out of a deployed environment, and
  authorization rules.
- **Non-goals**: real passwords, password storage, rate limiting or lockout,
  creating employees at sign-in, and an identity picker listing employees.

## Assumptions

- "Special character" means any character that is not a letter or digit. A run of
  several such characters counts once. If the email ends in one, nothing is
  appended.
- The password is compared exactly against the derivation of the normalised
  (trimmed, lower-cased) email, so it is lower-case.
- Two distinct refusal codes are acceptable here. The password is derivable, so
  saying "no such employee" reveals nothing worth hiding and saves a developer
  guessing.
- The existing `bmapp.devEmail` storage key is reused to pre-fill the email. It
  holds an email, never a password or token.
