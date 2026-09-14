## Context

See `proposal.md` — Why. What shapes the approach:

- The frontend is one page (`TeamsPage`), one API client (`api/teams.ts`) and a
  trivial `App`. Every user-facing string is a literal in `TeamsPage.tsx`. This
  is the smallest the retrofit will ever be.
- The frontend currently renders the API's English `message` verbatim
  (`ApiError.messageFor('name')`), so user-facing text crosses the API boundary.
  Making the UI Polish means severing that: the backend must say *why* in a form
  the frontend can translate.
- Backend rejections arrive on two paths that already converge on one body
  shape: `DomainError` (raised in services) and `RequestValidationError`
  (Pydantic). Both are handled in `app/main.py`. A code has to travel on both.
- Frontend gates are `npm run lint`, `npm run typecheck` (TypeScript 6, strict)
  and `npm run test`. Playwright e2e runs against the real Compose stack and
  today locates elements by English text.

## Goals / Non-Goals

**Goals:**

- One mechanism for translated text that the capabilities still to be built
  (meetings, metrics, problems, tasks) extend by adding keys, not by adding
  machinery.
- A missing Polish translation fails a gate, rather than silently showing
  English or a raw key.
- Language resolution and persistence are deterministic and directly testable,
  including the degenerate cases (storage unavailable, unknown stored value).
- A fixed Polish vocabulary for the domain glossary, so later capabilities do
  not invent synonyms for Board, Meeting, Metric, Problem and Task.

**Non-Goals:**

- **Locale-aware date and number formatting.** Nothing in the UI renders a date
  or a number yet, so a formatting helper would ship with no caller and no
  honest test. It belongs to the first capability that displays a date — the
  meetings capability — and the glossary below is what that capability inherits
  from here. This is why the localization spec carries no formatting
  requirement.
- Translating the API's developer-facing `message` text, OpenAPI descriptions,
  log output or backend exception text. Those stay English.
- A server-side or per-employee language preference. That needs an identity to
  hang off and is revisited when authentication lands.
- Right-to-left support, and any third language. Adding one is adding a
  catalogue, which the design keeps cheap, but it is not in this change.
- Lazy-loading catalogues, translation-management tooling, or extraction
  scripts.

## Decisions

### Use i18next + react-i18next rather than hand-rolling

**Chosen:** add `i18next` and `react-i18next`.

Polish pluralisation is the reason. Polish has four plural categories (one,
few, many, other): *1 problem*, *2 problemy*, *5 problemów*, *1,5 problemu*.
Counted nouns are unavoidable in this domain — open problems, overdue tasks,
metrics out of range — and the first one will arrive with the next capability.
i18next resolves plural categories through `Intl.PluralRules`, so the rules come
from the platform and the catalogue only supplies the forms.

*Alternatives considered:*

- **A hand-rolled context plus JSON catalogues (~60 lines).** Genuinely enough
  for today's strings, which contain no plurals. Rejected because the first
  counted noun forces either a bespoke Polish plural function or a late,
  disruptive migration to a library — and a wrong plural rule is the kind of
  bug that reads as sloppiness to a native speaker rather than as a defect.
- **react-intl / FormatJS.** Equally capable, ICU message syntax. Rejected as
  heavier for a project this size, and its message-extraction workflow is
  overhead we would not use.

`i18next-browser-languagedetector` is deliberately **not** added. Detection here
is roughly fifteen lines, and writing it ourselves is what makes the spec's
awkward cases — an unreadable store, a stored value naming an unsupported
language — directly testable instead of being the plugin's business.

### Catalogues are TypeScript modules, and `pl` is typed as `typeof en`

`src/i18n/en.ts` exports the catalogue object; `src/i18n/pl.ts` declares its
export with the type of the English one. A key present in English and missing
from Polish is then a `tsc` error, and a stray key in Polish is an excess
property error. `npm run typecheck` and `npm run build` both fail on it.

This is the cheapest possible answer to the completeness requirement: no
extraction step, no CI script, no lint plugin — the compiler already owns it.
Module augmentation of `react-i18next`'s `CustomTypeOptions` with the same type
additionally makes `t('teams.heading')` checked, so a typo in a key is a
compile error rather than a key rendered on screen.

A unit test comparing the two key sets is kept as well, so that loosening the
annotation on `pl` is caught too. Catalogues are `.ts`, not `.json`, only
because JSON cannot carry the annotation.

*Alternative considered:* JSON catalogues plus a completeness test. Rejected —
the test catches it later than the compiler does, and only if someone runs it.

### Both catalogues are bundled; no lazy loading

Two small catalogues, bundled into the main chunk, initialised synchronously.
A language change is then a re-render with no loading state and no suspense
boundary, which is what makes "work in progress survives a language change"
straightforward. Revisit if the catalogues ever reach a size where this shows
up in the bundle.

### The API names the reason with a stable code; the frontend owns the wording

Every entry in the `errors` array gains `code`:

```json
{ "errors": [{ "field": "name", "code": "team_name.duplicate",
               "message": "A team named 'Platform' already exists." }] }
```

`message` stays, unchanged, as developer-facing text — visible in the OpenAPI
docs, in logs and to any non-browser client. The frontend stops rendering it.
The addition is backward compatible for every consumer except the frontend,
which this change updates in the same commit.

Implementation shape:

- `DomainError` gains a `code` class attribute; `DuplicateTeamNameError` sets
  `team_name.duplicate`. The existing handler emits it.
- Pydantic validators raise `PydanticCustomError("team_name.blank", …)` instead
  of `ValueError`, which puts the code in the error's `type`. The
  `RequestValidationError` handler reads `item["type"]`.
- Failures Pydantic raises *before* a validator runs — an absent `name`, a
  non-string `name` — carry Pydantic's own type (`missing`, `string_type`).
  These are mapped to the single general code `request.invalid_field` rather
  than being given per-field codes. Reaching them requires a client that
  ignores the documented request shape; the browser cannot produce them. This
  is why the spec's blank-name scenario names two codes.

*Alternatives considered:*

- **`Accept-Language` on the request, backend translates.** Rejected: it puts a
  second catalogue in Python, in a different format, that has to be kept in
  step with the frontend's by hand — two sources of truth for one sentence.
- **Leave errors English.** Rejected: "A team named 'X' already exists." is
  precisely the sentence a Polish user is most likely to meet.
- **Derive the code from HTTP status.** Rejected: 422 covers blank and too-long
  alike, so status cannot distinguish the reasons.

### Unknown codes degrade to a generic translated message

`translateErrorCode(t, code)` returns the catalogue entry for a known code and
`errors.generic` otherwise, logging the API's `message` to the console for a
developer. A Polish user therefore never meets English text, and a backend that
adds a code before the frontend knows it degrades instead of breaking.

### Detection and persistence

Resolution order on startup, first match wins:

1. `localStorage['bmapp.language']`, if it is readable and names a supported
   language.
2. The first supported language in `navigator.languages`, matched on the
   primary subtag so that `pl-PL` matches `pl`.
3. English.

Every `localStorage` access is wrapped — a private window or blocked site data
throws on access, and the spec requires the application to start normally.
Writing happens only on an explicit choice, so a user carried in by browser
detection is not silently pinned to that language forever.

`document.documentElement.lang` is set from an i18next `languageChanged`
listener registered once, which also covers the initial value.

### The switcher lives in an app-level header

`App.tsx` grows a small header holding the switcher, above the routed content,
so the control is on every page by construction rather than by each page
remembering to include it. The switcher is a labelled `<select>`: two options,
keyboard accessible for free, and each language is named in its own language
(`English`, `Polski`) rather than in the active one.

### Polish glossary

Fixed here so later capabilities inherit it rather than re-deciding:

| English   | Polish             |
|-----------|--------------------|
| Board     | Tablica            |
| Meeting   | Spotkanie          |
| Team      | Zespół             |
| Metric    | Wskaźnik           |
| Target    | Cel                |
| Problem   | Problem            |
| Task      | Zadanie            |
| Archived  | Zarchiwizowane     |
| Register  | Zarejestruj        |

`Wskaźnik` is the ordinary Polish word for a measured indicator; note that this
is a translation of **Metric** and does not reintroduce the *Indicator* concept
that `CLAUDE.md` rules out — there is no Polish term reserved for it.

### Testing

- **Vitest** covers each localization scenario: English render, Polish render,
  switching in both directions, typed text surviving a switch, the three
  detection cases, the three persistence cases (remembered applied, remembered
  beats browser, unusable value ignored), `documentElement.lang`, and the three
  API-error cases. Tests set the starting conditions by stubbing
  `navigator.languages` and `localStorage`, never by reaching into i18next.
- Assertions reference catalogue entries rather than literal strings, so
  rewording a message is not a test change. The exception is one test per
  language that pins a couple of actual strings, so that a catalogue wired to
  itself cannot pass vacuously.
- **Playwright** gains a Polish run of the registration flow — including the
  duplicate-name error in Polish, which is the end-to-end proof that the code
  travels from Postgres to a Polish sentence. Language is forced through an
  init script seeding `localStorage`, not through browser locale, so the run is
  deterministic. The existing English specs keep their behaviour.
- **Backend** integration tests assert the `code` on each rejection path.
- **No BDD feature.** Per `CLAUDE.md`, pytest-bdd is for business rules worth
  stating in plain language; which language a label renders in is not one.

## Risks / Trade-offs

- **Polish strings run longer than English** (`Register team` → `Zarejestruj
  zespół`) and can break a tight layout → the header and the form are checked at
  a narrow viewport in Polish; no fixed-width text containers are introduced.
- **Error codes become a public contract** the moment they ship; renaming one
  silently degrades every client to a generic message → the codes are named in
  the team-board spec, so changing one is a spec change with a failing test,
  not an edit.
- **A key added to `en` and forgotten in `pl` blocks the build** rather than
  degrading — deliberate, but it means no one can add an English string without
  supplying Polish. Accepted: a silent English fallback in a Polish UI is the
  failure mode this change exists to remove.
- **Translation quality is not verifiable by the test suite.** The glossary
  fixes the domain terms; the rest is reviewed by a Polish speaker at PR time.
- **Two more frontend dependencies** (~40 KB gzipped) in a project whose rule is
  to add a dependency only if it removes meaningful code. Justified by plural
  handling, which is the part that is genuinely expensive to write correctly.
- **`PydanticCustomError` couples the code to Pydantic's `type` field**; a
  future Pydantic release could change how `type` is surfaced → one handler
  reads it, and the integration tests assert the emitted codes, so a break is
  loud and local.

## Migration Plan

No schema change, so no Alembic migration. The API change is additive and the
frontend and backend ship in the same Compose stack, so there is no window in
which one half expects a field the other does not send. Deploy is the normal
`docker compose up -d --build`. Rollback is reverting the change: an older
frontend ignores `code` and reads `message`, which is still present.

## Open Questions

- Whether a language preference should eventually be stored against the
  employee rather than the browser, so it follows a person between devices.
  Safely deferred: it needs the authentication capability, and adding a
  server-side source later only changes step 1 of the resolution order.
