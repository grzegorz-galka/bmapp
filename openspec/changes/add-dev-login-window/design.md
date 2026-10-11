## Context

Development mode exists already (archived change `2026-10-03-add-authentication`).
These parts of it stay as they are:

- `POST /auth/dev-login` is registered only when `BMAPP_MODE=dev`.
- Tokens are HS256, signed with a secret generated per process.
- A dev token fails on the algorithm in broker mode.

`DevAuthProvider` signs in by itself when the page loads, as the email in
`localStorage['bmapp.devEmail']`, falling back to `VITE_DEV_EMAIL`. When a 401
arrives because uvicorn reloaded and minted a new secret, it re-obtains a token
silently.

Employees are recorded only on their first assignment to a team
(`get_or_create_employee`). On an empty database, the only people who can act are
the administrators from `BMAPP_ADMIN_EMAILS`.

The end-to-end suite signs in by seeding `bmapp.devEmail` before boot
(`e2e/auth.ts`), and calls `dev-login` directly in `e2e/api.ts`.

## Goals / Non-Goals

**Goals:**
- One place on each side owns the password rule:
  - backend: the decision;
  - e2e helper: typing it.
- The production code path stays untouched. Everything changes inside
  dev-mode-only code: the dev route, `DevAuthProvider`, and a dialog only it
  renders.
- The e2e suite keeps running through the real UI and real guards.

**Non-Goals:**
- Making the dev password a security control. It is a typing check (see
  Decisions).
- Changing token shape, verification, `/auth/me` or authorization.

## Decisions

### Reverse "`dev-login` takes an email and no password", deliberately

The earlier decision rejected a `password` field that is "never checked". This
field is checked, against a rule anyone can work out. That is honest only if the
code and the docs say plainly that it is not a secret.

- The schema docstring and the OpenAPI description call it a *development
  password derived from the email*.
- `SECURITY.md` states that it adds no protection beyond the mode toggle.
- Its value is UX. A login window is how a tester picks who they are, and the
  window makes picking the wrong identity unlikely.

*Alternative:* a window with an email only. It was rejected because the user asked
for email and password, and a password field mirrors what the broker login will
look like.

### The rule lives in one pure function in the backend

`app/services/dev_login.py` holds two functions:

- `dev_password(email: str) -> str`: pure, unit-tested from the examples in the
  spec.
- `authenticate_dev_login(session, email, password, admin_emails) -> str`:
  1. checks the password first;
  2. looks up the employee by email (a read only — it never creates one);
  3. lets an administrator's email through without an employee record;
  4. returns the normalised email.

The router calls it and then `issue_dev_token`.

The password is checked **before** the employee lookup, so a wrong password costs
no query. The order is observable only when both are wrong. In that case
`auth.password_incorrect` wins; the spec does not pin the order.

The derivation splits on characters for which `str.isalnum()` is false. The email
is already normalised by `EmployeeEmail`, so `dev_password` receives a lower-cased,
trimmed address.

The frontend does **not** compute the password. If it did, the window could fill
it in by itself and would be pointless. The e2e suite needs the password to type
it, so `e2e/auth.ts` holds a three-line copy of the rule. The integration tests
pin the backend's rule, and an e2e sign-in that fails shows at once if the two
drift.

### Two new `DomainError` subclasses, 401, carrying a field

- `IncorrectDevPasswordError`: code `auth.password_incorrect`, field `password`.
- `UnknownEmployeeError`: code `auth.employee_unknown`, field `email`.

Each sets `status_code = 401` and takes `field` like other domain errors. They
subclass `DomainError`, not `UnauthenticatedError`, because that class fixes the
message and carries no field. They are not token failures either.

The existing single exception handler maps them. The frontend's 401 path in
`api/client.ts`, which retries with a fresh token, is never involved, because the
dialog calls `dev-login` with a plain `fetch`, as `DevAuthProvider` already does.

*Alternative:* a single `auth.credentials_invalid`. It was rejected because the
password is derivable, so hiding which part was wrong protects nothing and costs
a developer a guess.

### The window is a modal `<dialog>` owned by `DevAuthProvider`

`DevAuthProvider` gains a `dialogOpen` state:

- It no longer signs in on mount. It goes from `restoring` to `signedOut` and
  opens the dialog.
- `signIn()` opens the dialog instead of fetching.
- Submitting the dialog calls `dev-login`. On success it stores the token in
  memory, writes the email to `bmapp.devEmail`, and closes. On failure it maps
  `errors[].code` to `t('errors.<code>')` beside the field.
- Closing the dialog leaves `signedOut`.

`AuthState` and `AccountControl` do not change. The header's "Sign in" button
already calls `signIn()`, so the broker provider is untouched.

The dialog is a native `<dialog>` opened with `showModal()`. That gives focus
trapping, Escape-to-close and a backdrop for free, with no dependency. It lives in
`features/auth/DevLoginDialog.tsx` with a CSS Module, and all its strings come
from `en.ts`/`pl.ts` under `auth.devLogin*`.

### Credentials stay in page memory for silent recovery

`uvicorn --reload` mints a new HS256 secret on every backend edit. That 401s every
open page, and today the page recovers silently. To keep that, the provider holds
the last successful `{email, password}` in a `useRef`: in memory, never in
storage, and gone on reload. The reauthenticate hook replays them.

This keeps "tokens do not outlive the page" intact. The password is no more
sensitive than the email it is derived from.

*Alternative:* treat the 401 as "session ended" and reopen the window. It was
rejected because it would sign the developer out on every backend save.

### End-to-end sign-in goes through the window

`signInAs(page, email)` installs a Playwright locator handler on the login
window. A reload or a `page.goto` opens the window. The handler fills in the email
and the derived password before the next action or assertion. Specs therefore
keep their navigation as written. Calling `signInAs` again replaces who answers.

The window is found by a selector that does not depend on its wording, because
some specs switch to Polish first.

*Alternative:* an `openAs(page, email, path)` helper called after every
navigation. It was rejected because it means editing every `page.goto` in seven
specs, and the next spec written can forget it.

Specs that relied on the old automatic administrator sign-in now call
`signInAs(page)` in a `beforeEach`.

`apiAs` sends `{email, password: devPassword(email)}`.

The one spec that signed in as an unknown "nobody" now uses the team's leader. The
leader is an employee but not an administrator, which is all that spec is about.
The rule *"anyone signed in reads everything"* is still proven for non-employees
by the backend integration tests. Those tests mint tokens with `issue_dev_token`
directly, so they bypass the login.

## Risks / Trade-offs

- [Someone reads the dev password as real authentication] → The docstrings,
  OpenAPI text, README and `SECURITY.md` say it is derived and public. The
  existing guards still make the route unreachable outside dev mode.
- [The e2e copy of the rule drifts from the backend] → Any drift fails every e2e
  sign-in immediately. The rule is three lines.
- [Reload now costs a sign-in in local development] → The email is pre-filled and
  the password is short. This was accepted when the user chose "show login again".
- [The e2e suite becomes slower and some specs need setup] → It is one form fill
  per navigation, and the setup goes through the existing `apiAs` helpers.

## Migration Plan

Dev only; nothing is deployed. There is no database migration. `VITE_DEV_EMAIL`
keeps working as the pre-fill default when nothing is remembered. Rollback means
reverting the change.
