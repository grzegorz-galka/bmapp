## ADDED Requirements

### Requirement: The recording view has its own address

The system SHALL keep in the board's address whether the recording view of the meeting shown is open, so that it can be opened directly and survives a reload. An address asking for the recording view of a meeting that cannot be edited SHALL open it read-only, as the recording view does for such a meeting.

#### Scenario: The recording view is opened from its address

- **WHEN** a member opens the address of a team's board naming next Wednesday's meeting and the recording view
- **THEN** the board is displayed on next Wednesday's meeting with the recording view open, ready for values

#### Scenario: The recording view survives a reload

- **WHEN** a member opens the recording view on the board and the address is reloaded
- **THEN** the board opens again on the same meeting with the recording view open

#### Scenario: Closing the recording view updates the address

- **WHEN** a member leaves the recording view for the tiles
- **THEN** the address no longer asks for the recording view
