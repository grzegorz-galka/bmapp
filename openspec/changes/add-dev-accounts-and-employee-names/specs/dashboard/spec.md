## MODIFIED Requirements

### Requirement: The dashboard identifies the signed-in person

The system SHALL display the signed-in person's display name, as the `team-membership` capability defines it, in the application header on every page, taken from the current user the `authentication` capability returns, together with initials made of the first letters of the display name's first two words. The dashboard summary SHALL carry the same display name and initials. It SHALL offer an account control whose menu shows their email and from which they can sign out, as the `authentication` capability requires. A person who is not signed in SHALL be offered the sign-in instead and SHALL NOT be shown an identity.

#### Scenario: The identity is displayed

- **WHEN** the dashboard is displayed and the summary has loaded for `jan.kowalski@example.com`, with nothing stored as a name
- **THEN** "Jan Kowalski" and the initials "JK" are shown in the header, "Jan Kowalski" heads the list of assigned items, and the account control's menu shows `jan.kowalski@example.com`

#### Scenario: Stored names give the initials

- **WHEN** the summary is loaded for a person whose stored name and surname are "Grzegorz" and "Gałka"
- **THEN** the header shows "Grzegorz Gałka" and the initials "GG"

#### Scenario: A session is offered

- **WHEN** any page of the application is displayed to a signed-in person
- **THEN** an account control is offered from which they can sign out

#### Scenario: No identity is shown when signed out

- **WHEN** any page of the application is displayed to a person who is not signed in
- **THEN** no identity is shown and the sign-in is offered

### Requirement: The viewer's own meetings to host are marked

The system SHALL mark, in words, a row of the "My board meetings" tile and of My meetings whose host is the viewer as hosted by them, in place of their own name.

#### Scenario: The host sees their meeting marked

- **WHEN** the viewer is named host of next Wednesday's meeting of their team
- **THEN** that row reads "You host" rather than the viewer's name

#### Scenario: Another member's meeting is not marked

- **WHEN** a meeting's host is another member, whose display name is "Anna Nowak"
- **THEN** the row shows "Anna Nowak" as host and no "You host" mark
