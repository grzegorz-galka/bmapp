## MODIFIED Requirements

### Requirement: The global metrics page

The system SHALL present the catalogue of global metrics on its own page, reachable from the application header, listing each with its unit, direction, threshold in force today, retirement and the number of boards including it, and its threshold history on request. No form for a new global metric SHALL be shown on the page itself: "Add global metric" SHALL open it in a dialog over the page. All text SHALL be in the active language.

#### Scenario: The catalogue is shown

- **WHEN** the global metrics page is opened
- **THEN** every global metric is listed with its unit, direction, threshold in force today, whether it is retired and how many boards include it

#### Scenario: The add form is hidden until asked for

- **WHEN** an administrator opens the global metrics page
- **THEN** an "Add global metric" button is shown, and no field for a new global metric is shown on the page

#### Scenario: A global metric is added from the dialog

- **WHEN** the administrator chooses "Add global metric", fills in the definition in the dialog and submits it
- **THEN** the dialog closes and the new metric is listed in the catalogue

#### Scenario: A rejection keeps the dialog open

- **WHEN** adding a global metric is rejected with `metric_name.duplicate`
- **THEN** the dialog stays open, showing the reason next to the name and keeping what was typed
