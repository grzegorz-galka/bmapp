## 1. Backend: error codes on every rejection

- [x] 1.1 Add a `code` class attribute to `DomainError` in `backend/app/core/exceptions.py`, defaulting to `request.invalid_field`, and set `team_name.duplicate` on `DuplicateTeamNameError`; verify `uv run pytest tests/unit` still passes and `uv run mypy app` is clean.
- [x] 1.2 Extend `_error_body` and the `DomainError` handler in `backend/app/main.py` to emit `code` alongside `field` and `message`; verify a duplicate-name registration returns `code: "team_name.duplicate"` in an integration test.
- [x] 1.3 Raise `PydanticCustomError("team_name.blank", …)` and `PydanticCustomError("team_name.too_long", …)` from the `name` validator in `backend/app/schemas/team.py` in place of `ValueError`, keeping the existing English messages; verify `uv run pytest tests/unit/test_team_schemas.py` passes with the messages unchanged.
- [x] 1.4 Read the code from `item["type"]` in the `RequestValidationError` handler in `backend/app/main.py`, mapping Pydantic's own types (`missing`, `string_type`, and anything else unrecognised) to `request.invalid_field`; verify a blank name returns `team_name.blank` and a request with no `name` key returns `request.invalid_field`.
- [x] 1.5 Extend `backend/tests/integration/test_register_a_team_with_its_board.py` to assert the code on each rejection path — blank, too long, duplicate, absent — one test per spec scenario; verify `uv run pytest` passes and `uv run pytest --cov=app` shows coverage has not dropped.

## 2. Frontend: i18n foundation

- [x] 2.1 Add `i18next` and `react-i18next` to `frontend/package.json`; verify `npm install` succeeds and `npm run build` still passes with no other change.
- [x] 2.2 Create `frontend/src/i18n/en.ts` holding every string currently hard-coded in `TeamsPage.tsx` plus the error-code and generic-error entries, exporting its type; verify `npm run typecheck` passes.
- [x] 2.3 Create `frontend/src/i18n/pl.ts` with its export annotated as the English catalogue's type; verify that deleting a key from it makes `npm run typecheck` fail, then restore it.
- [x] 2.4 Create `frontend/src/i18n/index.ts` initialising i18next with both catalogues bundled and synchronous, and augment `react-i18next`'s `CustomTypeOptions` so `t()` keys are type-checked; verify `npm run typecheck` rejects an unknown key.
- [x] 2.5 Implement language resolution in `frontend/src/i18n/detect.ts` — stored choice, then `navigator.languages` matched on the primary subtag, then English — with every `localStorage` access guarded; verify unit tests cover all three spec scenarios plus an unreadable store and a stored unsupported language.
- [x] 2.6 Persist an explicit choice under `bmapp.language` and register the `languageChanged` listener that sets `document.documentElement.lang`; verify unit tests cover remembered-choice-applied, remembered-beats-browser, and the `lang` attribute following a change.
- [x] 2.7 Wrap the app in the i18next provider in `frontend/src/main.tsx`, initialising with the resolved language; verify `npm run test` passes and the app renders under `npm run dev`.

## 3. Frontend: translated interface

- [x] 3.1 Add a `LanguageSwitcher` component — a labelled `<select>` naming each language in its own language and marking the active one; verify a unit test asserts both options, the current selection, and that its own label is translated.
- [x] 3.2 Add an app-level header to `frontend/src/App.tsx` rendering the switcher above the page content; verify the switcher is present in a render of `App` regardless of the page shown.
- [x] 3.3 Replace every literal in `frontend/src/features/teams/TeamsPage.tsx` with a catalogue lookup, including the `aria-*` text and the pending-button caption; verify no user-facing literal remains by grepping the component and by the English render test passing unchanged.
- [x] 3.4 Add `code` to `ApiFieldError` and replace `ApiError.messageFor` with `ApiError.codeFor` in `frontend/src/api/teams.ts`; verify `npm run typecheck` flags every remaining caller of the old method.
- [x] 3.5 Add `translateErrorCode` in `frontend/src/i18n/apiErrors.ts` returning the catalogue message for a known code and the generic message otherwise, logging the API's `message` for a developer; verify unit tests cover a known code and an unknown code.
- [x] 3.6 Render field errors in `TeamsPage` through `translateErrorCode`; verify the duplicate-name error shows Polish text in Polish and English text in English, and that the API's English `message` appears nowhere in the DOM.

## 4. Tests

- [x] 4.1 Add a test helper that renders a component under a chosen language; verify it is used by the tests below rather than each one reaching into i18next.
- [x] 4.2 Rewrite `frontend/src/features/teams/TeamsPage.test.tsx` to assert against catalogue entries, and add the Polish counterpart of each existing assertion; verify `npm run test` passes.
- [x] 4.3 Add tests for switching to Polish and back, and for typed form text and a loaded team list surviving a language change; verify all three localization switcher scenarios are covered.
- [x] 4.4 Add a unit test comparing the key sets of both catalogues and naming every key missing from either; verify it fails when a key is removed from `pl.ts` with the annotation loosened.
- [x] 4.5 Add a test asserting a handful of actual Polish and English strings, so a catalogue wired to itself cannot pass vacuously; verify it fails if `pl` is pointed at `en`.
- [x] 4.6 Extend `frontend/e2e/register-a-team.spec.ts` with a Polish run of registration and of the duplicate-name error, forcing the language with an init script that seeds `localStorage`; verify `npm run test:e2e` passes against the Compose stack.
- [x] 4.7 Replace the English literals in the existing e2e specs with catalogue imports; verify `npm run test:e2e` still passes.

## 5. Verification and documentation

- [x] 5.1 Check the header, switcher and registration form in Polish at a narrow viewport for text that overflows or wraps badly; verify by screenshot or by running the app and fix any layout that breaks.
- [x] 5.2 Run the full gates — `uv run ruff check . && uv run ruff format --check . && uv run mypy app && uv run pytest --cov=app` and `npm run lint && npm run typecheck && npm run test && npm run test:e2e`; verify all pass and backend coverage is at or above its previous level.
- [x] 5.3 Prove the whole flow end to end under `docker compose up -d --build`: switch to Polish, register a duplicate team name, and confirm the error reads in Polish; verify by observing the running stack.
- [x] 5.4 Update `CLAUDE.md` with the conventions this change establishes — user-facing strings live in the catalogues, `pl` is typed against `en`, API field errors carry a stable code, and the Polish glossary lives in this change's `design.md`; verify the tech-stack table lists the two new dependencies.
- [x] 5.5 Note in `README.md` how to add a language and how to run the frontend in Polish; verify the instructions work from a clean checkout.
