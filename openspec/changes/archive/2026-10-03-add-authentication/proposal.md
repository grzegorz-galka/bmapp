## Why

Every endpoint BMAPP serves is open, and every page is served to anyone who can
reach the port. The application therefore has to stay bound to `127.0.0.1`, which
means it cannot be deployed at all: the stack that supports a team's weekly board
meeting is reachable only from the machine it runs on. The hub compounds this by
naming a user it invented — `g.galka@pse.pl` is a constant in
`app/services/hub.py` — so the interface already speaks as though it knows who is
reading it while knowing nothing.

`team-membership` has just made the missing half available. Who belongs to a team
and who leads it are now recorded and enforced in the database, so there is at
last something for a permission rule to read. Authentication and authorization
are the last agreed capabilities standing between the application and a real
deployment, and every capability still to come — meetings, metric values,
problems, tasks — needs an authenticated author before it can record anything.

## What Changes

- **BREAKING**: `GET /hub` no longer succeeds unauthenticated, and no longer
  returns a fabricated identity. Its current scenario asserting that it needs no
  credentials is replaced.
- **BREAKING**: `POST /teams`, `POST /teams/{id}/members`,
  `DELETE /teams/{id}/members/{employee_id}` and `PUT /teams/{id}/leader` require
  a token and the right relationship to the team. They currently accept anyone.
- The frontend gains a sign-in flow: Authorization Code with PKCE against the
  identity broker, tokens held in memory, a callback route, a bearer header on
  every API call, silent refresh, and sign-out. The header gains an account
  control, which the `hub` capability currently forbids.
- A **dev mode** behind `BMAPP_MODE=dev` issues a locally signed token of the
  same shape, so the whole chain can be exercised without the broker. It is off
  by default and structurally unable to work in a deployed environment.
- Authorization arrives with no roles: a global admin list from
  `BMAPP_ADMIN_EMAILS`, and everything else read from `team_members`. Refusals
  carry `auth.*` codes in the established `{field, code, message}` shape and are
  translated into both languages.
- Read access is granted by a valid token alone. An employee not yet on any team
  has no `employees` row and can still read every board; only writing requires
  one.

Not in scope: an admin interface for managing the admin list, auditing beyond the
logging convention already in `CLAUDE.md`, and any permission rule for meetings,
metrics, problems or tasks, none of which exist yet. The permission table in
`SECURITY.md` names them so that the capability they arrive with has a rule to
implement rather than a rule to invent.

## Capabilities

### New Capabilities

- `authentication`: Establishes who is making a request. The federated chain and
  the PKCE flow, validation of the resulting token against the broker's published
  keys, the mapping from the token's email claim to an employee, the dev-mode
  substitute, and the refusal of a request that carries no usable token.
- `authorization`: Decides whether that person may do what they are asking.
  The admin list, the rules derived from team membership and leadership, the
  refusal codes, and the rule that the interface offers only the actions its
  viewer is permitted.

### Modified Capabilities

- `hub`: Two requirements are withdrawn and replaced, because each obliges the
  opposite of what this change requires and so cannot be amended in place.
  *The hub is supplied by a single read-only summary* obliges the request to
  succeed without the caller being authenticated; it is replaced by *The hub is
  supplied by a single authenticated summary*, which keeps every other rule — one
  read-only request, prose in both languages, stable codes, ISO 8601 instants, the
  provisional marker — and requires a token. *The hub identifies the current user*
  obliges a fixed placeholder identity and forbids any sign-in, sign-out or account
  control; it is replaced by *The hub identifies the signed-in person*, which
  requires the authenticated identity and the account control the old one forbade.

## Impact

**Backend.** A new `app/core/security.py` for token validation and the current-user
dependency, a new `app/api/auth.py` for the dev-mode login and the current-user
read, and a guard applied in `app/api/teams.py` and `app/api/hub.py`. A
`ForbiddenError` and an `UnauthenticatedError` join the `DomainError` hierarchy in
`app/core/exceptions.py` and need no new handler: `main.py` already maps domain
errors to the shared error body. `app/services/hub.py` loses its `_CURRENT_USER`
constant and takes the identity from the request instead — the rest of its
placeholder data is untouched. Settings gain the broker's issuer and client id,
`BMAPP_MODE` and `BMAPP_ADMIN_EMAILS`.

**Frontend.** A new `src/features/auth/` holding the flow, the callback route and
the sign-out control; `src/api/client.ts` attaches the bearer header and treats a
401 as a re-authentication rather than a field error; `routes.tsx` gains the
callback path; the header gains the account control; both catalogues gain the
`auth.*` codes. The members page shows its add, remove and hand-over controls only
to a viewer permitted to use them.

**New dependencies.** The backend needs a JWT and JWKS library. The frontend may
need an OIDC client library, or may implement PKCE against the Web Crypto API —
`CLAUDE.md` admits a dependency only if it removes meaningful code, and silent
refresh is where that case is strongest. Both choices belong in `design.md`.

**Infrastructure.** `.env.example` gains the new settings; `docker-compose.yml`
sets `BMAPP_MODE=dev` for local development only. The on-premise deployment needs
IT to register BMAPP as a public client with PKCE required and no secret, and to
allowlist the callback URL.

**Sequencing.** This change reads `team_members.is_leader`, so `add-team-membership`
must be complete and its specs synced first. It does not depend on anything else
in flight.

**Open decisions**, carried from `SECURITY.md` and settled in `design.md`: which
claim identifies BMAPP as a token's audience, and which mechanism makes dev mode
impossible in a deployed environment rather than merely discouraged.
