## Purpose

Governs which language the web interface is displayed in, how a user changes it, and what must be translated. BMAPP is used by teams that hold their board meetings in Polish and by teams that hold them in English, so the same board has to read naturally in either language without a separate deployment.

## ADDED Requirements

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

The system SHALL present a language control on every page that names the supported languages and identifies which one is active. Choosing a language SHALL take effect immediately, across the whole interface, without reloading the page and without losing the data already loaded or the text already typed into a form.

#### Scenario: The user switches to Polish

- **WHEN** the interface is displayed in English and the user chooses Polish in the language control
- **THEN** every user-facing string on the page is redisplayed in Polish without a page reload, and the control identifies Polish as active

#### Scenario: The user switches back to English

- **WHEN** the interface is displayed in Polish and the user chooses English in the language control
- **THEN** every user-facing string on the page is redisplayed in English without a page reload, and the control identifies English as active

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
