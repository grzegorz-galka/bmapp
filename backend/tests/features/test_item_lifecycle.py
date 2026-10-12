"""Runs item_lifecycle.feature: the scenarios of *Progress is a PDCA stage*, *A closed
item is archived* and *The meetings at which an item was raised and closed* in
specs/problems-and-tasks/spec.md that the pure lifecycle rule decides."""

from pytest_bdd import scenarios

from tests.features.steps.item_lifecycle import *  # noqa: F403 - the steps are fixtures

scenarios("item_lifecycle.feature")
