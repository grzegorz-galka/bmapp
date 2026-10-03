# Target authentication mechanism
BM App app in target environment will use a **federated authentication chain** — two separate OIDC/OAuth2 hops. Here's what's happening:

## The Architecture: Federated Identity (Two-Hop Auth)

```
Browser → bmapp.inno.pse.pl → identity.intra.pse.pl → idpi.pse.pl (ADFS)
   (BM App)         (identity broker/gateway)      (actual AD auth)
```

---

## Hop 1 — BM App App → Identity Broker

**URL:** `https://identity.intra.pse.pl/connect/authorize/callback`

| Parameter       | Value                                                      | Meaning                                                       |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| `client_id`     | `bmapp`                                             | App name                                                      |
| `response_type` | `code id_token`                                            | **Hybrid Flow** (both auth code + id token returned together) |
| `response_mode` | `form_post`                                                | Tokens sent via HTTP POST, not in URL fragment                |
| `scope`         | `openid email profile offline_access bmapp`         | Requests refresh token (`offline_access`) + custom scope      |
| `redirect_uri`  | `https://intra.pse.pl/`                                    | Where to return after login                                   |
| `x-client-SKU`  | `ID_NET472`                                                | Microsoft's .NET 4.7.2 OIDC middleware                        |

**Server:** `identity.intra.pse.pl` — this is almost certainly **[IdentityServer4/Duende IdentityServer](https://duendesoftware.com/)**, a popular .NET identity broker. The `/connect/authorize` path is its signature endpoint.

---

## Hop 2 — Identity Broker → ADFS (the real AD authentication)

**URL:** `https://idpi.pse.pl/adfs/oauth2/authorize/`

|Parameter|Value|Meaning|
|---|---|---|
|`client_id`|`8464de9d-74f8-491a-8392-5096eef624da`|IdentityServer registered as a client in ADFS|
|`redirect_uri`|`https://identity.intra.pse.pl/signin-adfs`|Callback back to the identity broker|
|`response_type`|`code id_token`|Hybrid Flow again|
|`response_mode`|`form_post`|Same as above|
|`scope`|`openid profile`|Basic claims only — ADFS just authenticates the user|
|`x-client-SKU`|`ID_NET8_0`|Microsoft's .NET 8 OIDC middleware|

**Server:** `idpi.pse.pl/adfs/` — this is **Microsoft ADFS (Active Directory Federation Services)**. The `/adfs/oauth2/` path is the definitive ADFS signature.

---

## Summary

| Layer             | Server                          | Software                                | Role                                        |
| ----------------- | ------------------------------- | --------------------------------------- | ------------------------------------------- |
| Identity Broker   | `identity.intra.pse.pl`         | **Duende/IdentityServer4** (.NET 4.7.2) | Federates identities, issues tokens to apps |
| Corporate AD Auth | `idpi.pse.pl`                   | **Microsoft ADFS** (.NET 8)             | Actual Windows AD authentication            |
| BM App App  | `bmapp.pse-innowacje.pl` | Java                                    | Consumes tokens from IdentityServer         |

## What This Means for Configuring Your New App

You should integrate with **IdentityServer** (`identity.intra.pse.pl`), **not** directly with ADFS. Check its discovery document:

```
https://identity.intra.pse.pl/.well-known/openid-configuration
```

You'll need your IT/identity team to:

1. Register your new app as a **public client** in IdentityServer with a `client_id` of your choice, with **PKCE required**
2. Add your app's callback URL as an allowed `redirect_uri`
3. Grant the scopes you need (`openid email profile` at minimum)

**No `client_secret`.** BMAPP's frontend is a single-page application, so it is a
public client: any secret issued to it would ship inside the JavaScript bundle and
would not be a secret. PKCE replaces it. A secret would only come into play if the
token exchange moved to a backend-for-frontend, which is a different design and is
not what is specified here.

The flow to implement in your app is **Authorization Code Flow with PKCE** (recommended for SPAs over the hybrid flow used in the existing app).

---

# Frontend Authentication Flow

The React SPA handles authentication directly via **Authorization Code Flow with PKCE**:

1. User clicks "Login" → SPA redirects browser to IdentityServer's `/connect/authorize` endpoint with a PKCE `code_challenge`
2. User authenticates via IdentityServer → ADFS chain
3. IdentityServer redirects back to the SPA's callback URL with an authorization `code`
4. SPA exchanges the `code` + `code_verifier` for an **access token** and **refresh token**
5. SPA stores tokens **in memory** (not localStorage — to mitigate XSS risks)
6. Every API request includes the `Authorization: Bearer <access_token>` header
7. When the access token expires, the SPA uses the refresh token (`offline_access` scope) to obtain a new one silently

---

# Backend Token Validation

The backend acts as a **stateless OAuth2 Resource Server**:

- Validates incoming JWT access tokens on every request
- Retrieves IdentityServer's signing keys via the JWKS endpoint (discovered from `/.well-known/openid-configuration`)
- No server-side sessions — authentication state lives entirely in the token
- Rejects requests with missing, expired, or invalid tokens with HTTP 401

---

# User Identity Mapping

- The `email` claim from the OIDC access token is used to look up the `Employee` record by its `email` column
- If no matching Employee record exists, access is denied (HTTP 403) — there is no auto-provisioning of users
- The matched Employee becomes the "current user" for authorization decisions

---

# Test authentication
For local development and testing, a `dev` mode replaces OIDC with a simple login endpoint:

- **Endpoint:** `POST /api/auth/dev-login`
- **Request body:** `{ "email": "user@company.com" }`
- **Behavior:** Mints a token for that email. There is deliberately **no password
  field**: one that is sent, named `password` and never checked reads as
  authentication to anyone reviewing the code, while protecting nothing the mode
  toggle does not already protect. The email need not match an Employee record —
  someone on no team is authenticated and may read, which is what the
  authorization rules below say.
- **Response:** A JWT signed with a key generated per process, so none exists to leak or commit
- **Activation:** environment variable `BMAPP_MODE=dev`
- **Safety:** This endpoint does not exist when the mode is off, the server refuses
  to start when the mode is on and an identity broker is configured, and the two
  modes sign and accept **disjoint algorithms** (`HS256` for dev, `RS256` for
  broker), so a token minted here is refused by a deployed server on its
  algorithm before its key is ever consulted.

The returned JWT has the same structure as a real IdentityServer token (contains `email` claim), so the rest of the backend authorization logic works identically.

---

# Authorization

There are no roles. Authorization is decided by **one global flag and one
relationship**, and the question asked is never "what role is this user?" but
always **"may this user do X to *this team*?"**

```
  is_admin(user)          <- BMAPP_ADMIN_EMAILS      global, from configuration
  membership(user, team)  <- a team_members row      per team, from the database
         |
         +-- the row exists      -> a member of that team
         +-- the row.is_leader   -> the leader of that team
```

Leadership is a fact about a team, not a property of a person. It is assigned by
an admin when the team is registered, is held by exactly one member at a time
(enforced by a partial unique index on `team_members`), and is independent for
every team. One employee may lead any number of teams. There is therefore nothing
about leaders in configuration, and no role to resolve: `team_members.is_leader`
is the only answer.

## Who owns what

```
  ADMIN   owns the org chart   -> teams exist, and who leads them
  LEADER  owns their board     -> metrics, min/max, targets, schedule,
                                  and who is on their team
  MEMBER  owns the meeting     -> metric values, problems, tasks
  ANYONE  reads everything
```

## Permissions

A valid token grants **read**. Every endpoint below that is not a read also
requires the named relationship to the team concerned. An admin may do anything.

| Action                                      | Endpoint                                        | Who                          |
|---------------------------------------------|-------------------------------------------------|------------------------------|
| Read anything                               | `GET /hub`, `GET /teams`, `GET /teams/{id}`     | any valid token              |
| Register a team and name its leader         | `POST /teams`                                   | admin                        |
| Hand over leadership                        | `PUT /teams/{team_id}/leader`                   | admin                        |
| Add a member                                | `POST /teams/{team_id}/members`                 | admin, or that team's leader |
| Remove a member                             | `DELETE /teams/{team_id}/members/{employee_id}` | admin, or that team's leader |
| Configure the board                         | *not yet built*                                 | admin, or that team's leader |
| Record metric values, problems, tasks       | *not yet built*                                 | admin, or a member of that team |

The split inside membership is deliberate: an admin decides that a team exists and
who runs it, while the routine churn of people joining and leaving a team belongs
to the leader who runs it.

## Reading is not gated on an Employee record

An authenticated employee who is not yet on any team has no `employees` row,
because employees are recorded the first time they are assigned to a team. Such a
user SHALL still be able to read. Only writing requires an Employee record, and a
write by someone without one is refused.

Gating reads on the Employee record instead would mean that on an empty database
nobody can see anything, and that a new hire is locked out of a board whose whole
purpose is to make the work visible across the organization.

## Configuration

The admin list is the only authorization configuration, and it is an environment
variable like every other setting:

```
BMAPP_ADMIN_EMAILS=admin@pse.pl,jane.doe@pse.pl
```

Emails are compared lower-cased and trimmed, the same normalisation employee
emails already use. There is no `authorization.yml`: once leaders are read from
the database, a single list of admins does not justify a file format, a parser and
a decision about whether it is committed.

---

# Open decisions

**The audience value.** Issuer, audience, signature and expiry are all validated,
and a token naming another audience is refused — that is what stops a token issued
to another client of the same IdentityServer being replayed here. What is still
open is the *value* to expect, which depends on how IT registers the client:
brokers differ on whether an API's audience is the client id, a named API
resource, or the custom scope. `BMAPP_OIDC_AUDIENCE` sets it, and defaults to the
client id. Settle it by reading an issued token once registration exists.
