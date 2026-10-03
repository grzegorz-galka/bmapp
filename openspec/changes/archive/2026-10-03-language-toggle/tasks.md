## 1. Catalogues and flags

- [x] 1.1 Add `language.switchTo{En,Pl}` and `language.current{En,Pl}` to `src/i18n/en.ts` and `src/i18n/pl.ts`, with the wording from the design. Verify that `npm run typecheck` passes and that removing one Polish key makes it fail.
- [x] 1.2 Create `src/components/flags.tsx` with `UnionFlag` and `PolishFlag` as inline SVGs (3:2 viewBox, rendered 18×12, `aria-hidden="true"`, `focusable="false"`, 1px `--line-control` outline). Verify with a unit test that both render an `svg` hidden from the accessibility tree, and with `grep` that no emoji flag or external URL appears.

## 2. The toggle

- [x] 2.1 Move the theme toggle's `.toggle` and `:hover` rules into `src/components/HeaderToggle.module.css`, and import it from `ThemeToggle.tsx`, keeping `.dial` in `ThemeToggle.module.css`. Verify that `ThemeToggle.test.tsx` and `contrast.test.ts` still pass and that the theme toggle looks unchanged in both themes.
- [x] 2.2 Create `src/components/LanguageToggle.tsx`. It is a button captioned with the target language's flag and its own name (on a span with `lang={next}`), with `aria-label` from `language.switchTo<Next>`, and `title` plus a visually hidden span from `language.current<Active>`. Clicking it calls `changeLanguage(next)`. Verify that `LanguageToggle.test.tsx` holds one test per scenario of "A user can change the language": the toggle offering Polish in English, offering English in Polish, switching to Polish, switching back, keyboard (Enter and Space), the flag not being the only cue, and work in progress surviving a change. Keep the existing assertions that the document `lang` follows and that the choice is remembered under `bmapp.language`.
- [x] 2.3 Add a unit test asserting that `SUPPORTED_LANGUAGES` has exactly two entries, with a failure message explaining that a third language needs a different control. Verify that it passes, and that it fails when a third code is temporarily added.

## 3. Wiring and existing tests

- [x] 3.1 Replace `LanguageSwitcher` with `LanguageToggle` in `AppHeader.tsx`, delete `LanguageSwitcher.tsx` and its test, and remove `language.label` from both catalogues. Rebase over the current `AppHeader.tsx` first, because `add-authentication` is editing it. Verify that `grep -rn "LanguageSwitcher\|language.label" frontend/src frontend/e2e` returns nothing.
- [x] 3.2 Update `App.test.tsx` and `routes.test.tsx` to find and click the toggle by its accessible name instead of selecting an option. Verify that `npm run test` passes.
- [x] 3.3 Update `e2e/hub-landing.spec.ts` and `e2e/register-a-team.spec.ts` the same way, with names taken from the catalogues. Verify that `npm run test:e2e` passes against the Compose stack.

## 4. Verification

- [x] 4.1 Run `npm run lint && npm run typecheck && npm run test && npm run test:e2e`. Verify that all pass.
- [x] 4.2 Look at the header in the running app in both themes and both languages, at desktop width and at 400px. Verify that the two toggles read as a pair, that the Polish flag's white half is visible on the light theme, and that the header does not overflow.

## 5. Documentation

- [x] 5.1 Update `CLAUDE.md` where it says "a switcher sits in the app header" so that it describes the toggle. Verify that no mention of a language select remains.
- [x] 5.2 Write the PR description: what and why, no new dependencies, the target-caption choice, and a link to this change's `design.md`. Verify that it states the flags are inline SVG and why emoji were rejected.
