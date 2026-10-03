## 1. Configuration and dependencies

- [x] 1.1 Add `pyjwt[crypto]` to the backend dependencies with `uv add` and verify `uv sync` succeeds and `python -c "import jwt; jwt.PyJWKClient"` runs in the backend container
- [x] 1.2 Add `oidc-client-ts` to the frontend dependencies and verify the dev server resolves the import after `docker compose up -d --build --renew-anon-volumes frontend`, as `CLAUDE.md` requires for a dependency change
- [x] 1.3 Extend `app/core/config.py` with `mode`, `oidc_issuer`, `oidc_client_id`, `oidc_audience` and `admin_emails`, parsing the admin list into a lower-cased, trimmed frozenset, and verify unit tests cover an empty list, surrounding whitespace and mixed case
- [x] 1.4 Add the new settings to `.env.example` with comments, set `BMAPP_MODE=dev` on the backend service in `docker-compose.yml`, and verify `docker compose config` shows it

## 2. Token validation

- [x] 2.1 Add `UnauthenticatedError` and `ForbiddenError` to `app/core/exceptions.py` carrying 401 and 403 and the `auth.*` codes, and verify a unit test asserts each code and status without going through HTTP
- [x] 2.2 Implement broker-mode validation in `app/core/security.py` using `PyJWKClient`, passing `algorithms=["RS256"]`, `issuer` and `audience` explicitly, and verify unit tests against locally generated RSA keys cover the valid case and the expired case
- [x] 2.3 Verify the refusal scenarios with unit tests named for them: a bad signature, a wrong issuer and a wrong audience each raise `auth.token_invalid`, and a token with no email claim raises it too
- [x] 2.4 Verify a unit test asserts broker mode rejects an HS256-signed token on the algorithm, which is the guarantee that a dev token cannot work against a deployed server
- [x] 2.5 Verify an integration test asserts a request with no `Authorization` header is refused with 401 and `auth.token_missing`, in the shared `{field, code, message}` body

## 3. Development mode

- [x] 3.1 Generate the per-process HS256 dev secret at startup and select the algorithm set from `BMAPP_MODE`, and verify a unit test asserts the two algorithm sets never overlap
- [x] 3.2 Add `POST /auth/dev-login` in a new `app/api/auth.py`, taking an email and no password, registered only when the mode is dev, and verify an integration test signs in and uses the returned token successfully
- [x] 3.3 Verify an integration test asserts the route does not exist in broker mode, returning 404 rather than a refusal
- [x] 3.4 Refuse to start when dev mode is combined with a configured identity broker, naming the reason, and verify a unit test asserts the refusal and that dev mode with no broker configured starts
- [x] 3.5 Verify an integration test asserts a broker-mode server refuses a dev-minted token with 401 and `auth.token_invalid`

## 4. Current user

- [x] 4.1 Implement the current-user dependency: decode the token, take the email claim lower-cased and trimmed, and look up the employee without creating one, and verify unit tests cover a match in different letter case and a non-match
- [x] 4.2 Verify a unit test asserts no employee record is created when the email matches none, by counting employees before and after
- [x] 4.3 Add `GET /auth/me` returning the email and whether the caller is an administrator, and verify integration tests cover an administrator, a non-administrator and an unauthenticated caller refused with `auth.token_missing`

## 5. Authorization rules

- [x] 5.1 Implement `app/services/authz.py` as pure functions over `(is_admin, membership)` with no session and no HTTP, one per row of the permission table in `SECURITY.md`, and verify unit tests cover every row
- [x] 5.2 Verify unit tests assert a leader of one team is refused the leader-only actions on a team they do not lead, and permitted them on the team they lead
- [x] 5.3 Verify a unit test asserts an empty administrator list refuses every write requiring an administrator rather than permitting them
- [x] 5.4 Verify a unit test asserts an administrator who matches no employee record is still an administrator, so the first team can be registered on an empty database
- [x] 5.5 Log the number of configured administrators at startup without logging the addresses, and verify the log line appears and contains no email

## 6. Guards on the existing endpoints

- [x] 6.1 Add the dependency that loads the path team's membership for the current user and applies a rule, raising `ForbiddenError`, and verify it raises `auth.not_an_employee` when the caller has no employee record
- [x] 6.2 Guard `POST /teams` to administrators and verify integration tests cover an administrator succeeding and a non-administrator refused with 403 and `auth.forbidden`, creating no team, board, employee or membership
- [x] 6.3 Guard `PUT /teams/{team_id}/leader` to administrators and verify integration tests cover an administrator succeeding and the team's own leader refused with the leadership unchanged
- [x] 6.4 Guard `POST /teams/{team_id}/members` and `DELETE /teams/{team_id}/members/{employee_id}` to the team's leader and administrators, and verify integration tests cover the leader, an administrator, an ordinary member refused, and a non-member refused
- [x] 6.5 Verify integration tests assert every `GET` under `/teams` succeeds for an authenticated caller who belongs to no team and for one who matches no employee record

## 7. The hub

- [x] 7.1 Remove `_CURRENT_USER` from `app/services/hub.py` and take the identity from the authenticated caller, leaving the rest of the placeholder data and the `provisional` marker untouched, and verify the existing placeholder tests still pass
- [x] 7.2 Require authentication on `GET /hub` and verify integration tests replace the withdrawn "needs no authentication" test: no credentials is refused with 401 and `auth.token_missing`
- [x] 7.3 Verify an integration test asserts two callers authenticated as different people each receive their own identity from the same request
- [x] 7.4 Delete the tests of the two withdrawn hub requirements and verify the suite names a test for each scenario of the two replacements, as `CLAUDE.md` requires

## 8. Frontend authentication

- [x] 8.1 Add `src/features/auth/` wiring `oidc-client-ts` with an explicit in-memory store, and verify a Vitest test asserts nothing is written to `sessionStorage` or `localStorage` after a simulated sign-in
- [x] 8.2 Add the callback route to `routes.tsx` and the sign-in entry point, and verify tests cover a successful return and a response that does not match the request it started
- [x] 8.3 Attach the bearer header in `src/api/client.ts` and verify a test asserts the header is present on an authenticated request and absent when signed out
- [x] 8.4 Handle 401 by re-authenticating rather than rendering a field error, retrying once after a successful silent renew then signing out, and verify a test asserts exactly one retry and no loop
- [x] 8.5 Implement silent renew and the signed-out state when it fails, and verify tests cover the renewed request succeeding and the failure being reported in the active language
- [x] 8.6 Implement the silent sign-in on startup against the broker session, and verify a test asserts a reload restores the session without interaction and that failure leaves the person signed out
- [x] 8.7 Add the header account control with sign-out that discards the tokens and ends the session at the broker, and verify tests cover the control appearing when signed in and no identity being shown when signed out

## 9. Permission-aware interface

- [x] 9.1 Read `GET /auth/me` through TanStack Query and expose the current user and administrator flag, and verify a test asserts the flag is not derived from any other payload
- [x] 9.2 Offer the add, remove and hand-over controls on the members page only to a viewer permitted each, and verify tests cover a leader, an ordinary member, and an administrator
- [x] 9.3 Offer the team registration control only to an administrator, and verify a test asserts a non-administrator sees the registered teams and no registration control
- [x] 9.4 Verify a test asserts a viewer permitted nothing still sees the page and everything it reads

## 10. Localization

- [x] 10.1 Add `auth.token_missing`, `auth.token_expired`, `auth.token_invalid`, `auth.forbidden` and `auth.not_an_employee` to `en.ts` and `pl.ts`, plus the sign-in, sign-out, session-ended and account-control strings, and verify `npm run typecheck` passes, which is what catches a key present in one catalogue only
- [x] 10.2 Verify a test asserts a refusal carrying an `auth.` code is rendered from the catalogue of the active language in both English and Polish, with no literal in a component

## 11. End to end

- [x] 11.1 Sign the Playwright suite in through dev mode and verify the existing specs pass against the guarded endpoints
- [x] 11.2 Add an e2e spec covering sign-in, the identity in the header, and sign-out, and verify it passes
- [x] 11.3 Add an e2e spec asserting a non-administrator is not offered team registration and a leader is offered membership management, and verify it passes

## 12. Finish

- [x] 12.1 Run `uv run ruff check . && uv run ruff format --check . && uv run mypy app` and `npm run lint && npm run typecheck`, and verify all are clean
- [x] 12.2 Run `uv run pytest --cov=app --cov-report=term-missing` and verify coverage has not dropped below 85%
- [x] 12.3 Bring the stack up with `docker compose up -d`, sign in through dev mode, and verify the hub, the team page and the members page work end to end as the Definition of Done requires
- [ ] 12.4 Record the audience claim and value once IT has registered the client, resolving the open question in `design.md`, and verify the configured audience refuses a token minted for another client
      *(Blocked, not skipped: the refusal is implemented and tested — `test_the_token_was_minted_for_another_application` and `test_the_configured_audience_overrides_the_client_id`. Only the expected value is outstanding, and it cannot be known until IT registers the client.)*
- [x] 12.5 Update `README.md` with how to sign in locally, and verify `CLAUDE.md` and `SECURITY.md` still match what was built, correcting them in this change if not
