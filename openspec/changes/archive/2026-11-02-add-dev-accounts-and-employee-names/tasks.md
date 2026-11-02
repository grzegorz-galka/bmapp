# Tasks

Every scenario in the delta specs maps onto one named test, given in the task that
implements it.
- Backend integration tests follow the existing convention: one file per requirement
  (`test_<requirement>.py`) and one function per scenario (`test_<scenario>`).
- The development-mode sign-in scenarios stay together in
  `tests/integration/test_development_mode_substitutes_for_the_broker.py`, as they do
  today.

## 1. Schema and the name rule (backend)

- [x] 1.1 Add the Alembic migration `0012_add_dev_accounts_and_employee_names` (design,
  *Migration Plan*):
  - nullable `employees.name` and `employees.surname`, each `VARCHAR(100)`;
  - `dev_credentials (email PK with the normalised-email check, password_hash,
    changed_at)`;
  - the matching models `Employee.name`, `Employee.surname` and `DevCredential`.
  - Verify that `alembic upgrade head` then `alembic downgrade -1` then
    `alembic upgrade head` runs cleanly on an empty database.
  - Verify that `alembic check` reports no drift.
- [x] 1.2 Add `app/services/names.py` with `name_parts_from_email`, `display_name` and
  `initials` (design D6).
  - Verify with `tests/unit/test_a_person_is_named_by_a_display_name.py`:
    `test_two_parts_give_a_name_and_a_surname`,
    `test_one_part_gives_a_name_only`, `test_more_parts_make_up_the_surname`,
    `test_an_underscore_splits_and_a_hyphen_does_not`,
    `test_stored_values_win_over_the_email`, `test_only_a_surname_is_stored`.
- [x] 1.3 Make sure assigning an employee never touches the name columns.
  - Verify with `tests/integration/test_an_employee_has_a_name_and_a_surname.py`:
    `test_a_new_employee_has_no_name`, `test_reassignment_keeps_the_name`.

## 2. Every person a response names carries a display name (backend)

- [x] 2.1 Add `display_name` beside every person's email in the team, member and team
  list schemas. Fill it through `names.display_name` from the joined employee.
  - Verify by extending `test_read_a_team_with_its_members.py`
    `test_a_team_is_returned_with_its_members` to assert each member's display name.
- [x] 2.2 Do the same for meeting hosts, metric owners, item responsible members, pulse
  respondents and unanswered members, and the people the readiness panel lists as
  owing data.
  - Verify with
    `tests/integration/test_every_person_a_response_names_carries_their_display_name.py`:
    `test_a_meetings_host_carries_a_display_name`,
    `test_a_responsible_member_carries_a_stored_name`.
- [x] 2.3 Add `recorded_by_display_name` and `corrected_by_display_name` for thresholds,
  values and corrections. Resolve them by a `LEFT OUTER JOIN employees` on the email
  column, falling back to the derived name (design D7).
  - Verify with a test in the same file, `test_a_recorder_with_no_employee_record_is_named_from_the_email`.
- [x] 2.4 In `app/services/dashboard.py`, replace `identify()`'s guessing with
  `names.display_name` and `names.initials`. Add `display_name` to `CurrentUser` and to
  the host and person fields of the summary. Keep the statement count.
  - Verify that the summary's statement-count test still passes unchanged.
  - Verify that the dashboard integration tests assert the display name and initials of
    `jan.kowalski@example.com` ("Jan Kowalski", "JK").
- [x] 2.5 Mirror every new field in `frontend/src/api/*.ts`.
  - Verify `npm run typecheck`.

## 3. The current user and the broker's name claims (backend)

- [x] 3.1 Read the optional `given_name` and `family_name` into `AuthenticatedPerson` in
  broker mode only (design D8). Return `name`, `surname`, `display_name` and `initials`
  from `GET /auth/me`.
  - Verify by extending `test_the_current_user_can_be_read.py`:
    `test_the_current_user_is_returned`, plus new
    `test_a_person_with_no_stored_name_is_returned_with_a_derived_display_name`. Keep
    `test_an_unauthenticated_caller_is_refused` passing.
- [x] 3.2 Have `GET /auth/me` store non-blank, differing claims on a recorded employee
  and never create one.
  - Verify with `tests/integration/test_the_brokers_name_claims_are_kept_on_the_employee.py`:
    `test_name_claims_are_stored`, `test_a_token_without_name_claims_changes_nothing`,
    `test_a_person_who_is_not_an_employee_is_not_recorded`. These use RS256 tokens
    signed by the test JWKS the broker-mode tests already use.

## 4. Development accounts (backend)

- [x] 4.1 Add scrypt hashing and verification to `app/services/dev_login.py` (design D3).
  - Verify with `tests/unit/test_development_passwords_are_kept_only_as_salted_hashes.py`:
    `test_the_stored_record_does_not_reveal_the_password`. Assert two hashes of the same
    password differ and both verify.
- [x] 4.2 Rework `authenticate_dev_login` and `POST /auth/dev-login` (design D4):
  - with no row, the derived password gives `password_change_required` with the
    proposed name and surname (none for an administrator with no record);
  - with a row, only the stored password gives a token.
  - Update the response model to the union.
  - Verify in `test_development_mode_substitutes_for_the_broker.py` by changing these to
    expect the change-required response:
    - `test_dots_and_the_at_sign_split_the_email`
    - `test_the_administrators_password`
    - `test_any_character_that_is_not_a_letter_or_digit_splits_the_email`
    - `test_a_run_of_separators_counts_once`
    - `test_the_password_follows_the_normalised_email`
  - Verify that `test_a_wrong_password_is_refused` and
    `test_the_one_letter_password_of_the_earlier_rule_is_refused` keep passing.
  - Verify that `test_the_local_means_does_not_exist_when_the_mode_is_off` also covers
    the new route.
- [x] 4.3 Add `POST /auth/dev-password` with its request schema, codes and single
  transaction (design D5). Register it under the dev-only guard.
  - Verify in the same file:
    - `test_the_first_sign_in_asks_for_a_new_password`
    - `test_setting_the_password_signs_the_person_in`
    - `test_an_administrator_with_no_record_sets_only_a_password`
    - `test_a_blank_name_is_stored_as_none`
    - `test_setting_the_password_needs_the_current_one`
    - `test_a_short_password_is_refused`
    - `test_keeping_the_derived_password_is_refused`
    - `test_an_overlong_name_is_refused`
    - `test_the_derived_password_no_longer_signs_in`
    - `test_the_chosen_password_signs_in`
    - `test_removing_the_stored_password_restores_the_derived_one`
    - `test_a_local_token_is_obtained_in_development_mode`, updated to use a chosen
      password
    - `test_an_administrator_who_is_not_an_employee_signs_in`, updated the same way
    - `test_an_unknown_email_is_refused`
  - Verify that `test_a_sign_in_is_logged_without_the_password` is extended to the
    password change and asserts that no name or password appears in the log.
  - Verify that `tests/unit/test_domain_errors.py` covers the new codes.
- [x] 4.4 Run the backend gate.
  - Verify that `uv run ruff check . && uv run ruff format --check . && uv run mypy app`
    passes.
  - Verify that `uv run pytest --cov=app` passes with backend coverage not lower than
    before.

## 5. The interface names people (frontend)

- [x] 5.1 Switch the header's `AccountControl` to read `useCurrentUser`: display name
  and initials in the header, the email in its menu (design D8). Translate
  `auth.accountLabel` with the name.
  - Verify in `AccountControl` and `DashboardPage.test.tsx`: the identity is displayed
    ("Jan Kowalski", "JK", email in the menu), and stored names give the initials
    ("GG").
- [x] 5.2 Replace each email shown as a person's name with `display_name` across these
  pages: dashboard tiles, My meetings, My teams, the teams list, the board's item lists
  and dialog, the archived view, the metric settings owner, the metric detail
  recorder, the recording view, pulse cards and answers, the readiness panel, and the
  meetings page host.
  - Verify with these tests:
    - `MeetingsTile.test.tsx`: another member's meeting is not marked (shows "Anna Nowak")
      and the host sees their meeting marked;
    - `ReadinessPanel.test.tsx`: the panel lists what is missing (shows "Anna Nowak"),
      and copying still copies emails;
    - `BoardPage` or the item list tests: the board names the responsible member;
    - `PulseAnswers` tests: the pulse answers name the respondent;
    - `grep -rn "\.email}" frontend/src/features` lists only the places the
      `team-membership` spec keeps.
- [x] 5.3 Make the members page show the display name with the email beside it, and the
  teams list show the leader's display name.
  - Verify in the `TeamMembersPage` and `TeamsPage` tests: a member added from the
    members page, and a team registered with its leader from the page.
- [x] 5.4 Check that Hide names still hides every person now shown by name.
  - Verify that the existing hide-names tests in `BoardPage.test.tsx` and the pulse
    tests pass with names instead of emails.

## 6. The first-login window (frontend)

- [x] 6.1 Add `setDevPassword` to `frontend/src/api/auth.ts`, and the union response to
  `devLogin`. Teach `DevAuthProvider` to move to the `setPassword` step and finish the
  sign-in with the returned token.
  - Verify in `DevAuthProvider.test.tsx`: the first sign-in moves to the new step;
    setting the password signs in.
- [x] 6.2 Build the `setPassword` step in `DevLoginDialog` (design D9):
  - the email is fixed;
  - name and surname are filled in from the response and hidden when null;
  - the new password is asked for twice;
  - a mismatch is caught before sending;
  - field errors are translated from the codes;
  - closing sends nothing.
  - Add the strings and codes (`dev_password.too_short`, `dev_password.unchanged`,
    `employee_name.too_long`, `auth.passwordMismatch`) to `en.ts` and `pl.ts`.
  - Verify in `DevLoginDialog.test.tsx`:
    - `the window asks for a password, name and surname`
    - `setting the password in the window signs the person in`
    - `unequal passwords are refused in the window`
    - `an administrator with no record is asked only for a password`
    - `closing the window at the new password step stores nothing`
    - `the window does not say how the password is derived` (extended to the second step)
  - Verify `npm run lint && npm run typecheck && npm run test`.

## 7. End to end and documentation

- [x] 7.1 Update `frontend/e2e/api.ts` and `frontend/e2e/auth.ts` to set `E2E_PASSWORD`
  on first sign-in and to reuse it when a password is already set (design D10). Add a
  first-login walk-through to `sign-in-and-out.spec.ts`.
  - Verify that `npm run test:e2e` passes twice in a row against the same database.
- [x] 7.2 Update the dev-mode section of `SECURITY.md`:
  - the first sign-in, the chosen password, `dev_credentials`, scrypt, and deleting the
    row as the reset;
  - the Railway section's lockout risk and its remedy.
  - Update CLAUDE.md's dev-mode paragraph and its *Current state*: employees have names,
    and people are shown by display name.
  - Verify by reading both against the delta specs. No sentence in either should still
    say the derived password signs a person in.
- [x] 7.3 Check the change end to end in `docker compose up` in dev mode:
  - sign in for the first time;
  - correct the surname;
  - check that the header and the board show the name;
  - sign out;
  - check that the derived password is refused and the chosen one works.
  - Verify by the observed behaviour.

## Workflow follow-up

- Sync the delta specs into `openspec/specs/` and archive the change once the PR is merged.
- Propose the separate docs change that rewrites the federation description in
  `SECURITY.md` and CLAUDE.md for Keycloak.
