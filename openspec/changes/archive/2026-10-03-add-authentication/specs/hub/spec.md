## REMOVED Requirements

### Requirement: The hub is supplied by a single read-only summary

**Reason**: The requirement obliged the hub summary to succeed without the caller
being authenticated, and obliged its identity to be a fixed placeholder. Both are
reversed by this change, so the requirement is withdrawn rather than amended: a
scenario asserting that the summary needs no credentials cannot survive alongside
one asserting that it is refused without them.

**Migration**: Replaced by *The hub is supplied by a single authenticated summary*,
which keeps every other rule unchanged — the one read-only request, the prose in
both languages, the stable codes, the ISO 8601 instants and dates, and the
provisional marker. Callers must now present a token, and receive the identity of
the person that token names rather than a fixed one.

### Requirement: The hub identifies the current user

**Reason**: The requirement obliged the interface to present no sign-in, no sign-out
and no account control, and obliged the identity to be a fixed placeholder until
authentication was built. Authentication is what this change builds.

**Migration**: Replaced by *The hub identifies the signed-in person*. The email
still comes from the hub summary and still heads the list of assigned items; it is
now the authenticated person's, and the header now carries the account control the
withdrawn requirement forbade.

## ADDED Requirements

### Requirement: The hub is supplied by a single authenticated summary

The system SHALL supply everything the hub displays as data through one read-only
request. That request SHALL NOT modify anything and SHALL require the caller to be
authenticated, being refused as the `authentication` capability requires when it is
not. Its response SHALL carry: the current user's identity, the company
declarations, the current user's teams, the preparation counts, whether a meeting is
in session, the funnel figures and their scope, and the items assigned to the
current user.

The response SHALL follow these rules, so that the interface can present it in either
language and can be changed to the real data later without changing its own code:

- Authored prose published in both languages — the declarations, and the summary of an
  assigned item — SHALL be returned carrying both the English and the Polish text, so
  that changing the language needs no further request.
- Anything naming a state drawn from a fixed set — a user's role on a team, a team's
  board readiness, whether an item is a problem or a task — SHALL be returned as a
  stable code that the interface translates, in the same way it translates the codes
  carried by field errors. A code SHALL NOT change once published.
- Any point in time SHALL be returned as an ISO 8601 instant in UTC. Any date without a
  time SHALL be returned as an ISO 8601 calendar date. No text formatted for display
  SHALL be returned in place of either.

The identity the summary carries SHALL be the authenticated caller's, so that two
people signed in as different employees receive different identities from the same
request. While the hub summary is placeholder data, its declarations, counts and items
are fixed rather than recorded anywhere, and the response SHALL declare itself
provisional so that no caller mistakes it for recorded data.

#### Scenario: The summary is returned

- **WHEN** the hub summary is requested by an authenticated caller
- **THEN** it is returned successfully, carrying the current user's identity, the
  declarations, the teams, the preparation counts, the in-session indicator, the funnel
  figures and their scope, and the assigned items

#### Scenario: The summary requires authentication

- **WHEN** the hub summary is requested with no credentials
- **THEN** it is refused with HTTP 401 and the code `auth.token_missing`, and no
  summary is returned

#### Scenario: The identity is the authenticated caller's

- **WHEN** the hub summary is requested by two callers authenticated as different
  people
- **THEN** each response carries the identity of the caller that requested it

#### Scenario: Prose carries both languages

- **WHEN** the hub summary is returned
- **THEN** the mission, the vision, every strategic goal, every value and every
  assigned item's summary each carry both an English and a Polish text, and neither is
  empty

#### Scenario: States are returned as codes

- **WHEN** the hub summary is returned
- **THEN** each team's role and board readiness and each item's kind are stable codes
  drawn from a fixed set, and no text intended for display accompanies them

#### Scenario: Times are returned as ISO 8601 in UTC

- **WHEN** the hub summary is returned
- **THEN** every next-meeting instant is an ISO 8601 instant in UTC and every due date
  is an ISO 8601 calendar date, and neither is formatted for display

#### Scenario: The summary declares itself provisional

- **WHEN** the hub summary is returned
- **THEN** it states that its data is placeholder data rather than recorded data

### Requirement: The hub identifies the signed-in person

The system SHALL display the signed-in person's email address in the application
header and SHALL use it to head the list of items assigned to them. The identity
SHALL come from the hub summary rather than being written into the interface.

The identity SHALL be that of the authenticated person, and the system SHALL present
it as a signed-in session: the header SHALL offer an account control from which that
person can sign out, as the `authentication` capability requires. A person who is not
signed in SHALL be offered the sign-in instead, and SHALL NOT be shown an identity.

#### Scenario: The identity is displayed

- **WHEN** the hub is displayed and the summary has loaded
- **THEN** the signed-in person's email address from the summary is shown in the header
  and heads the list of assigned items

#### Scenario: A session is offered

- **WHEN** any page of the application is displayed to a signed-in person
- **THEN** an account control is offered from which they can sign out

#### Scenario: No identity is shown when signed out

- **WHEN** any page of the application is displayed to a person who is not signed in
- **THEN** no identity is shown and the sign-in is offered
