# Spec Delta

## MODIFIED Requirements

### Requirement: Employees are identified by email

The system SHALL identify an employee by email address. An email SHALL be stored with leading and trailing whitespace removed and in lower case, and two emails SHALL denote the same employee when they are equal after that normalisation. An email SHALL be at most 254 characters once trimmed, SHALL contain exactly one `@` with at least one character before it, SHALL have a domain after it that contains a `.` that is neither its first nor its last character, and SHALL contain no whitespace.

An employee SHALL be recorded the first time their email is assigned to a team, either as a new team's leader or as an added member, or is named as a project's manager or a product's owner, and SHALL be reused on every later assignment or naming. Being named as a manager or owner SHALL NOT make the employee a member of any team. An employee SHALL NOT be deleted when they leave a team or belong to no team. Each employee SHALL be assigned an identifier that is unique and stable for the life of the record.

The rejection codes are `employee_email.blank` for an email that is empty or whitespace, `employee_email.too_long` for one over the maximum length, and `employee_email.invalid` for one that breaks any other rule above. The offending field is whichever field carried the email.

#### Scenario: An email is normalised before it is stored

- **WHEN** an employee is assigned to a team under the email `  Jan.Kowalski@Example.COM `
- **THEN** the employee is recorded and returned with the email `jan.kowalski@example.com`

#### Scenario: The same person is recognised in a different spelling

- **WHEN** an employee recorded as `jan.kowalski@example.com` is assigned to another team as `JAN.KOWALSKI@example.com`
- **THEN** the existing employee is assigned and no second employee is recorded

#### Scenario: An email is blank

- **WHEN** an email that is empty or consists only of whitespace is submitted for assignment
- **THEN** the submission is rejected with the code `employee_email.blank` and nothing is recorded

#### Scenario: An email is too long

- **WHEN** an email longer than 254 characters after trimming is submitted for assignment
- **THEN** the submission is rejected with the code `employee_email.too_long` and nothing is recorded

#### Scenario: An email is malformed

- **WHEN** an email with no `@`, more than one `@`, nothing before the `@`, no `.` inside the domain, or whitespace inside it is submitted for assignment
- **THEN** the submission is rejected with the code `employee_email.invalid` and nothing is recorded

#### Scenario: A project manager is recorded on being named

- **WHEN** `ewa@example.com`, never recorded, is named the manager of a project, and is later added to a team as `Ewa@Example.com`
- **THEN** the employee is recorded when named, belongs to no team until added, and is added under the same identifier

#### Scenario: Leaving a team does not delete the employee

- **WHEN** a member is removed from their only team and is later added to a team again under the same email
- **THEN** they are assigned under the identifier they had before
