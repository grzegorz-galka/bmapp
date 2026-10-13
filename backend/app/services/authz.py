"""Who may do what.

Pure functions over two facts - whether the person is an administrator, and
what relationship they have to the team in question. No session, no HTTP, no
request: the router gathers the facts and these decide. That is what lets
every row of the permission table be unit-tested without a fixture.

There are no roles. "Leader" and "leader deputy" are not things a person is,
they are things a person is *of a team*, read from that team's own records. A
person who leads or deputises for one team holds no authority over a team they
do not.
"""

from enum import StrEnum, auto


class Relationship(StrEnum):
    """What a person is to one particular team."""

    #: Not a member of it.
    STRANGER = auto()
    #: A member of it, but neither its leader nor one of its deputies.
    MEMBER = auto()
    #: Its leader, who is always also a member.
    LEADER = auto()
    #: One of its leader deputies, who is always also a member and never the leader.
    DEPUTY = auto()


#: Whoever runs the team: its leader and the deputies standing in for them.
_RUNS_THE_TEAM = frozenset({Relationship.LEADER, Relationship.DEPUTY})
#: Anyone the team records as a member, whatever else they are to it.
_ON_THE_TEAM = frozenset({Relationship.LEADER, Relationship.DEPUTY, Relationship.MEMBER})


def may_register_a_team(*, is_admin: bool) -> bool:
    """Registering a team and naming its leader is the organization's decision.

    There is no leader before the team exists, so there is nobody else it
    could belong to.
    """
    return is_admin


def may_change_the_leader(*, is_admin: bool) -> bool:
    """Who runs a team is the organization's decision, not the team's.

    Deliberately not granted to the current leader, nor to a deputy: handing
    over is how leadership moves, and letting a leader choose their successor
    would make the organization's decision theirs.
    """
    return is_admin


def may_manage_membership(*, is_admin: bool, relationship: Relationship) -> bool:
    """Adding and removing ordinary members belongs to whoever runs the team.

    The leader and their deputies. The routine arrival and departure of people
    should not need an administrator; deciding who runs the team should.
    Removing a member who is a deputy is `may_appoint_deputies`'s question.
    """
    return is_admin or relationship in _RUNS_THE_TEAM


def may_appoint_deputies(*, is_admin: bool, relationship: Relationship) -> bool:
    """Appointing, revoking and removing a deputy: the leader and administrators.

    Not the deputies themselves: the leader chooses who stands in for them, so
    a deputy can neither widen nor narrow the circle they belong to.
    """
    return is_admin or relationship is Relationship.LEADER


def may_configure_the_board(*, is_admin: bool, relationship: Relationship) -> bool:
    """The metrics, their thresholds, the custom targets and the schedule.

    What the leader and their deputies do that an ordinary member cannot.
    """
    return is_admin or relationship in _RUNS_THE_TEAM


def may_define_global_metrics(*, is_admin: bool) -> bool:
    """The company-wide catalogue: its metrics and their thresholds.

    The organization's, like registering a team. No team's leader may: a
    global metric is judged the same way on every board, so no one board
    decides how.
    """
    return is_admin


def may_record_meeting_data(*, is_admin: bool, relationship: Relationship) -> bool:
    """Meetings, metric values, problems and tasks: anyone on the team.

    For metric values this is only the first question; the editing window,
    which only an administrator's correction gets past, is the second.
    """
    return is_admin or relationship in _ON_THE_TEAM


def may_read_pulse_answers(*, is_admin: bool, relationship: Relationship) -> bool:
    """Who answered the pulse check, and what they said: the team and administrators.

    The one exception to everyone reading everything. The results without
    names - counts, average, distribution, trend - are still for anyone
    signed in.
    """
    return is_admin or relationship in _ON_THE_TEAM


def may_answer_the_pulse_check(*, relationship: Relationship) -> bool:
    """Only someone on the team, and only as their own answer.

    Deliberately takes no `is_admin`: unlike every other write, an answer is
    not something the organization does on a team's behalf. It is a person's
    own statement about their week, so an administrator who is not a member
    has nothing to answer.
    """
    return relationship in _ON_THE_TEAM


def may_read(*, is_authenticated: bool) -> bool:
    """Everything, to anyone signed in.

    Not gated on an employee record: someone who has joined the organization
    but has not yet been put on a team must still be able to see the boards,
    and an administrator must be able to see a system in which nothing has
    been recorded yet.
    """
    return is_authenticated
