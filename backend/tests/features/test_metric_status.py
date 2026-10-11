"""Runs metric_status.feature: one scenario per scenario of *The status of a
value* and *The threshold in force at a meeting* in specs/metrics/spec.md."""

from pytest_bdd import scenarios

from tests.features.steps.metric_status import *  # noqa: F403 - the steps are fixtures

scenarios("metric_status.feature")
