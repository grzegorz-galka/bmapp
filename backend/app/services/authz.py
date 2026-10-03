"""Who may do what.

Pure functions over two facts - whether the person is an administrator, and
what relationship they have to the team in question. No session, no HTTP, no
request: the router gathers the facts and these decide. That is what lets
every row of the permission table be unit-tested without a fixture.

There are no roles. "Leader" is not something a person is, it is something a
person is *of a team*, read from that team's own records. A person who leads
one team holds no authority over a team they do not lead.
"""

from enum import StrEnum, auto


class Relationship(StrEnum):
    """What a person is to one particular team."""

    #: Not a member of it.
    STRANGER = auto()
    #: A member of it, but not its leader.
    MEMBER = auto()
    #: Its leader, who is always also a member.
    LEADER = auto()


def may_register_a_team(*, is_admin: bool) -> bool:
    """Registering a team and naming its leader is the organization's decision.

    There is no leader before the team exists, so there is nobody else it
    could belong to.
    """
    return is_admin


def may_change_the_leader(*, is_admin: bool) -> bool:
    """Who runs a team is the organization's decision, not the team's.

    Deliberately not granted to the current leader: handing over is how
    leadership moves, and letting a leader choose their successor would make
    the organization's decision theirs.
    """
    return is_admin


def may_manage_membership(*, is_admin: bool, relationship: Relationship) -> bool:
    """Adding and removing ordinary members belongs to whoever runs the team.

    The routine arrival and departure of people should not need an
    administrator; deciding who runs the team should.
    """
    return is_admin or relationship is Relationship.LEADER


def may_configure_the_board(*, is_admin: bool, relationship: Relationship) -> bool:
    """The metrics, their acceptable range, the custom targets and the schedule.

    The one thing a leader does that an ordinary member cannot. Nothing uses
    this yet - the board definition is not configurable until the capability
    that builds it lands - and it is here so that capability implements this
    rule rather than inventing one.
    """
    return is_admin or relationship is Relationship.LEADER


def may_record_meeting_data(*, is_admin: bool, relationship: Relationship) -> bool:
    """Metric values, problems and tasks: anyone on the team.

    Also not reachable yet, and here for the same reason.
    """
    return is_admin or relationship in {Relationship.LEADER, Relationship.MEMBER}


def may_read(*, is_authenticated: bool) -> bool:
    """Everything, to anyone signed in.

    Not gated on an employee record: someone who has joined the organization
    but has not yet been put on a team must still be able to see the boards,
    and an administrator must be able to see a system in which nothing has
    been recorded yet.
    """
    return is_authenticated
