## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Development mode signs in through a login window

In development mode, the interface SHALL sign a person in through a login window
asking for an email and a password. The window SHALL open when the page loads with
no session, when the person signs out, and when the person chooses to sign in.
Closing it SHALL leave them signed out. It SHALL be pre-filled with the email last
signed in with, and SHALL NOT remember a password. A refusal SHALL be shown in the
active language.

#### Scenario: The window opens on a page with no session

- **WHEN** the application loads in development mode and nobody is signed in
- **THEN** the login window is shown, asking for an email and a password

#### Scenario: The window opens after signing out

- **WHEN** a person signed in through the window signs out
- **THEN** the login window is shown again, with their email filled in and the
  password empty, over the signed-out panel

#### Scenario: Signing in through the window

- **WHEN** a person enters a recorded employee's email and its development password in
  the login window and confirms
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
