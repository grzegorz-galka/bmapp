## ADDED Requirements

### Requirement: Dates, times and numbers are formatted for the active language

The system SHALL display every date, time and number in the conventions of the active
language. A date SHALL be displayed with its month named in the active language, not as
a numeric pattern that reads as a different date in another locale. A time of day SHALL
be displayed in the convention the active language uses. A weekday name SHALL be
displayed in the active language.

The system SHALL format for display only at the point of display: values are carried
from the API as ISO 8601 dates and instants and as numbers, never as text already
formatted for a particular language, so that changing the language reformats what is
already on screen without a further request to the API.

An instant SHALL be displayed in the time zone of the reader's browser. A duration
counted in whole days, hours or minutes SHALL be labelled with the unit in the active
language.

A value the system cannot interpret as a date, a time or a number SHALL be reported as
unavailable in the active language rather than displayed as raw text or as an error.

#### Scenario: A date is formatted in English

- **WHEN** the active language is English and a date and time is displayed
- **THEN** its weekday and month are named in English and its time of day follows
  English convention

#### Scenario: The same date is formatted in Polish

- **WHEN** the active language is Polish and the same date and time is displayed
- **THEN** its weekday and month are named in Polish and its time of day follows Polish
  convention

#### Scenario: A displayed date follows a language change

- **WHEN** a date is displayed in English and the user changes the language to Polish
- **THEN** the same date is redisplayed with Polish month and weekday names, without a
  further request to the API

#### Scenario: A number is formatted for the active language

- **WHEN** a number is displayed
- **THEN** its grouping and decimal separators are those of the active language

#### Scenario: A duration is labelled in the active language

- **WHEN** a duration in whole days, hours and minutes is displayed
- **THEN** each unit is labelled in the active language

#### Scenario: An uninterpretable value is reported as unavailable

- **WHEN** a value that cannot be interpreted as a date, a time or a number is to be
  displayed
- **THEN** a message in the active language reports it as unavailable, and neither raw
  text nor an error is shown
