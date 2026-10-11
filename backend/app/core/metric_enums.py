"""The fixed vocabularies of metrics: direction, colour, status and scope.

Here rather than beside the models or the status rule because both use them,
and the status rule must not import SQLAlchemy - through the models package
it would.
"""

from enum import StrEnum, auto


class Direction(StrEnum):
    """Which way a metric's values get better. Fixed when the metric is added."""

    HIGHER_IS_BETTER = auto()
    LOWER_IS_BETTER = auto()
    WITHIN_BAND = auto()


class Colour(StrEnum):
    """A colour a member may set by hand on a value."""

    GREEN = auto()
    AMBER = auto()
    RED = auto()


class Status(StrEnum):
    """What a value says at its meeting. Computed when read, never stored."""

    GREEN = auto()
    AMBER = auto()
    RED = auto()
    NO_DATA = auto()
    NO_THRESHOLD = auto()


class Scope(StrEnum):
    """Whose a metric on a board is: the board's own, or the company-wide catalogue's."""

    BOARD = auto()
    GLOBAL = auto()
