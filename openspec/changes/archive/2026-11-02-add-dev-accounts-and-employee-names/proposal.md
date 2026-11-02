# Proposal

## Why

BMAPP is about to be put in front of users for testing. Most of that testing has to
happen in development mode, because the identity broker can't be reached from the
test environments. Two things make the application feel like a toy there:

- Every password can be derived from its email, and nobody ever owns their account.
- Everywhere it names a person, the interface shows a raw email address, never a name.

Production has the same name problem. Keycloak, attached to Active Directory, knows
every employee's given name and surname, but BMAPP never reads them.

## What Changes

- **Development mode gets real accounts.**
  - A person's first sign-in still uses the password derived from their email.
  - The login window then asks them to choose their own password. In that same step it
    asks for their name and surname, already filled in from the email.
  - From then on, only the chosen password signs them in, and the derived one is refused.
  - Passwords are stored hashed in a new `dev_credentials` table keyed by email. This
    works for an administrator who has no employee record.
  - Forgetting a password needs no screen: deleting the row brings the derived password
    back.
  - **BREAKING (development mode only):** a first sign-in no longer returns a token
    straight away, so the e2e sign-in helpers have to set a password first.
- **Employees have a name and a surname.** These are two new nullable columns on
  `employees`:
  - **Production:** they are filled in from the token's optional `given_name` and
    `family_name` claims whenever the signed-in person reads who they are.
  - **Development mode:** they are filled in from the first-login window.
- **A display name, with a fallback.**
  - When both columns are empty, the name comes from the part of the email before the
    `@`, split on `.` and `_`, each part with a capital first letter:
    - one part is a name;
    - two parts are a name and a surname;
    - with more parts, the first is the name and the rest make the surname;
    - a hyphen stays inside its part (`kowalska-nowak` gives "Kowalska-Nowak").
  - The fallback is computed when a name is read and is never stored.
- **The interface names people, not addresses.** Every API response that names a person
  carries their display name next to the email, and the interface shows the name. The
  email stays visible where the address itself matters:
  - the members page, beside the name;
  - the account control's menu;
  - fields where a member is added by email;
  - the readiness panel's "copy addresses".
- **Initials come from the display name.** They replace the email-based guess in the
  dashboard summary.
- **`GET /auth/me` returns name and surname** next to the email and the administrator flag.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authentication`:
  - development mode signs in with a stored, hashed password after a first sign-in with
    the derived one;
  - the first-login window collects a new password, a name and a surname;
  - the current user carries a name and a surname;
  - in broker mode, the token's name claims are stored on sign-in.
- `team-membership`: employees carry an optional name and surname with a derived
  fallback, and every person a response names carries the display name.
- `dashboard`: the header identifies the signed-in person by display name, and initials
  are derived from it. A host who is not the viewer is named by display name.
- `meeting-readiness`: missing metrics name their owner by display name. Copying
  addresses still copies emails.

## Impact

- **Database:**
  - one migration adds `employees.name` and `employees.surname`;
  - it creates `dev_credentials (email PK, password_hash, changed_at)`.
- **Backend:**
  - `app/services/dev_login.py` and `app/api/auth.py` add the first-login path and a
    `POST /auth/dev-password` endpoint;
  - `app/core/security.py` reads the optional name claims;
  - a new pure function derives a display name from an email;
  - the person-naming fields in the schemas for teams, meetings, metrics, items, pulse
    and the dashboard each gain `display_name`;
  - `identify()` in the dashboard service stops guessing initials from the email.
- **Frontend:**
  - `DevLoginDialog` gains a "set your password" step;
  - every component that shows an email as a person's name switches to the display name
    (about 25 files);
  - new strings go into `en.ts` and `pl.ts`;
  - e2e helpers in `frontend/e2e/auth.ts` and `frontend/e2e/api.ts` set a password on
    first sign-in.
- **Dependencies:** none new. Hashing uses the standard library's `hashlib.scrypt`.
- **Docs:** the dev-mode section of `SECURITY.md` and the dev-mode paragraph of
  CLAUDE.md need updating. The federation description in both (IdentityServer and ADFS)
  is out of date now that Keycloak is the broker. That rewrite is left to a separate
  docs change.
- **Railway demo:** the first visitor to sign in as the demo administrator sets that
  account's password for everyone after them (see design.md, *Risks*).
