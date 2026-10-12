Feature: The lifecycle of a problem or a task
  An item's progress is a PDCA stage: not_started, plan, do, check, act. Any
  stage may be set, forwards or back, until the item reaches act, which closes
  and archives it. A change belongs to the team's meeting of the moment: its
  first meeting dated today or later, or else its latest, or none.

  # Progress is a PDCA stage

  Scenario: A stage is moved on
    Given a task at plan
    When it is changed to do
    Then it is at do
    And it is still active

  Scenario: A stage is moved back
    Given a problem at check
    When it is changed to plan
    Then it is at plan
    And it is still active

  Scenario: Setting the same stage twice changes nothing more
    Given a task at plan
    When two members both change it to do, one after the other
    Then it is at do
    And it is still active

  # A closed item is archived

  Scenario: Closing archives
    Given a problem at check
    When it is changed to act
    Then it is archived
    And it records when it was closed

  Scenario: An item raised as done is archived at once
    When a task is raised at act
    Then it is archived
    And it was raised and closed at the same time

  # The meetings at which an item was raised and closed

  Scenario: Raised before the coming meeting
    Given today is Monday 2026-10-12
    And the team meets on 2026-10-07 and 2026-10-14
    When a member raises a problem
    Then it was raised at the meeting on 2026-10-14

  Scenario: Raised at the meeting itself
    Given today is Wednesday 2026-10-14
    And the team meets on 2026-10-07 and 2026-10-14
    When a member raises a task
    Then it was raised at the meeting on 2026-10-14

  Scenario: Closed after the last meeting, before the next is opened
    Given today is Thursday 2026-10-15
    And the team meets on 2026-10-07 and 2026-10-14
    And a task raised then at do
    When it is changed to act
    Then it was closed at the meeting on 2026-10-14

  Scenario: A team without meetings
    Given today is Monday 2026-10-12
    And the team has opened no meeting
    When a member raises a problem
    Then it was raised at no meeting
