## Why

The landing page still reads like a brochure for the application. Its five tiles (Configure, Prepare, Conduct, Browse, Manage access) describe what BMAPP can do, but none of them leads anywhere or says anything about the viewer's own week. Its declarations are invented, and its teams and countdown are constants. Meetings, metric values, the pulse check, problems and tasks are now all recorded, so the page can be what a person needs on Monday morning: which board meetings are coming, what still has to be done for each, and which problems and tasks are theirs. "Hub" also names nothing a user recognises. The Polish team says *Pulpit*, and the English counterpart is **Dashboard**.

## What Changes

- **Renamed: the hub becomes the dashboard** (*Pulpit* in Polish), in the glossary, the interface, the navigation, the spec capability, the API and the code. It stays at `/`.
  - **BREAKING** (API): `GET /hub` becomes `GET /dashboard`. The frontend is its only client.
- **The company declarations are the real ones**, taken from the legacy board (`samples/Boardmeeting_offline_2026-10-10.html`, view *Start*). The mission and the vision each have a headline and a description. There are four values (Effectiveness, Passion, Innovation, Collaboration), each with a description and a pictogram. The three strategic goals are the annual ones. Every text is in English and Polish.
  - **BREAKING** (API): `mission` and `vision` become `{headline, body}`, and each value becomes `{name, description, icon}`.
- **Removed: the tiles "Conduct a board meeting", "Prepare a board meeting" and "Browse board meetings"**, together with the placeholder preparation counts and in-session flag behind them.
- **New: the tile "My board meetings"** lists the viewer's current and upcoming board meetings across their teams, soonest first. For each team that is the editable meetings dated today or later, or, if none has been opened, the date its schedule proposes. Each row shows the team, the date and time, the host, how much of its recording is done, and whether the viewer has answered its pulse check. Each row offers:
  - **Prepare data**: opens the team's board on that meeting with the recording view open.
  - **Fill pulse check**: opens the board's pulse check view of that meeting with the answer form open.
  - **Start meeting**: offered on a meeting dated today. It opens the board on that meeting.
  
  A row that is only proposed is opened as a meeting first, through the existing open-meeting request, and the action then proceeds.
- **Renamed and extended: the tile "Problem & task funnel" becomes "My teams' problems and tasks".** It keeps the funnel. For each of the viewer's teams it links to the board's problems list, its tasks list and its archive. It lists in detail the active problems and tasks assigned to the viewer: kind, summary, team, PDCA stage, due date with the overdue mark, and the metric or problem it is linked to. Each one links to its team's list.
- **Removed: the tiles "Configure a board" and "Manage access"** and the section that held them.
- **"My teams" becomes recorded data.** It shows the teams the viewer is a member of, each with their role, the board's schedule and its next meeting (the first opened meeting dated today or later, else the proposal, else none). The countdown counts to the nearest of these. Readiness moves to the meeting rows as recording progress.
  - **BREAKING** (API): a team gains `schedule`, `next_meeting_at` may be null, and `readiness` is removed. `preparation`, `meeting_in_session` and `provisional` are removed from the summary.
- **Infographics and icons.** The declarations banner gets a pictogram for the mission, the vision and the goals, and a hexagon pictogram for each value, after the legacy board's *Start* view. Each tile title gets a pictogram. Every action button and link gets an icon beside its caption. All of them are inline SVG, hidden from assistive technology, and never replace the words.
- **The board's address can open the recording view and the pulse answer form directly** (`?meeting=…&mode=record`, `?meeting=…&view=pulse&mode=answer`), so the dashboard's actions land where the work is. Today both are a local switch.

## Capabilities

### New Capabilities

- `dashboard`: The landing page at `/`. It covers the navigation shell, the company declarations, the viewer's teams and countdown, their board meetings with the actions to prepare, answer and start them, their teams' problems and tasks with what is assigned to them, and the single summary request that supplies it all. It replaces `hub` under the name users know it by, rather than modifying it: nearly every requirement changes, and the old name would remain in every heading.

### Modified Capabilities

- `hub`: Every requirement is removed. Its behaviour moves to `dashboard`, restated where it survives.
- `metric-values`: added *The recording view has its own address*. Existing requirements are unchanged.
- `pulse-check`: added *The answer form has its own address*. Existing requirements are unchanged.
- `problems-and-tasks`: added *The board's lists can be reached from an address*, so the dashboard's links land on the problems or tasks list. This capability arrives in `openspec/specs/` when `add-problems-and-tasks` is archived.

## Impact

- **Order**: builds on `add-problems-and-tasks`, which is complete but not yet archived. That change modifies `hub`, and this change's removals name the requirements as they stand after it. Archive it on `main` first, then rebase `feature/landing-page`.
- **Data**: no migration. Everything the dashboard shows beyond the declarations is read from existing tables: teams, team members, board schedules, meetings, metric placements and values, pulse answers, problems and tasks.
- **API**: `GET /hub` → `GET /dashboard` with the new shape. Opening a proposed meeting reuses `POST /teams/{team_id}/meetings`. No new error codes.
- **Backend**: `app/{api,schemas,services}/hub.py` → `dashboard.py`. It reuses `propose_next`, `editable_meetings`, the board's recording completeness and the pulse answer lookup instead of the placeholder seeds.
- **Frontend**: `features/hub/` → `features/dashboard/`, with `Tiles.tsx` and the admin tiles deleted, and a new `MeetingsTile`. `FunnelPanel` and `AssignedItems` merge into one tile. A small icon module joins `components/`. `BoardPage` and `PulseView` read `mode` from the address. Strings in `en.ts` and `pl.ts`, and the `hub.*`, `tiles.*` and `nav.hub` keys are renamed or removed.
- **Docs**: the CLAUDE.md glossary (Hub → Dashboard), its *Current state* and Testing sections, and README.
- **Dependencies**: none. The icons are inline SVG, like the flags.
- **Non-goals**:
  - dedicated problems and tasks pages. The links lead to the lists on the board, which is where they live;
  - an "in session" state for a meeting, or anything that marks a meeting as started;
  - the strategic declaration "By 2030…", the flywheel, and the meeting's goals, agenda and rules from the legacy *Start* view;
  - editing the declarations in the application. That belongs to the targets capability;
  - the archive entry in the navigation, which stays named but unavailable.

## Assumptions

- **The real declarations may be public.** The user confirmed that the PSE Innowacje mission, vision, values and annual goals may be committed and shown on the Railway demo, although that demo otherwise holds invented data only. The English text is a translation made for this change. The Polish text is the original.
- **"Current and upcoming" means the meetings still taking values and answers, dated today or later**: a meeting today, and the first one after today. Last week's meeting can still be corrected on the board, but it is not listed.
- **Any action on a proposed row opens the meeting first.** Values and answers need a meeting to belong to, and opening one ahead is how meetings are prepared now. Only members open meetings, and the dashboard lists only the viewer's own teams, so the viewer is always allowed to.
- **"Start meeting" is offered only on a meeting dated today**, and it navigates. The board already has everything needed to run the meeting.
- **"Problems and tasks pages" are the board's lists.** No such pages exist in the frontend: the board shows the active items, and `?view=archived` shows the closed ones. The links take the viewer to the board with its problems or tasks list in view.
- **An assigned item links to its team's board**, as now, scrolled to the list it is in.
