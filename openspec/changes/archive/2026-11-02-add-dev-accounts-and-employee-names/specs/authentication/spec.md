## MODIFIED Requirements

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

## ADDED Requirements

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
