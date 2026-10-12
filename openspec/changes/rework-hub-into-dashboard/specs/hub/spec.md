## REMOVED Requirements

### Requirement: The application opens at the hub

**Reason**: The landing page is renamed the dashboard. This becomes *The application opens at the dashboard* and *Every page carries the navigation* in `dashboard`.
**Migration**: The route `/` is unchanged. The navigation label `Hub` becomes `Dashboard` / `Pulpit`. The tests move to the dashboard's names with their scenarios unchanged.

### Requirement: The hub shows the company declarations

**Reason**: Restated as *The dashboard shows the company declarations*. The declarations are now the company's own, and the mission, the vision and each value have a description.
**Migration**: The summary's `mission` and `vision` become `{headline, body}` and each value becomes `{name, description, icon}`. The frontend reads the new shape.

### Requirement: The hub shows the user's teams and the next board meeting

**Reason**: The teams are now recorded rather than placeholder data, and board readiness moves to the meeting rows as recording progress. Restated as *The dashboard shows the viewer's teams* and *The countdown to the nearest meeting*.
**Migration**: A team's `readiness` is removed, `schedule` is added and `next_meeting_at` may be null. The readiness tests are deleted, and their concern is covered by *Recording progress and the pulse check are stated in words*.

### Requirement: The hub offers the things a person does at a board meeting

**Reason**: The five entry points led nowhere and described the application rather than the viewer's week. They are replaced by *The dashboard lists the viewer's board meetings* and its three actions.
**Migration**: The summary's `preparation` and `meeting_in_session` are removed. The entry-point tests are deleted.

### Requirement: The hub shows the problem and task funnel

**Reason**: Restated as *The problems and tasks of the viewer's teams* under the tile's new name, with links to each team's lists.
**Migration**: None for the figures. The funnel tests move to the dashboard's names.

### Requirement: The hub shows the items assigned to the current user

**Reason**: Restated as *The items assigned to the viewer*, with each item's linked metric and problem, and linking to the item's list rather than to the board's top.
**Migration**: An assigned item gains `metric` and `problem` (each optional). The tests move to the dashboard's names.

### Requirement: The hub is supplied by a single authenticated summary

**Reason**: Restated as *The dashboard is supplied by a single authenticated summary* and *The summary is language-neutral*. Everything but the declarations is now recorded, so the summary no longer declares itself provisional.
**Migration**: `GET /hub` becomes `GET /dashboard`. `provisional` is removed. *The summary declares itself provisional* is deleted.

### Requirement: The hub's next meetings stay ahead of the request

**Reason**: Next meetings are no longer computed from placeholder weekly slots. They are the team's opened meetings or the schedule's proposal, which `meetings` already specifies.
**Migration**: The tests are deleted. *An opened meeting comes before the proposal* and *A proposed date is listed as not yet opened* cover the replacement.

### Requirement: The hub identifies the signed-in person

**Reason**: Restated as *The dashboard identifies the signed-in person*.
**Migration**: None. The tests move to the dashboard's names.

### Requirement: The hub reports loading and failure

**Reason**: Restated as *The dashboard reports loading and failure*.
**Migration**: None. The tests move to the dashboard's names.
