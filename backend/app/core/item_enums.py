"""The fixed vocabulary of problems and tasks: the PDCA stage.

Here rather than beside the models for the reason `metric_enums` is: the
lifecycle rule uses it and must not import SQLAlchemy.
"""

from enum import StrEnum, auto


class Stage(StrEnum):
    """How far an item has got, in the order a team works through it.

    `act` is the last and closes the item: reaching it archives the item.
    """

    NOT_STARTED = auto()
    PLAN = auto()
    DO = auto()
    CHECK = auto()
    ACT = auto()
