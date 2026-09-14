# Mockups

Design mockups imported from Claude Design. **Reference artifacts, not application
code** — nothing here is built, bundled or served by the app. Turning a mockup into
a real screen goes through `/opsx:propose` like any other behaviour.

## Source

Claude Design project `5e3d774b-f764-41e2-b9f5-8a58fa13aa0b`:
<https://claude.ai/design/p/5e3d774b-f764-41e2-b9f5-8a58fa13aa0b>

Imported 2026-09-13. Files are verbatim copies; edit them in the design project and
re-import rather than editing here, or the two drift apart.

## Contents

| File | What it is |
|---|---|
| `Board Meeting Hub.dc.html` | Landing page ("hub") mockup — company declarations band, hero with next-meeting countdown, five entry tiles, problem/task funnel, "assigned to me" list |
| `support.js` | Generated `dc-runtime` that renders the `.dc.html` format. Do not edit — it comes from the design project |

## Viewing

`.dc.html` is a Claude Design component file: an `<x-dc>` template plus a
`<script type="text/x-dc">` logic block, rendered in the browser by `support.js`.
Open it over HTTP, not `file://` — the runtime fetches React from a CDN:

```bash
cd mockups && python3 -m http.server 8080
# then open http://localhost:8080/Board%20Meeting%20Hub.dc.html
```

Two props drive the mockup: `theme` (`dark` | `light`) and `language` (`en` | `pl`),
both switchable from the header. All data shown is hard-coded sample data.

## Vocabulary note

The tiles say "Configure / Prepare / Conduct / Browse BM" and "Manage access". These
are the mockup's own labels for user journeys; the domain glossary in `CLAUDE.md`
(board, meeting, metric, metric value, target, problem, task) remains authoritative
for code, UI strings and tests.
