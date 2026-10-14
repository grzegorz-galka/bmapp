# Design

## Context

`dev_password` in `backend/app/services/dev_login.py` is the only place the rule
is computed for real. The browser deliberately does not hold it: the login window
asks for the password and never works it out. The end-to-end suite keeps its own
copy in `frontend/e2e/auth.ts` so it can sign in, and the docs and the login
window's hint state it in prose with an example. All of these change together;
see the proposal for why the rule changes.

## Goals / Non-Goals

**Goals:**

- One rule, stated identically in the spec, the code, the e2e copy, the hint and
  the docs.

**Non-Goals:**

- Making the password a secret. It stays derivable by anyone; the mode toggle,
  not the password, is what keeps development mode out of a deployed system.
- Accepting the old password during a transition. Development mode holds test
  identities only, so there is nothing to migrate.

## Decisions

**Take the first two characters of each run of letters and digits.** Stated as
runs of alphanumerics rather than "after each separator" because two characters
per part reads naturally that way, and it handles the edges without special
cases: a leading or trailing separator yields no run, a run of separators
separates once, and a one-character part (`a.b@c.pl`) contributes the one
character it has. *Alternative:* keep the separator-scanning loop and take the
next two characters - rejected, it needs a second state for "one taken, one to
go" and a one-character part would swallow the separator after it unless guarded.

**Letters and digits as Python's `str.isalnum` and the e2e copy's
`[\p{L}\p{N}]`.** Unchanged from today, so a Polish letter in an email counts as
a letter on both sides. The e2e copy becomes a match over runs
(`/[\p{L}\p{N}]+/gu`, each sliced to two), which is simpler than the current
separator-then-character expression.

**Example emails stay the ones already in the spec and docs**, with
`admin@example.com` → `adexco` added as its own scenario because it is the
address the compose stack and the Railway demo make administrator and so the
one most people type.

## Risks / Trade-offs

- [Everyone's typed password stops working, locally and on the Railway demo] →
  The login window's hint states the new rule with an example, and the refusal
  already names the password field. The README table shows the new passwords.
- [The e2e copy drifts from the backend] → It is exercised by every sign-in in
  the suite, so a drift fails the whole suite at once; the unit and integration
  tests pin the backend side with the same example emails.

## Migration Plan

None beyond deploying: no data or schema changes. Redeploy the Railway demo
backend and frontend (the hint text is built into the web app) after merge.
