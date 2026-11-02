Feature: The status of a metric value
  A value is judged against the threshold version in force on its meeting's
  date. Green and amber are zones; the boundaries count as the better zone.
  A version with a target value other than 0 gives its zones as tolerances in
  per cent of it, on the worse side only.
  A colour set by hand wins over the threshold. Nothing here is stored: the
  status is worked out each time a value is read.

  # The status of a value

  Scenario: Higher is better
    Given a higher_is_better metric with green from 95 and amber from 85
    When the values 96, 95, 90, 85 and 84 are judged
    Then they are green, green, amber, amber and red

  Scenario: Lower is better
    Given a lower_is_better metric with green up to 5 and amber up to 10
    When the values 0, 5, 7, 10 and 11 are judged
    Then they are green, green, amber, amber and red

  Scenario: Within a band
    Given a within_band metric with green from 71 to 72 and amber from 70.5 to 72.5
    When the values 71.5, 71, 72, 70.8, 72.5, 70.4 and 72.6 are judged
    Then they are green, green, green, amber, amber, red and red

  Scenario: Higher is better against a target value
    Given a higher_is_better metric with the target value 100 and tolerances 5 and 10
    When the values 101, 95, 92, 90 and 89.9 are judged
    Then they are green, green, amber, amber and red

  Scenario: Lower is better against a target value
    Given a lower_is_better metric with the target value 20 and tolerances 10 and 25
    When the values 18, 22, 23, 25 and 25.1 are judged
    Then they are green, green, amber, amber and red

  Scenario: Within a band around a target value
    Given a within_band metric with the target value 72.3 and tolerances 5 and 10
    When the values 72.3, 68.685, 75.915, 68, 65.07, 79.53, 65 and 80 are judged
    Then they are green, green, green, amber, amber, amber, red and red

  Scenario: A negative target value
    Given a higher_is_better metric with the target value -20 and tolerances 50 and 100
    When the values -25, -30, -35 and -41 are judged
    Then they are green, green, amber and red

  Scenario: No number recorded
    Given a higher_is_better metric with green from 95 and amber from 85
    When a meeting has no number and no colour set by hand
    Then its status is no_data

  Scenario: No threshold in force
    Given a higher_is_better metric with a version effective from 2026-09-01, green from 95 and amber from 85
    When the value 50 is recorded at a meeting on 2026-08-26
    Then its status is no_threshold

  Scenario: A colour set by hand wins
    Given a higher_is_better metric with green from 95 and amber from 85
    When the value 96 is judged with the colour red set by hand
    Then its status is red
    And it is marked as set by hand

  Scenario: A back-dated threshold changes a past status
    Given a higher_is_better metric with a version effective from 2026-07-01, green from 95 and amber from 85
    And the value 90 is recorded at a meeting on 2026-09-09
    And its status is amber
    When a version effective from 2026-09-01, green from 90 and amber from 80, is added
    Then its status is green

  # The threshold in force at a meeting

  Scenario: Meetings either side of a change
    Given a metric with versions "July" effective from 2026-07-01 and "September" effective from 2026-09-01
    Then the version in force on 2026-08-26 is "July"
    And the version in force on 2026-09-02 is "September"

  Scenario: Two versions on the same date
    Given a metric with versions "earlier" and "later" both effective from 2026-09-01, recorded in that order
    Then the version in force on 2026-09-01 is "later"

  Scenario: A meeting before any threshold
    Given a metric with versions "September" effective from 2026-09-01
    Then no version is in force on 2026-08-26
