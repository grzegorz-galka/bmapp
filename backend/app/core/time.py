"""The organization's wall clock.

One fixed zone rather than a setting: BMAPP is deployed on-premise for one
organization, and a configurable zone would be configuration for the future.
Meeting dates, start times and schedules are read and written in this zone;
instants are stored in UTC.
"""

from zoneinfo import ZoneInfo

#: The IANA name, for SQL that has to repeat it - the meetings index does.
ORGANIZATION_TZ_NAME = "Europe/Warsaw"

ORGANIZATION_TZ = ZoneInfo(ORGANIZATION_TZ_NAME)
