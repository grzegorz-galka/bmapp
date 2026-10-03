"""Requirement: Permission is decided per team, not per role.

Every row of the permission table, decided without a request or a database:
the rules are pure functions of two facts, which is the point of keeping them
apart from the dependency that gathers those facts.
"""

import pytest

from app.services.authz import (
    Relationship,
    may_change_the_leader,
    may_configure_the_board,
    may_manage_membership,
    may_read,
    may_record_meeting_data,
    may_register_a_team,
)

EVERY_RELATIONSHIP = [Relationship.STRANGER, Relationship.MEMBER, Relationship.LEADER]


# --- Registering a team, and naming who leads it -------------------------------


def test_an_administrator_registers_a_team() -> None:
    assert may_register_a_team(is_admin=True) is True


def test_a_non_administrator_does_not_register_a_team() -> None:
    assert may_register_a_team(is_admin=False) is False


def test_an_administrator_hands_over_leadership() -> None:
    assert may_change_the_leader(is_admin=True) is True


def test_a_leader_cannot_hand_over_their_own_leadership() -> None:
    """Who runs a team is the organization's decision, not the leader's."""
    assert may_change_the_leader(is_admin=False) is False


# --- Membership ----------------------------------------------------------------


def test_a_leader_manages_the_membership_of_their_team() -> None:
    assert may_manage_membership(is_admin=False, relationship=Relationship.LEADER) is True


def test_an_ordinary_member_cannot_change_membership() -> None:
    assert may_manage_membership(is_admin=False, relationship=Relationship.MEMBER) is False


def test_a_stranger_cannot_change_membership() -> None:
    assert may_manage_membership(is_admin=False, relationship=Relationship.STRANGER) is False


@pytest.mark.parametrize("relationship", EVERY_RELATIONSHIP)
def test_an_administrator_manages_membership_of_any_team(relationship: Relationship) -> None:
    """Including a team they neither lead nor belong to."""
    assert may_manage_membership(is_admin=True, relationship=relationship) is True


# --- A leader's authority stops at their own team ------------------------------


def test_a_leaders_authority_does_not_reach_another_team() -> None:
    """The same person, two teams: leader of one is a stranger to the other.

    This is what "no roles" means. If leadership were a property of the person
    rather than of the team, these two calls could not disagree.
    """
    leads_this_one = may_manage_membership(is_admin=False, relationship=Relationship.LEADER)
    but_not_that_one = may_manage_membership(is_admin=False, relationship=Relationship.STRANGER)
    assert (leads_this_one, but_not_that_one) == (True, False)


def test_leadership_handed_over_moves_the_authority_with_it() -> None:
    """Afterwards the new leader may configure the board and the old one may not."""
    new_leader = may_configure_the_board(is_admin=False, relationship=Relationship.LEADER)
    previous_leader = may_configure_the_board(is_admin=False, relationship=Relationship.MEMBER)
    assert (new_leader, previous_leader) == (True, False)


# --- Configuring the board -----------------------------------------------------


def test_a_leader_configures_their_own_board() -> None:
    assert may_configure_the_board(is_admin=False, relationship=Relationship.LEADER) is True


@pytest.mark.parametrize("relationship", [Relationship.MEMBER, Relationship.STRANGER])
def test_nobody_else_configures_a_board(relationship: Relationship) -> None:
    assert may_configure_the_board(is_admin=False, relationship=relationship) is False


# --- Recording what happens at a meeting ---------------------------------------


@pytest.mark.parametrize("relationship", [Relationship.MEMBER, Relationship.LEADER])
def test_anyone_on_the_team_records_meeting_data(relationship: Relationship) -> None:
    assert may_record_meeting_data(is_admin=False, relationship=relationship) is True


def test_a_stranger_does_not_record_meeting_data() -> None:
    assert may_record_meeting_data(is_admin=False, relationship=Relationship.STRANGER) is False


# --- Reading -------------------------------------------------------------------


def test_anyone_signed_in_may_read() -> None:
    assert may_read(is_authenticated=True) is True


def test_nobody_signed_out_may_read() -> None:
    assert may_read(is_authenticated=False) is False


# --- An administrator may do everything ----------------------------------------


@pytest.mark.parametrize("relationship", EVERY_RELATIONSHIP)
def test_an_administrator_may_act_on_any_team(relationship: Relationship) -> None:
    assert all(
        (
            may_register_a_team(is_admin=True),
            may_change_the_leader(is_admin=True),
            may_manage_membership(is_admin=True, relationship=relationship),
            may_configure_the_board(is_admin=True, relationship=relationship),
            may_record_meeting_data(is_admin=True, relationship=relationship),
        )
    )
