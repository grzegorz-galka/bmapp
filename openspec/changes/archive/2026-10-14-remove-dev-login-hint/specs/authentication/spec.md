# Spec Delta

## MODIFIED Requirements

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

- **WHEN** the login window is shown, in either language
- **THEN** it shows its title, the email and password fields and its actions, and no
  text describing the password rule or giving an example password

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
