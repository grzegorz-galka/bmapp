# Proposal

## Why

The development password takes one character per part of the email, so it is
three or four letters long (`admin@example.com` → `aec`). That is short enough
to type by accident and reads like noise. Two characters per part keeps the
rule just as easy to work out from the email and gives a password that is
recognisably the email it belongs to: `admin@example.com` → `adexco`.

## What Changes

- **BREAKING** (development mode only): the development password becomes the
  first two characters of each run of letters and digits in the email, in
  order. A run of one character contributes that one character.
  `grzegorz.galka@pse.pl` signs in with `grgapspl`, `admin@example.com` with
  `adexco`. The old one-letter passwords are refused like any other wrong
  password.
- The login window's explanation of the rule, in English and Polish, states the
  new rule and its example.
- The documentation that states the rule (`README.md`, `SECURITY.md`,
  `CLAUDE.md`) and the end-to-end suite's copy of the rule follow it.

Nothing else about development mode changes: who may sign in, the refusal code
`auth.password_incorrect`, the normalisation of the email, and the guarantees
that keep the mode out of a deployed environment all stay as they are.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authentication`: the requirement "The development password is derived from
  the email" changes its rule from one character per part to two, with
  scenarios updated to the new passwords and one added that the old password is
  refused.

## Impact

- Backend: `app/services/dev_login.py` (`dev_password`), its unit test and the
  development-mode integration test.
- Frontend: the `auth.devLoginHint` text in `src/i18n/en.ts` and `pl.ts`; test
  fixtures that type a password (`DevAuthProvider.test.tsx`,
  `DevLoginDialog.test.tsx`); the e2e copy of the rule in `e2e/auth.ts`.
- Docs: `README.md` (table of example passwords), `SECURITY.md`, `CLAUDE.md`.
- The Railway demo: everyone who signs in there needs the new password once it
  is redeployed. No data, schema or API shape changes; no migration.
