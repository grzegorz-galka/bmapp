## MODIFIED Requirements

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
