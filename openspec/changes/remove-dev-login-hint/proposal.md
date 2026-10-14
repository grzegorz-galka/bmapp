# Proposal

## Why

The development-mode login window tells everyone who opens it how the password is
derived, with a worked example. That turns the password into a label on the door:
anyone who reaches the window, including a visitor to the public Railway demo, can
sign in as anyone without having read the docs. The password is still not a
secret, but the people meant to use development mode learn the rule from the
README and `SECURITY.md`, so the window does not need to repeat it.

## What Changes

- The login window no longer shows the line explaining how the password is
  derived from the email. It shows its title, the email and password fields, any
  refusal, and its actions - nothing else changes.
- The `auth.devLoginHint` string is removed from the English and Polish
  catalogues, and the style that only it used goes with it.
- The rule stays documented where developers look for it: `README.md` ("Signing
  in locally") and `SECURITY.md`. Neither changes.

Nothing about the password itself changes: the rule, the refusal code and who may
sign in stay as they are.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authentication`: the requirement "Development mode signs in through a login
  window" gains the statement that the window does not say how the password is
  derived, with a scenario for it.

## Impact

- Frontend: `src/features/auth/DevLoginDialog.tsx` (the paragraph),
  `DevLoginDialog.module.css` (`.hint`), `src/i18n/en.ts` and `pl.ts`
  (`auth.devLoginHint`), and `DevLoginDialog.test.tsx` plus
  `e2e/sign-in-and-out.spec.ts` for the new scenario.
- The Railway demo: after redeploying, a visitor sees no hint. Whoever is
  given the demo's URL needs the password (`adexco` for `admin@example.com`)
  alongside it.
- No backend, API, data or migration change.
