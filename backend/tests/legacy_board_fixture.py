# The tool's configuration is reproduced with its long lines, which the parser must read.
# ruff: noqa: E501
"""A small, invented legacy Boardmeeting tool and backup, shaped like the real ones.

Every name and number here is made up: the real backup is board material and
stays out of the repository.
"""

from typing import Any

TOOL_HTML = """<!doctype html><html><body>
<script id="bm-data" type="application/json">{"collections": {"kpis": "not this"}}</script>
<script>
const CFG = {
  units: [
    {id:"north", name:"North", director:""}, {id:"south", name:"South", director:""}
  ],
  kpis: [
    {id:"revenue", short:"Rev", group:"Finance", name:"Revenue", fmt:"mln", dir:"up", gap:5000000, owner:""},
    {id:"backlog", short:"Backlog", group:"Delivery", name:"Backlog: overdue", fmt:"int", dir:"down", gap:5, owner:""},
    {id:"effort", short:"Effort", group:"Productivity", name:"Effort ratio", fmt:"pct", dir:"band", lo:0.71, hi:0.72, gap:0.005, owner:""},
    {id:"otif", short:"OTIF", group:"Delivery", name:"OTIF by unit", hint:"Average of units", fmt:"pct", dir:"up", green:0.95, gap:0.25, byUnit:"avg", owner:"Directors"},
    {id:"pulse", short:"Pulse", group:"Team", name:"Pulse", fmt:"num1", dir:"up", target:4, gap:0.5, computed:"pulse", owner:""}
  ],
  meeting: {
    team:"Leadership", owner:"Zofia Łęcka", day:"Każda środa", time:"13:00",
    participants:["Zofia Łęcka","Jan Kowalski","Ewa Nowak"]
  }
};
</script></body></html>"""


def backup() -> dict[str, Any]:
    """A backup with three weeks: a target change, unit values, an override,
    problems and tasks at several stages, and pulse answers.
    """
    return {
        "format": "boardmeeting-backup",
        "version": 1,
        "collections": {
            "weeks": {
                "2026-09-23": {
                    "date": "2026-09-23",
                    "k_revenue": {"target": 174000000, "value": 171000000},
                    "k_backlog": {"target": 0, "value": 4},
                    "k_effort": {"target": 0.71, "value": 0.724},
                },
                "2026-09-30": {
                    "date": "2026-09-30",
                    "leader": "Jan Kowalski",
                    "k_revenue": {"target": 174122665, "value": 168997589.049999},
                    "k_backlog": {"target": 0, "value": 9},
                    "u_otif__north": {"value": 0.9},
                    "u_otif__south": {"value": 1},
                },
                "2026-10-07": {
                    "date": "2026-10-07",
                    "leader": "Ewa Nowak",
                    "k_revenue": {"target": 174122665},
                    "k_backlog": {"status": "r", "target": 0, "value": 3},
                    "k_effort": {"comment": "Explained by the CFO", "value": 0.718},
                    "u_otif__north": {"color": "y", "comment": "Late supplier", "value": 0.9},
                },
            },
            "problems": {
                "pr1": {
                    "title": "Builds break on Mondays",
                    "cause": "A shared test database",
                    "idea": "",
                    "comment": "",
                    "owner": "Jan Kowalski",
                    "kpi": "backlog",
                    "status": 4,
                    "due": "2026-09-30",
                    "createdWeek": "2026-09-23",
                    "closedWeek": "2026-10-07",
                },
                "pr2": {
                    "title": "Too little focus at the board",
                    "cause": "",
                    "idea": "Keep the routines on one tab",
                    "comment": "Discussed twice",
                    "owner": "Ewa Nowak/Jan Kowalski",
                    "kpi": "",
                    "status": 1,
                    "due": "2026-10-21",
                    "createdWeek": "2026-09-30",
                    "closedWeek": None,
                },
            },
            "tasks": {
                "t1": {
                    "title": "Give each pipeline its own database",
                    "comment": "Ask the platform team first",
                    "owner": "Jan Kowalski",
                    "kpi": "revenue",
                    "problemId": "pr2",
                    "status": 2,
                    "due": "2026-10-14",
                    "createdWeek": "2026-09-30",
                    "closedWeek": None,
                },
                "t2": {
                    "title": "Decide how often the pulse is answered",
                    "comment": "",
                    "owner": "Adam Nowy",
                    "kpi": "pulse",
                    "problemId": None,
                    "status": 0,
                    "due": "",
                    "createdAt": 1791380812256,
                    "createdWeek": "2026-10-07",
                    "closedWeek": None,
                },
                "t3": {
                    "title": "Update the agenda",
                    "comment": "",
                    "owner": "Zofia Łęcka",
                    "kpi": "",
                    "problemId": None,
                    "status": 4,
                    "due": "2026-10-07",
                    "createdWeek": "2026-10-07",
                    "closedWeek": "2026-10-07",
                },
            },
            "pulse": {
                "2026-10-07__jan-kowalski": {
                    "week": "2026-10-07",
                    "person": "Jan Kowalski",
                    "mood": 4,
                    "pos": "A good release",
                    "neg": "Too many meetings",
                    "better": "",
                    "at": 1791363000000,
                },
                "2026-10-07__ewa-nowak": {
                    "week": "2026-10-07",
                    "person": "Ewa Nowak",
                    "mood": 2,
                    "pos": "",
                    "neg": "Illness in the team",
                    "better": "Fewer meetings",
                },
                "2026-10-14__ewa-nowak": {
                    "week": "2026-10-14",
                    "person": "Ewa Nowak",
                    "mood": 5,
                },
            },
            "projects": {"pj1": {"name": "Migration", "weight": 1, "history": {}}},
        },
    }
