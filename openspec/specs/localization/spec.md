## Purpose

Governs which language the web interface is displayed in, how a user changes it, and what must be translated. BMAPP is used by teams that hold their board meetings in Polish and by teams that hold them in English, so the same board has to read naturally in either language without a separate deployment.

## Requirements

### Requirement: The interface is available in English and Polish

The system SHALL display every user-facing string of the web interface in the active language. The supported languages SHALL be English and Polish. A string is user-facing if a person can read it in the running application, which includes headings, labels, placeholders, button captions, loading and empty states, error and status messages, and text exposed only to assistive technology such as `aria-label` and `alt`.

Every user-facing string SHALL be present in both the English and the Polish catalogue. A string present in one catalogue and absent from the other SHALL be reported as a failure rather than displayed in the other language or as its own key.

#### Scenario: The interface renders in English

- **WHEN** the active language is English
- **THEN** every user-facing string on the page is the English text for that string, and no message key or untranslated placeholder is shown

#### Scenario: The interface renders in Polish

- **WHEN** the active language is Polish
- **THEN** every user-facing string on the page is the Polish text for that string, and no English text and no message key is shown

#### Scenario: A language is missing a translation

- **WHEN** the message catalogues are compared and a string defined for one language has no counterpart in the other
- **THEN** the comparison fails and names every key that is missing and the language missing it

### Requirement: The initial language follows the browser

The system SHALL choose the language for a first-time visitor from the languages the browser reports as preferred, taking the first of those that is supported. Polish SHALL be selected when the browser prefers Polish in any regional variant. English SHALL be selected when no preferred language is supported, when the browser reports no preference, and when the browser's preferences are unavailable.

#### Scenario: The browser prefers Polish

- **WHEN** a visitor with no remembered choice opens the application and the browser's first supported preferred language is Polish, in any regional variant
- **THEN** the interface is displayed in Polish

#### Scenario: The browser prefers an unsupported language

- **WHEN** a visitor with no remembered choice opens the application and the browser prefers only languages the application does not support
- **THEN** the interface is displayed in English

#### Scenario: The browser reports no preference

- **WHEN** a visitor with no remembered choice opens the application and the browser reports no preferred languages
- **THEN** the interface is displayed in English

### Requirement: A user can change the language

The system SHALL present a language toggle on every page. It is a single control that switches the interface between its two supported languages, English and Polish, in one action. The toggle SHALL be captioned with the language it would switch to: a flag for that language, followed by the language's name written in that language. The Union Flag stands for English and the Polish flag for Polish. The flag SHALL be decorative and SHALL never be the only indication of the language. The toggle's accessible name SHALL say, in the active language, which language it switches to. It SHALL also expose, to assistive technology and as a tooltip, which language is currently active. Switching SHALL take effect immediately, across the whole interface, without reloading the page and without losing the data already loaded or the text already typed into a form.

#### Scenario: The toggle offers Polish while the interface is in English

- **WHEN** the interface is displayed in English
- **THEN** the language toggle shows the Polish flag and the caption "Polski", its accessible name says it switches to Polish, and it reports English as the active language

#### Scenario: The toggle offers English while the interface is in Polish

- **WHEN** the interface is displayed in Polish
- **THEN** the language toggle shows the Union Flag and the caption "English", its accessible name, in Polish, says it switches to English, and it reports Polish as the active language

#### Scenario: The user switches to Polish

- **WHEN** the interface is displayed in English and the user activates the language toggle
- **THEN** every user-facing string on the page is redisplayed in Polish without a page reload, and the toggle now offers English

#### Scenario: The user switches back to English

- **WHEN** the interface is displayed in Polish and the user activates the language toggle
- **THEN** every user-facing string on the page is redisplayed in English without a page reload, and the toggle now offers Polish

#### Scenario: The toggle works from the keyboard

- **WHEN** the language toggle has keyboard focus and the user presses Enter or Space
- **THEN** the language switches exactly as it does on a click

#### Scenario: The flag is not the only cue

- **WHEN** the language toggle is read by assistive technology, or its image fails to render
- **THEN** the flag is not announced, and the language name and the accessible name still identify the language the toggle switches to

#### Scenario: Work in progress survives a language change

- **WHEN** the user has typed into a form field, or a list has been loaded, and the language is then changed
- **THEN** the typed text and the loaded list are still present, and only the surrounding text has changed language

### Requirement: The chosen language is remembered

The system SHALL remember a language the user chose explicitly and SHALL apply it on the user's later visits in preference to the browser's preferences. A remembered value that names an unsupported language, or that cannot be read back, SHALL be ignored and the language determined as it is for a first-time visitor.

#### Scenario: A remembered choice is applied on a later visit

- **WHEN** a user who chose Polish opens the application again
- **THEN** the interface is displayed in Polish, whatever the browser's preferred languages are

#### Scenario: A remembered choice overrides the browser preference

- **WHEN** a user whose browser prefers Polish has explicitly chosen English and opens the application again
- **THEN** the interface is displayed in English

#### Scenario: An unusable remembered value is ignored

- **WHEN** the remembered language names a language the application does not support, or cannot be read back
- **THEN** the language is determined from the browser's preferences as it is for a first-time visitor, and the application starts normally rather than failing

### Requirement: The document reports the active language

The system SHALL set the document's language attribute to the active language, and SHALL update it whenever the active language changes, so that assistive technology and browser translation use the correct language.

#### Scenario: The document language matches the interface

- **WHEN** the interface is displayed in a supported language
- **THEN** the document's language attribute is that language's code

#### Scenario: The document language follows a change

- **WHEN** the user changes the language
- **THEN** the document's language attribute changes to the newly active language's code

### Requirement: Errors reported by the API are displayed in the active language

The system SHALL display an error returned by the API in the active language. Each field error returned by the API carries a stable code identifying the reason for the failure; the interface SHALL display the message its own catalogue holds for that code, and SHALL NOT display the developer-facing English text the API includes alongside the code.

When a field error carries a code the catalogue does not know, or carries no code at all, the interface SHALL display a generic message in the active language rather than untranslated text, and SHALL still attribute the error to the field the API named.

#### Scenario: A known error code is shown in Polish

- **WHEN** the interface is displayed in Polish and the API rejects a submission with a field error whose code the catalogue knows
- **THEN** the Polish message for that code is displayed against the field the API named, and the API's own English text is not displayed

#### Scenario: The same error is shown in English

- **WHEN** the interface is displayed in English and the API rejects a submission with the same field error
- **THEN** the English message for that code is displayed against the field the API named

#### Scenario: An unknown error code falls back to a generic message

- **WHEN** the API rejects a submission with a field error whose code the catalogue does not know, or with no code
- **THEN** a generic failure message in the active language is displayed against the field the API named, and no untranslated text is shown to the user

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
