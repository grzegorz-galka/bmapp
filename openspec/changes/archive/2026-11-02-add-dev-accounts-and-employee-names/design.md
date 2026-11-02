# Design

## Context

For the motivation, see proposal.md, *Why*. Here is how things work today:

- **Dev sign-in.** `POST /auth/dev-login` (`app/services/dev_login.py`) compares the
  given password with `dev_password(email)`, stores nothing, and mints an HS256 token
  through `issue_dev_token`. Every request after that is verified by
  `app/core/security.py::verify_token`, which takes only the `email` claim.
- **Admins without a record.** An administrator from `BMAPP_ADMIN_EMAILS` may sign in
  with no `employees` row. That is how the first team gets registered on an empty
  database.
- **No names anywhere.** An `Employee` has only an email. `dashboard.identify()`
  guesses initials from the email.
- **People are referenced two ways.**
  - By foreign key, with the employee joined: members, hosts, metric owners,
    responsible members, pulse respondents.
  - By a plain email column: `recorded_by_email` on thresholds and values, and
    `corrected_by_email` on corrections.
- **The dashboard summary** is held to a fixed number of SQL statements and never
  writes.
- **`GET /auth/me`** is today read only by pages that need `useIsAdmin`. The header
  shows the token's email from `useAuth`.

## Goals / Non-Goals

**Goals:**
- Sign-in still turns a password into the same JWT, so authorization keeps running
  through the code path production uses.
- There is one place where a display name is computed, and every response that names a
  person goes through it.
- Production gets real names as soon as Keycloak sends the claims, with no further code
  change.

**Non-Goals:**
- Changing a password after the first sign-in through the interface. The endpoint
  allows it, but no screen offers it.
- A screen for a forgotten password. Deleting the `dev_credentials` row is the reset.
- Editing a name in BMAPP outside the dev first-login window. In production, Active
  Directory owns names.
- Rewriting the federation description in `SECURITY.md` and CLAUDE.md for Keycloak.
  That is a separate docs change.
- Sorting by name. Lists stay ordered by email.

## Decisions

### D1. Check the password once, then issue the existing JWT, not HTTP Basic

Sign-in still exchanges credentials for an HS256 token, and requests still carry
`Bearer`.
- **Alternative: HTTP Basic on every request.** This would add a second way of
  verifying requests that only dev mode uses. That breaks the "same code path as
  production" property `SECURITY.md` relies on. The browser's own Basic prompt also
  can't show a "set your password" step or sign out cleanly.

### D2. Passwords go in `dev_credentials`, keyed by email

`dev_credentials(email VARCHAR(254) PK CHECK (email = lower(btrim(email))),
password_hash TEXT NOT NULL, changed_at TIMESTAMPTZ NOT NULL DEFAULT now())`.
There is no foreign key to `employees`.
- **Alternative: a `password_hash` column on `employees`.** This fails for an
  administrator with no record, unless signing in creates that record, which the
  `authentication` spec forbids. It would also leave a column that is always NULL in
  production.
- **Alternative: create the admin's employee row on first sign-in.** This bends the
  employee rule only for dev mode. And because employees are recorded only through
  team assignment, it would create a second way for an employee row to come into being.
- The table exists in every environment, because migrations don't branch on the mode.
  Outside dev mode nothing reads or writes it: the routes that touch it are registered
  only when `BMAPP_MODE=dev`.

### D3. Hash with `hashlib.scrypt` from the standard library

- **Parameters:** `n=2**14, r=8, p=1`, a 16-byte random salt and a 32-byte key.
- **Stored form:** one string,
  `scrypt$<n>$<r>$<p>$<salt b64>$<hash b64>`, so the cost can be raised later
  without a schema change.
- **Comparison:** done with `hmac.compare_digest`.
- **Alternative: `argon2-cffi` or `bcrypt`.** Either adds a dependency that removes no
  code. scrypt is memory-hard, which is enough for test accounts. The dependency rule
  in CLAUDE.md decides it.

### D4. The first sign-in is a successful response without a token, not a 401

When the derived password is right and no credentials row exists, `POST /auth/dev-login`
answers 200 with `{"password_change_required": true, "name": "Jan", "surname": "Kowalski"}`.
Both names are null for an administrator with no record. Otherwise it answers 200 with
the usual `{"access_token", "token_type"}`. The response model is a union of the two,
and the client branches on `password_change_required`.
- **Alternative (the earlier proposed default): a 401 with
  `auth.password_change_required`.** The window needs the proposed name and surname,
  and an error entry is `{field, code, message}` with nowhere to put them. It would
  also mean either duplicating the name rule in TypeScript or making a second call.
  And nothing was refused here: the password was right.
- **Why "none" for an admin with no record means no name fields:** that same null tells
  the window to hide the name fields. It doesn't need another flag.

### D5. `POST /auth/dev-password` sets the password and returns the token

- **Body:** `{email, current_password, new_password, name, surname}`.
- **Registration:** registered under the same dev-only guard as `/dev-login`.
- **Order of checks:**
  1. The current password is the email's current one (the derived one, or the stored
     one).
  2. The email is an employee's or an administrator's.
  3. The new password follows the rules in the spec.
- **On success:** one transaction upserts `dev_credentials` and, for a recorded
  employee, writes the trimmed name and surname, blank becoming NULL. It then returns
  `DevToken`.
- **Logging:** the email and the outcome are logged at INFO, never a password or a name.
- **Field codes:**
  - `dev_password.too_short` and `dev_password.unchanged`, raised as
    `PydanticCustomError` or a `DomainError` subclass, following the existing pattern;
  - `employee_name.too_long`;
  - `auth.password_incorrect` and `auth.employee_unknown` are reused.
- **Alternative: let the first `dev-login` call also take the new password.** That
  would mix two steps into one request shape. It also stops the window from showing
  the proposed names before the person types.

### D6. One pure function computes a display name; responses carry `display_name`

- **Where:** a new `app/services/names.py` holds:
  - `name_parts_from_email(email) -> (name, surname | None)`;
  - `display_name(email, name, surname) -> str`;
  - `initials(display_name) -> str`.
- **They replace** `identify()`'s guessing and `_initials` for people. Team badges keep
  their own rule.
- **In responses:** every schema that carries a person's email gains `display_name: str`
  beside it. Fields named `*_email` get a sibling `*_display_name`, for example
  `recorded_by_display_name`. It is a single string, not name and surname. The interface
  only ever shows the joined form, and initials are computed on the server.
- **Name and surname as separate fields** appear only on `GET /auth/me` and in the
  first sign-in response, where the window needs the parts.
- **Alternative: send name and surname everywhere and join them in the client.** That
  would mean either copying the fallback rule into TypeScript or sending three fields
  where one will do.
- **Alternative: store the derived name in the columns.** Then nobody could tell
  "derived" from "set", and a name arriving later from the claims could never be
  distinguished from a guess.

### D7. Resolving names for people referenced by a plain email column

`recorded_by_email` and `corrected_by_email` aren't foreign keys. Those queries add a
`LEFT OUTER JOIN employees ON employees.email = <column>`, which keeps the statement
count the same. An email with no employee, such as an administrator with no record,
falls back to the derived name.
- **Alternative: a second query per page to resolve names.** It would break the
  dashboard's fixed statement count, and it isn't simpler.
- **Alternative: convert those columns to foreign keys.** That changes the schema well
  beyond this change, and administrators with no record would still need a fallback.

### D8. Broker name claims are stored when `GET /auth/me` is read, and the header reads it

- **Reading the claims:** `AuthenticatedPerson` gains optional `given_name` and
  `family_name`, read from the verified token only in broker mode. Dev tokens carry
  neither.
- **Writing them:** `GET /auth/me` updates the employee's name and surname when a
  non-blank claim differs from the stored value.
- **Calling it on every page:** to make sure it runs after every sign-in, the header's
  account control reads `/auth/me` through `useCurrentUser`, which is already a shared
  query. The display name and initials come from there instead of the token's email.
  `useIsAdmin` keeps reading the same query.
- **Alternative: write in the authentication dependency on every request.** That adds
  a write path to every read endpoint, and the dashboard summary would stop being
  read-only.
- **Alternative: write on the dashboard summary.** It is deliberately read-only, and
  the dashboard is not the only page someone lands on.

### D9. The first-login window has two steps in one dialog

`DevLoginDialog` gets a second state, `setPassword`:
- the email is fixed;
- name and surname are filled in from the response and shown only when not null;
- the new password is asked for twice, and a mismatch is caught before sending with the
  frontend key `auth.passwordMismatch`.

It reuses `components/Modal.tsx` behaviour, the existing field-error rendering and
`controls.module.css`. Closing the dialog sends nothing, so nothing is stored.

### D10. The e2e helpers set a fixed test password

`frontend/e2e/api.ts` and `frontend/e2e/auth.ts`:
1. Sign in with the derived password.
2. On `password_change_required`, set `E2E_PASSWORD` (a constant), keeping the proposed
   names.
3. If the derived password is refused because a password was already set in an earlier
   run, sign in with `E2E_PASSWORD`.

A dedicated Playwright spec walks through the window's first-login step.

## Risks / Trade-offs

- **[Railway demo lockout]** The first stranger to sign in as the demo administrator
  chooses its password, and everyone after them is locked out. → The demo is disposable
  by its own terms. Deleting the `dev_credentials` row (or wiping the database) restores
  the derived password. `SECURITY.md`'s Railway section says so.
- **[Claims missing from the access token]** Keycloak may put `given_name` and
  `family_name` only in the ID token. → The claims are optional, and the derived name
  still applies. Turning on "add to access token" on the profile mappers is Keycloak
  configuration, not BMAPP code.
- **[Derived names lose diacritics]** `galka` is never "Gałka". → In production the
  name comes from the claims. In dev mode the first-login window lets the person
  correct it.
- **[Wide frontend diff]** About 25 components switch from email to name, which is easy
  to miss. → `grep` for the email fields in `src/api` types during apply. Each tile or
  list test asserts the name.
- **[Personal data in logs]** Names are personal data. → No log line includes a name.
  The existing email-only logging rule stands.
- **[Name changes in AD reach BMAPP late]** A rename shows only after that person next
  opens the app. → That's acceptable: nobody else's view depends on it being instant.

## Migration Plan

1. **Alembic migration `0012_add_dev_accounts_and_employee_names`.** It adds nullable
   `employees.name VARCHAR(100)` and `employees.surname VARCHAR(100)`, and creates
   `dev_credentials`. Nothing is backfilled, because the fallback covers every existing
   row.
2. **Deploy order** doesn't matter within the single Compose stack. The new response
   fields are additive, and the frontend ships in the same release.
3. **Rollback:** the downgrade drops the table and the two columns. Chosen dev passwords
   and stored names are lost, and dev sign-in falls back to the derived password.
