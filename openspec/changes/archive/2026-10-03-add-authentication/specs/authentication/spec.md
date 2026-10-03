## Purpose

Establishes who is making a request. Delegates the proving of identity to the
organization's identity broker, accepts the token that results as the only
evidence of identity, and resolves it to the employee BMAPP knows by email. Every
other capability that needs to know who is acting asks this one.

## ADDED Requirements

### Requirement: A person signs in through the identity broker

The system SHALL delegate authentication to the organization's identity broker and
SHALL NOT collect a password of its own. The interface SHALL start the sign-in by
sending the person to the broker, SHALL prove on return that the response belongs
to the request it started, and SHALL exchange the result for an access token
without ever holding a client secret.

The system SHALL keep the access token only in the memory of the running page. It
SHALL NOT write the access token, the refresh token or any value derived from them
to browser storage that survives the page, so that a script injected into the page
cannot read a token out of storage later.

While a person is signed in, the system SHALL send the access token with every
request it makes to the API.

#### Scenario: A person signs in

- **WHEN** a signed-out person starts the sign-in and authenticates successfully with
  the broker
- **THEN** they are returned to the page they were sent from, the interface shows them
  as signed in, and requests to the API carry their access token

#### Scenario: A returning response that does not match the request is refused

- **WHEN** the interface receives a sign-in response that does not correspond to the
  sign-in it started
- **THEN** no token is obtained, the person remains signed out, and the failure is
  reported in the active language

#### Scenario: Tokens do not outlive the page

- **WHEN** a person is signed in and the page is reloaded
- **THEN** no access or refresh token is read from browser storage

#### Scenario: The person cancels at the broker

- **WHEN** a person starts the sign-in and abandons or is refused it at the broker
- **THEN** they are returned signed out, told so in the active language, and may start
  the sign-in again

### Requirement: A signed-in person can sign out

The system SHALL offer a signed-in person a control that signs them out. Signing
out SHALL discard the tokens held in the page and SHALL end the session at the
identity broker, so that returning to the application does not silently sign the
same person back in.

#### Scenario: Signing out discards the session

- **WHEN** a signed-in person signs out
- **THEN** the tokens are discarded, the session is ended at the broker, and the
  interface shows them as signed out

### Requirement: A session is renewed without interrupting the person

The system SHALL obtain a fresh access token before or upon the expiry of the one
it holds, without the person being asked to authenticate again. When renewal
fails, the system SHALL treat the person as signed out and SHALL say so in the
active language rather than failing silently or retrying indefinitely.

#### Scenario: An expired token is renewed silently

- **WHEN** the access token expires while a person is using the application
- **THEN** a fresh token is obtained without the person being prompted, and the
  request that needed it succeeds

#### Scenario: Renewal fails

- **WHEN** renewing the access token fails
- **THEN** the person is shown as signed out and told in the active language that
  their session ended, and is offered the sign-in

### Requirement: The API accepts only a token it can verify

The system SHALL verify every access token it is given before acting on it. A
token SHALL be accepted only when its signature verifies against a key the
identity broker publishes, when it was issued by that broker, when it names BMAPP
as its intended audience, and when it has not expired.

A request carrying no token, or a token failing any of those checks, SHALL be
refused with HTTP 401 and SHALL carry a stable code naming the reason:
`auth.token_missing` when no token is presented, `auth.token_expired` when the
token has expired, and `auth.token_invalid` for a signature, issuer or audience
that does not hold. A refusal SHALL also carry human-readable English text for a
developer, which clients are not expected to display. The system SHALL NOT reveal
in the response which key, issuer or audience it expected.

Verification SHALL NOT require state held between requests: the token is the only
evidence of identity, and no session is stored on the server.

#### Scenario: A valid token is accepted

- **WHEN** a request carries a token signed by the broker's published key, issued by
  that broker, naming BMAPP as its audience, and not expired
- **THEN** the request proceeds as the person the token identifies

#### Scenario: No token is presented

- **WHEN** a request that requires identity carries no token
- **THEN** it is refused with HTTP 401 and the code `auth.token_missing`

#### Scenario: The token has expired

- **WHEN** a request carries a token whose expiry has passed
- **THEN** it is refused with HTTP 401 and the code `auth.token_expired`

#### Scenario: The signature does not verify

- **WHEN** a request carries a token whose signature does not verify against any key
  the broker publishes
- **THEN** it is refused with HTTP 401 and the code `auth.token_invalid`

#### Scenario: The token was minted for another application

- **WHEN** a request carries a token that verifies and has not expired, but names an
  audience other than BMAPP
- **THEN** it is refused with HTTP 401 and the code `auth.token_invalid`

#### Scenario: The token was issued by another broker

- **WHEN** a request carries a token that verifies against a key of a different issuer
- **THEN** it is refused with HTTP 401 and the code `auth.token_invalid`

### Requirement: The signed-in person is the employee with that email

The system SHALL take the email claim of a verified token as the identity of the
person making the request, compared lower-cased and trimmed, in the same way
employee emails are already recorded.

An employee record SHALL NOT be created as a result of someone signing in. A
person whose email matches no employee is authenticated but is not an employee of
any team; what they may do follows from the `authorization` capability rather than
from this one.

A verified token carrying no email claim SHALL be refused with HTTP 401 and the
code `auth.token_invalid`, because it identifies nobody.

#### Scenario: The email identifies a recorded employee

- **WHEN** a request carries a verified token whose email claim matches a recorded
  employee, in any letter case
- **THEN** that employee is the current user for the request

#### Scenario: The email matches no employee

- **WHEN** a request carries a verified token whose email claim matches no recorded
  employee
- **THEN** the request proceeds as an authenticated person who is not an employee, and
  no employee record is created

#### Scenario: The token carries no email

- **WHEN** a request carries a verified token with no email claim
- **THEN** it is refused with HTTP 401 and the code `auth.token_invalid`

### Requirement: The current user can be read

The system SHALL offer a request that returns the person the caller is
authenticated as: their email, and whether they are an administrator. An
unauthenticated caller SHALL be refused as any other unauthenticated request is.

The interface needs this because whether someone is an administrator cannot be
derived from anything else it receives.

#### Scenario: The current user is returned

- **WHEN** an authenticated person asks who they are
- **THEN** their email and whether they are an administrator are returned

#### Scenario: An unauthenticated caller is refused

- **WHEN** a caller with no token asks who they are
- **THEN** the request is refused with HTTP 401 and the code `auth.token_missing`

### Requirement: Development mode substitutes for the broker

The system SHALL offer a development mode, off unless explicitly switched on, in
which a token of the same shape can be obtained locally without the identity
broker, so that authentication and authorization can be exercised where the broker
is not reachable. A token obtained this way SHALL identify a person by email
exactly as a broker-issued token does, so that every rule built on identity
behaves identically.

Development mode SHALL hold test identities only and SHALL never be the means by
which a real person authenticates.

Being switched off SHALL be the default, and being switched on SHALL be
impossible in a deployed environment rather than merely discouraged: the means of
obtaining a local token SHALL NOT exist when the mode is off, a token obtained in
development mode SHALL NOT be accepted by a system configured against the identity
broker even if that means were somehow reachable, and a system SHALL refuse to
start when development mode is combined with a configured identity broker, since
a deployed environment necessarily configures one.

#### Scenario: A local token is obtained in development mode

- **WHEN** development mode is on and a token is requested for a test identity
- **THEN** a token is returned that the system accepts, and the request that carries it
  proceeds as that identity

#### Scenario: The local means does not exist when the mode is off

- **WHEN** development mode is off and a local token is requested
- **THEN** no token is issued and the request is refused as addressing nothing

#### Scenario: A development token is refused by a broker-backed system

- **WHEN** a system configured against the identity broker receives a token issued by
  development mode
- **THEN** it is refused with HTTP 401 and the code `auth.token_invalid`

#### Scenario: Development mode cannot be switched on alongside a configured broker

- **WHEN** the system is started with development mode on and an identity broker
  configured
- **THEN** it refuses to start and reports why

#### Scenario: Development mode starts with no broker configured

- **WHEN** the system is started with development mode on and no identity broker
  configured
- **THEN** it starts
