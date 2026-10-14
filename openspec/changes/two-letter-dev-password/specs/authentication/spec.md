# Spec Delta

## MODIFIED Requirements

### Requirement: The development password is derived from the email

In development mode the password for an email SHALL be the first two characters of
each run of letters and digits in it, in order, taken from the email trimmed and
lower-cased; a run of one character contributes that one character, and characters
that are neither letters nor digits contribute nothing. A local token SHALL be
refused with HTTP 401 and the code `auth.password_incorrect` when the password given
is not exactly that string.

#### Scenario: Dots and the at-sign split the email

- **WHEN** a local token is requested for `grzegorz.galka@pse.pl` with the password
  `grgapspl`, or for `admin@company.com` with the password `adcoco`, each email
  belonging to a recorded employee
- **THEN** a token is issued

#### Scenario: The administrator's password

- **WHEN** a local token is requested for `admin@example.com`, an administrator, with
  the password `adexco`
- **THEN** a token is issued

#### Scenario: Any character that is not a letter or digit splits the email

- **WHEN** a local token is requested for `jan_k-x@a.pl`, a recorded employee, with the
  password `jakxapl`
- **THEN** a token is issued

#### Scenario: A run of separators counts once

- **WHEN** a local token is requested for `a..b@c.pl`, a recorded employee, with the
  password `abcpl`
- **THEN** a token is issued

#### Scenario: The password follows the normalised email

- **WHEN** a local token is requested for `  Grzegorz.Galka@PSE.pl `, a recorded
  employee, with the password `grgapspl`
- **THEN** a token is issued for `grzegorz.galka@pse.pl`

#### Scenario: A wrong password is refused

- **WHEN** a local token is requested for a recorded employee with any password other
  than the one derived from their email, including the right letters in upper case
- **THEN** no token is issued and the request is refused with HTTP 401 and the code
  `auth.password_incorrect` on the field `password`

#### Scenario: The one-letter password of the earlier rule is refused

- **WHEN** a local token is requested for `grzegorz.galka@pse.pl`, a recorded
  employee, with the password `ggpp`
- **THEN** no token is issued and the request is refused with HTTP 401 and the code
  `auth.password_incorrect` on the field `password`
