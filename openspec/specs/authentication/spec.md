## Purpose

Establishes who is making a request. Delegates the proving of identity to the
organization's identity broker, accepts the token that results as the only
evidence of identity, and resolves it to the employee BMAPP knows by email. Every
other capability that needs to know who is acting asks this one.

## Requirements

### Requirement: A person signs in through the identity broker

The system SHALL delegate authentication to the organization's identity broker and,
outside development mode, SHALL NOT collect a password of its own. The interface
SHALL start the sign-in by sending the person to the broker, SHALL prove on return
that the response belongs to the request it started, and SHALL exchange the result
for an access token without ever holding a client secret.

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
same person back in. After signing out, the page SHALL give way to the signed-out
panel rather than remain on screen.

#### Scenario: Signing out discards the session

- **WHEN** a signed-in person signs out
- **THEN** the tokens are discarded, the session is ended at the broker, and the
  interface shows them as signed out, with the signed-out panel in place of the page

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
  their session ended, in the signed-out panel that takes the page's place, and is
  offered the sign-in

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
authenticated as: their email, whether they are an administrator, their stored
name and surname (each possibly none), and their display name as the
`team-membership` capability defines it, with its initials. An unauthenticated caller SHALL be
refused as any other unauthenticated request is.

The interface needs this because whether someone is an administrator cannot be
derived from anything else it receives.

#### Scenario: The current user is returned

- **WHEN** an authenticated person asks who they are
- **THEN** their email, whether they are an administrator, their name, their surname,
  their display name and its initials are returned

#### Scenario: A person with no stored name is returned with a derived display name

- **WHEN** `jan.kowalski@example.com`, a recorded employee with no name and no surname
  stored, signed in with a token that carries no name claims, asks who they are
- **THEN** the name and surname are returned as none and the display name as
  "Jan Kowalski"

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

A local token SHALL be issued only for an email and that email's development
password, and only to a recorded employee or an administrator. The development
password is the one the person has chosen or, until they choose one, the one
derived from their email; a token SHALL NOT be issued for the derived one.

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

- **WHEN** development mode is on and a token is requested for the email of a recorded
  employee together with the password that employee has chosen
- **THEN** a token is returned that the system accepts, and the request that carries it
  proceeds as that employee

#### Scenario: The local means does not exist when the mode is off

- **WHEN** development mode is off and a local token is requested, or a development
  password is set
- **THEN** no token is issued, nothing is stored, and the request is refused as
  addressing nothing

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

### Requirement: The development password is derived from the email

In development mode, until a person has chosen a password, the password for an
email SHALL be the first two characters of each run of letters and digits in it,
in order, taken from the email trimmed and lower-cased; a run of one character
contributes that one character, and characters that are neither letters nor digits
contribute nothing. The derived password SHALL be accepted only as the current
password of a first sign-in, which issues no token and asks for a new password. A
sign-in SHALL be refused with HTTP 401 and the code `auth.password_incorrect` when
the password given is not exactly the email's current development password.

#### Scenario: Dots and the at-sign split the email

- **WHEN** a sign-in is requested for `grzegorz.galka@pse.pl` with the password
  `grgapspl`, or for `admin@company.com` with the password `adcoco`, each email
  belonging to a recorded employee who has not chosen a password
- **THEN** the password is accepted, no token is issued, and a new password is asked for

#### Scenario: The administrator's password

- **WHEN** a sign-in is requested for `admin@example.com`, an administrator who has not
  chosen a password, with the password `adexco`
- **THEN** the password is accepted, no token is issued, and a new password is asked for

#### Scenario: Any character that is not a letter or digit splits the email

- **WHEN** a sign-in is requested for `jan_k-x@a.pl`, a recorded employee who has not
  chosen a password, with the password `jakxapl`
- **THEN** the password is accepted and a new password is asked for

#### Scenario: A run of separators counts once

- **WHEN** a sign-in is requested for `a..b@c.pl`, a recorded employee who has not
  chosen a password, with the password `abcpl`
- **THEN** the password is accepted and a new password is asked for

#### Scenario: The password follows the normalised email

- **WHEN** a sign-in is requested for `  Grzegorz.Galka@PSE.pl `, a recorded employee
  who has not chosen a password, with the password `grgapspl`
- **THEN** the password is accepted for `grzegorz.galka@pse.pl` and a new password is
  asked for

#### Scenario: A wrong password is refused

- **WHEN** a sign-in is requested for a recorded employee who has not chosen a password,
  with any password other than the one derived from their email, including the right
  letters in upper case
- **THEN** no token is issued and the request is refused with HTTP 401 and the code
  `auth.password_incorrect` on the field `password`

#### Scenario: The one-letter password of the earlier rule is refused

- **WHEN** a sign-in is requested for `grzegorz.galka@pse.pl`, a recorded employee who
  has not chosen a password, with the password `ggpp`
- **THEN** no token is issued and the request is refused with HTTP 401 and the code
  `auth.password_incorrect` on the field `password`

### Requirement: Only an employee or an administrator signs in in development mode

A local token SHALL be issued, and a development password set, only for the email
of a recorded employee or an email the system is configured to treat as an
administrator's. Any other email SHALL be refused with HTTP 401 and the code
`auth.employee_unknown`, even with the right password. Neither signing in nor
setting a password SHALL create an employee record.

#### Scenario: An administrator who is not an employee signs in

- **WHEN** a local token is requested with the password they have chosen for a
  configured administrator's email that matches no recorded employee
- **THEN** a token is issued, and the request that carries it proceeds as an
  administrator

#### Scenario: An unknown email is refused

- **WHEN** a sign-in is requested with the right derived password for an email that is
  neither a recorded employee's nor an administrator's
- **THEN** no token is issued, the request is refused with HTTP 401 and the code
  `auth.employee_unknown` on the field `email`, and no employee record is created

### Requirement: Development mode signs in through a login window

In development mode, the interface SHALL sign a person in through a login window
asking for an email and a password. The window SHALL open when the page loads with
no session, when the person signs out, and when the person chooses to sign in.
Closing it SHALL leave them signed out. It SHALL be pre-filled with the email last
signed in with, and SHALL NOT remember a password. A refusal SHALL be shown in the
active language. The window SHALL NOT state how the password is derived from the
email.

#### Scenario: The window opens on a page with no session

- **WHEN** the application loads in development mode and nobody is signed in
- **THEN** the login window is shown, asking for an email and a password

#### Scenario: The window does not say how the password is derived

- **WHEN** the login window is shown, in either language, at either of its steps
- **THEN** it shows its title, its fields and its actions, and no text describing the
  password rule or giving an example password

#### Scenario: The window opens after signing out

- **WHEN** a person signed in through the window signs out
- **THEN** the login window is shown again, with their email filled in and the
  password empty, over the signed-out panel

#### Scenario: Signing in through the window

- **WHEN** a person enters a recorded employee's email and the password that employee
  has chosen in the login window and confirms
- **THEN** the window closes, the header shows them as signed in, and the page they
  were on loads its data as them

#### Scenario: A refusal is shown in the window

- **WHEN** a person confirms the login window with a wrong password or an email that
  belongs to no employee
- **THEN** they remain signed out, the window stays open, and the reason is shown in the
  active language beside the field it concerns

#### Scenario: Closing the window leaves the person signed out

- **WHEN** a person closes the login window without signing in
- **THEN** they are signed out, and the header offers the sign-in, which opens the window
  again

#### Scenario: A reload asks again, with the email remembered

- **WHEN** a person who signed in through the window reloads the page
- **THEN** the login window is shown with their email filled in and the password empty

### Requirement: No page content is shown without a session

When nobody is signed in, whether after signing out or because the session ended, the interface SHALL show, in place of the page, a panel saying the person is signed out, with an action that starts the sign-in, and SHALL show nothing of the page and request nothing for it. When the session ended on its own, the panel SHALL say so. The header and the sign-in return SHALL still work. Signing in again SHALL show the page the person was on.

#### Scenario: Signing out replaces the page with the panel

- **WHEN** a signed-in person viewing a team's board signs out
- **THEN** the board is no longer shown, a panel says they are signed out and offers the sign-in, and nothing on the page says it is loading

#### Scenario: An ended session replaces the page with the panel

- **WHEN** renewing the session fails while a person is viewing a page
- **THEN** the page is no longer shown and the panel says, in the active language, that their session ended and offers the sign-in

#### Scenario: Signing in from the panel returns to the page

- **WHEN** a person signed out on a team's board signs in again
- **THEN** the panel is gone and that board is shown, its data loaded as them

#### Scenario: The panel reads in Polish

- **WHEN** the active language is Polish and nobody is signed in
- **THEN** the panel's text and its sign-in action come from the Polish catalogue

### Requirement: A first sign-in in development mode sets a password

A sign-in with the derived password SHALL issue no token. It SHALL say that a new
password must be chosen, and SHALL carry the name and surname proposed for the
person: their display name's parts if they are a recorded employee, none for an
administrator with no record. Setting the password SHALL take the email, the
current password, the new password, a name and a surname. It SHALL store the
password, store the name and surname on the employee, and return a token.

#### Scenario: The first sign-in asks for a new password

- **WHEN** `jan.kowalski@example.com`, a recorded employee with no name stored who has
  not chosen a password, signs in with `jakoexco`
- **THEN** no token is returned, the response says a new password must be chosen, and it
  proposes the name "Jan" and the surname "Kowalski"

#### Scenario: Setting the password signs the person in

- **WHEN** that employee sets the new password `zielony-las` with the current password
  `jakoexco`, the name "Jan" and the surname "Kowalski-Nowak"
- **THEN** a token is returned that the system accepts as that employee, and the
  employee's stored name and surname are "Jan" and "Kowalski-Nowak"

#### Scenario: An administrator with no record sets only a password

- **WHEN** `admin@example.com`, an administrator with no employee record who has not
  chosen a password, signs in with `adexco` and then sets a new password
- **THEN** the first response proposes no name and no surname, the new password is
  stored, a token is returned, and no employee record is created

#### Scenario: A blank name is stored as none

- **WHEN** a recorded employee sets their first password with a name and a surname that
  are empty or whitespace
- **THEN** no name and no surname are stored, and their display name is derived from
  their email

#### Scenario: Setting the password needs the current one

- **WHEN** a password is set for an email with a current password that is not that
  email's current development password
- **THEN** nothing is stored, no token is returned, and the request is refused with
  HTTP 401 and the code `auth.password_incorrect` on the field `password`

### Requirement: A chosen development password meets minimum rules

A new development password SHALL be at least 8 characters long and SHALL differ from
the password derived from the email. A shorter one SHALL be refused with HTTP 422 and
the code `dev_password.too_short`, and one equal to the derived password with the
code `dev_password.unchanged`, each on the field `new_password`. A name or surname
over 100 characters once trimmed SHALL be refused with the code
`employee_name.too_long` on the field it came in.

#### Scenario: A short password is refused

- **WHEN** a recorded employee sets their first password to `kot`
- **THEN** nothing is stored and the request is refused with the code
  `dev_password.too_short` on the field `new_password`

#### Scenario: Keeping the derived password is refused

- **WHEN** `grzegorz.galka@pse.pl` sets their first password to `grgapspl`
- **THEN** nothing is stored and the request is refused with the code
  `dev_password.unchanged` on the field `new_password`

#### Scenario: An overlong name is refused

- **WHEN** a recorded employee sets their first password with a surname of 101
  characters
- **THEN** nothing is stored and the request is refused with the code
  `employee_name.too_long` on the field `surname`

### Requirement: A chosen development password replaces the derived one

Once a person has chosen a development password, a sign-in SHALL issue a token for
that password and SHALL refuse the derived one with HTTP 401 and the code
`auth.password_incorrect`. Removing the stored password SHALL make the derived one
the current password again, with a new password asked for at the next sign-in.

#### Scenario: The derived password no longer signs in

- **WHEN** `grzegorz.galka@pse.pl`, who has chosen a password, signs in with `grgapspl`
- **THEN** no token is issued and the request is refused with the code
  `auth.password_incorrect` on the field `password`

#### Scenario: The chosen password signs in

- **WHEN** that employee signs in with the password they chose
- **THEN** a token is returned and no new password is asked for

#### Scenario: Removing the stored password restores the derived one

- **WHEN** the stored password of `grzegorz.galka@pse.pl` is removed and they sign in
  with `grgapspl`
- **THEN** the password is accepted, no token is issued, and a new password is asked for

### Requirement: Development passwords are kept only as salted hashes

The system SHALL store a chosen development password only as a salted, deliberately
slow hash, and SHALL NOT store, log or return the password itself. The stored record
SHALL be keyed by the normalised email, so that it exists for an administrator with
no employee record.

#### Scenario: The stored record does not reveal the password

- **WHEN** a person sets the development password `zielony-las`
- **THEN** the stored record does not contain `zielony-las`, two people choosing the
  same password get different stored values, and no log entry contains it

### Requirement: The first sign-in window sets the password, name and surname

When a first sign-in asks for a new password, the login window SHALL show the email
as fixed, a name and a surname filled in with the proposed ones, and a new password
asked for twice. It SHALL omit the name and surname when none are proposed and
refuse unequal passwords before sending. Confirming SHALL sign the person in;
closing SHALL leave them signed out with nothing stored.

#### Scenario: The window asks for a password, name and surname

- **WHEN** `jan.kowalski@example.com`, a recorded employee who has not chosen a
  password, signs in through the window with `jakoexco`
- **THEN** the window shows the email as fixed, the name "Jan" and the surname
  "Kowalski" ready to edit, and two empty new password fields

#### Scenario: Setting the password in the window signs the person in

- **WHEN** that employee corrects the surname, enters a valid new password twice and
  confirms
- **THEN** the window closes, the header shows them signed in under the corrected name,
  and the page loads its data as them

#### Scenario: Unequal passwords are refused in the window

- **WHEN** the two new password fields differ and the person confirms
- **THEN** nothing is sent, the window stays open, and it says in the active language
  that the passwords do not match

#### Scenario: An administrator with no record is asked only for a password

- **WHEN** an administrator with no employee record signs in for the first time through
  the window
- **THEN** the window asks for the new password twice and shows no name or surname field

#### Scenario: Closing the window at the new password step stores nothing

- **WHEN** a person closes the window while it asks for a new password
- **THEN** they are signed out, no password is stored, and their next sign-in asks for a
  new password again

### Requirement: The broker's name claims are kept on the employee

Outside development mode, when a recorded employee asks who they are, the system
SHALL store the token's `given_name` and `family_name` claims as their name and
surname if either differs from what is stored. A claim that is absent or blank SHALL
leave the stored value unchanged. No employee record SHALL be created this way.

#### Scenario: Name claims are stored

- **WHEN** `grzegorz.galka@pse.pl`, a recorded employee with no name stored, asks who
  they are with a broker token carrying `given_name` "Grzegorz" and `family_name`
  "Gałka"
- **THEN** their stored name and surname become "Grzegorz" and "Gałka", and the display
  name returned is "Grzegorz Gałka"

#### Scenario: A token without name claims changes nothing

- **WHEN** a recorded employee whose name is stored asks who they are with a broker
  token carrying no name claims
- **THEN** their stored name and surname are unchanged

#### Scenario: A person who is not an employee is not recorded

- **WHEN** a person whose email matches no employee asks who they are with a broker
  token carrying name claims
- **THEN** no employee record is created, and the display name returned comes from the
  claims
