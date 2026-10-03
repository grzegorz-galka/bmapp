## Context

See `proposal.md` — Why. `SECURITY.md` holds the agreed security concept: the
federated chain, the token handling and the permission table. This document settles
the two decisions that document left open and the implementation choices the specs
deliberately do not name.

Three constraints shape everything below.

The deployment is **on-premise and cannot assume the public internet**. The identity
broker is reachable; `cdn` hosts and public JWKS mirrors are not. Nothing may depend
on a network the deployment does not have.

The frontend is a **single-page application**, so it is a public client. It holds no
secret, which rules out every flow that needs one.

`team-membership` already answers **who belongs to a team and who leads it**, and
enforces one leader per team with a partial unique index. Authorization reads those
records; it introduces no storage of its own. **This change adds no table and no
migration** — unusual enough to be worth stating, since the Definition of Done asks
about migrations.

## Goals / Non-Goals

**Goals:**

- One place that answers "who is this request from", used by every capability that
  follows.
- Permission rules that are pure functions of facts already recorded, unit-testable
  without HTTP or a database.
- A development mode that exercises the production code path rather than a parallel
  one, and that cannot work in a deployed environment.

**Non-Goals:**

- Managing the administrator list from inside the application. It is configuration,
  changed by whoever deploys.
- Rules for meetings, metric values, problems and tasks. None exist yet; the
  permission table in `SECURITY.md` records the intent so the capability that builds
  each has a rule to implement rather than invent.
- Auditing beyond the logging convention already in `CLAUDE.md`.
- Authorizing reads. Every authenticated person may read everything, so no read path
  needs a rule.

## Decisions

### Validate tokens with PyJWT, not python-jose or authlib

PyJWT ships `PyJWKClient`, which fetches the broker's JWKS, caches it and re-fetches
on an unknown key id — which is the whole of what we need from a JWKS layer, and the
part most likely to be written subtly wrong by hand. `authlib` brings an OAuth client
and server framework we would use a corner of; `python-jose` has been unmaintained
for long stretches and bundles its own crypto backends.

Validation is one call with `issuer`, `audience` and `algorithms` all passed
explicitly. Passing `algorithms` explicitly is not a detail: accepting the algorithm
the *token* names is the classic JWT vulnerability, and it is also the mechanism
behind the dev-mode decision below.

### The algorithm set is chosen by mode, and the two never overlap

This is how dev mode is made impossible in a deployed environment rather than merely
discouraged — the first question `SECURITY.md` left open.

```
  BMAPP_MODE=broker (default)        BMAPP_MODE=dev
  algorithms = ["RS256"]             algorithms = ["HS256"]
  key        = broker JWKS           key        = process-local secret
  issuer     = broker issuer         issuer     = "bmapp-dev"
  dev-login route: not registered    dev-login route: registered
```

A dev token is signed HS256 by a secret this process generated. A broker-mode server
accepts RS256 only, so it rejects that token on the algorithm before it ever looks at
the key. There is no configuration in which both are accepted, so a dev token cannot
be made to work against a deployed server even if the endpoint were somehow reachable.

Alternatives considered. *A shared secret in configuration* — then a leaked or
default secret mints valid identities, which is the failure mode we are trying to
make structurally impossible. *A build-time flag excluding the route* — real, but it
means the image under test is not the image deployed, and it leaves nothing stopping
a token that was already minted.

Two cheaper guards sit alongside it, neither load-bearing on its own: the dev-login
route is registered only when the mode is on, and the application refuses to start
when dev mode is combined with a configured identity broker, reporting why. The
startup check turns a misconfiguration into a loud failure at boot instead of a quiet
one at request time.

The broker is the signal, not the bind address. An earlier draft of this design
guarded on a non-loopback `BMAPP_HOST`, which cannot work: the application never
reads that setting — the container image passes `--host 0.0.0.0` to uvicorn
directly — and inside a container `0.0.0.0` is the normal binding and says nothing
about whether the host published the port beyond itself. A configured issuer, by
contrast, is present in every deployed environment and absent in every local one,
and removing it to evade the check would break real authentication outright.

The dev secret is generated per process rather than read from configuration, so no
key exists to leak and none is committed. Restarting the backend invalidates
outstanding dev tokens; in development that means signing in again, which is
acceptable and is what the e2e suite does on every run anyway.

### `dev-login` takes an email and no password

`SECURITY.md` left this open alongside the mechanism above. A field named `password`
that is transmitted, logged and never checked reads as authentication to anyone
reviewing the code — and if any value is accepted, it protects nothing that the
toggle does not already protect. The endpoint takes an email, mints a token for it,
and is honest about being an identity picker.

### Permission rules are pure functions; the router does the I/O

`CLAUDE.md` puts business logic in services, testable without HTTP, and leaves
routers to validate input and call them. A permission rule needs a database read, so
it splits:

```
  app/services/authz.py     pure: (is_admin, membership) -> bool
                            no session, no HTTP, exhaustively unit-tested

  app/core/security.py      FastAPI dependencies: decode the token, resolve the
                            employee, load the membership for the path's team,
                            apply the rule, raise ForbiddenError
```

The rules are small enough to enumerate in a table of their own, and keeping them
pure means every row of `SECURITY.md`'s permission table has a unit test that needs
no fixture.

Refusals reuse the existing machinery exactly: `UnauthenticatedError` and
`ForbiddenError` extend `DomainError`, so the handler already in `main.py` renders
them into the same `{field, code, message}` body as every other rejection, and
`ApiError` in the frontend parses them with no change. No new exception handler.

### Who the caller is, and whether they are an administrator, is its own endpoint

`GET /auth/me` rather than folding the answer into `GET /hub`. Whether someone is an
administrator cannot be derived from any payload the frontend already receives — the
admin list is server-side only — and the team pages need the answer as much as the
hub does. The hub summary is placeholder data destined to be replaced slice by slice;
hanging a permanent contract off it would couple the two.

### oidc-client-ts on the frontend, configured to keep nothing

`CLAUDE.md` admits a dependency only if it removes meaningful code. Hand-rolled PKCE
is a `code_verifier`, an S256 challenge over Web Crypto, state and nonce generation
*and verification*, the token exchange, expiry tracking, silent renew in a hidden
frame, and the end-session redirect. The verification half is security-critical and
is exactly the part that looks finished while being wrong.

One configuration point matters: the library defaults to `sessionStorage`, which the
spec forbids. It must be given an in-memory store, and `src/features/auth/` owns that
wiring so the constraint sits in one reviewable place rather than in a settings
object nobody reads.

**Consequence**: a page reload loses the token. Mitigated by a silent sign-in against
the broker's own session on startup — the browser still holds the broker's cookie, so
the person is returned signed in without interaction. When that fails they are signed
out, which the spec already requires to be visible rather than silent.

### 401 and 403 are handled differently in the client

A 403 is an ordinary rejection: it carries a code, is translated, and is shown where
the user acted. A 401 means the session is gone, so `src/api/client.ts` raises it to
the auth layer to re-authenticate rather than rendering it beside a form field. One
retry after a successful silent renew, then sign-out — never a loop.

## Risks / Trade-offs

**The broker becomes a single point of failure for the whole application** → Nothing
can be done about sign-in, which is the point of delegating it. The JWKS is cached,
so a broker that goes down after a person has signed in does not end their session
until their token expires. Accepted: the alternative is BMAPP holding credentials.

**`BMAPP_ADMIN_EMAILS` is empty or wrong, and nobody can register a team** → The spec
requires an empty list to refuse rather than permit, so the failure is a locked door
rather than an open one. The application logs the number of administrators
configured at startup, which makes the mistake visible without putting emails in the
log.

**An employee loses access the moment they are removed from their last team** → They
remain authenticated and can still read everything; only writing stops. That is the
intended behaviour, and it is why reads are not gated on the employee record.

**Existing tests break by design** → The hub's "summary needs no authentication"
assertion and the unauthenticated team-registration tests assert the behaviour this
change reverses. They are replaced, not weakened. The e2e suite needs a signed-in
browser context, which dev mode provides.

**Every future capability inherits a dependency on this one** → Accepted and
intended; it is why the current-user dependency is a single seam rather than a
check copied into each router.

## Migration Plan

No database migration: no table is added or altered.

1. IT registers BMAPP in the identity broker as a **public client with PKCE
   required and no secret**, and allowlists the SPA's callback URL.
2. Deploy with `BMAPP_MODE` unset (broker mode), the broker's issuer and client id
   configured, and `BMAPP_ADMIN_EMAILS` naming at least one administrator.
3. The first administrator registers the teams and names their leaders; leaders take
   over membership from there.

Local development keeps `BMAPP_MODE=dev` in `docker-compose.yml`, which the stack's
loopback binding already satisfies.

**Rollback** is reverting the deployment: nothing in the database changes, so a
rolled-back server serves the same records to an unauthenticated caller as before.
That is also the reason the stack must stay bound to `127.0.0.1` until this change is
deployed and verified.

## Open Questions

**Which claim carries BMAPP's audience, and what value it holds.** The specs require
that a token naming another audience be refused, and the check is implemented either
way; what the expected value *is* depends on how IT registers the client — brokers
differ on whether the API's audience is the client id, a named API resource, or the
custom scope. It is a configuration value, settled by reading the issued token once
registration exists. It changes no requirement, no approach and no task.
