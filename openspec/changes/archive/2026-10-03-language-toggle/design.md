## Context

`LanguageSwitcher.tsx` is a labelled native `<select>` over `SUPPORTED_LANGUAGES`, which calls `changeLanguage` from `src/i18n`. Next to it in `AppHeader.tsx`, `ThemeToggle.tsx` is a single button. That button is captioned with the theme it would switch to, its `aria-label` says the direction ("Switch to the light theme"), and its `title` and a visually hidden span say the current theme. This change brings the language control into the same pattern. See proposal.md for why.

## Goals / Non-Goals

**Goals:**

- The language toggle and the theme toggle look like one pair: the same shape, border, type and hover, and an icon followed by a word.
- The toggle is as accessible as the select was: a button, a name that states the direction, the active language exposed, and keyboard operation for free.

**Non-Goals:**

- Supporting more than two languages. The toggle is a two-state control by construction.
- Changing detection, persistence or the `lang` attribute. Those requirements are untouched.

## Decisions

### Mirror `ThemeToggle` exactly, including "caption = target"

The component is a `<button type="button">` with the following parts:

- `aria-label` set to `t('language.switchTo<Next>')`, e.g. "Switch to Polish" or "Przełącz na język angielski";
- `title` and a `visually-hidden` span set to `t('language.current<Active>')`;
- the flag, then `t('language.<next>')`, the language's own name.

The span holding the name carries `lang={next}`, so a screen reader that does read the caption pronounces "Polski" as Polish rather than as an English word.

Alternative considered: a two-segment switch (EN | PL) showing both flags, with the active one pressed. It is clearer about the current state, but it needs twice the header width at 400px. It is also not "similar to the Dark/Light toggle", which is what was asked for.

### Flags are inline SVG components, not emoji and not a package

`src/components/flags.tsx` exports `UnionFlag` and `PolishFlag`. Each is a small hand-written SVG (a 3:2 viewBox), rendered at 18×12 with `aria-hidden="true"` and `focusable="false"`.

- **Emoji flags are ruled out**: Windows renders regional-indicator pairs as the letters "GB"/"PL", and the organisation's desktops are Windows.
- **`flag-icons`, `country-flag-icons` and similar packages are ruled out**: they ship hundreds of flags to draw two, which is a dependency that removes no meaningful code.
- **Bundling as files, not fetching**: the on-premise rule that keeps IBM Plex bundled applies here too. Inline SVG needs no asset pipeline and no network.

The Polish flag's white half disappears against the light theme's panel, so both flags get a 1px outline in `--line-control`, a token `contrast.test.ts` already holds to 3:1 against every surface. The button's own border uses the same token, as the theme toggle's does.

### Share the toggle's look through a CSS module, not a new component

The theme toggle's `.toggle` rule moves to `src/components/HeaderToggle.module.css`, and both components import it. The theme-specific `.dial` stays in `ThemeToggle.module.css`. Merging both controls into one generic component was rejected: they share a look but not behaviour, and the codebase's rule is no abstraction until it is needed twice in the same shape.

### "Only two languages" is asserted, not assumed silently

`LanguageToggle` computes the other language as the one supported language that is not active. A unit test asserts that `SUPPORTED_LANGUAGES` has exactly two entries, with a message saying that a third language needs a different control. Without it, adding a third language would leave a toggle that never reaches it.

### Catalogue keys

These are added under `language`, flat, as the theme's `switchToDark` / `currentDark` are. `Translations` maps exactly two levels to `string`, so nested objects do not type-check:

- `switchToEn` / `switchToPl`
- `currentEn` / `currentPl`

`language.en` / `language.pl` stay: each language's own name. `language.label` ("Language") is removed, since nothing labels a select any more.

Polish wording:

- "Przełącz na język angielski" / "Przełącz na język polski"
- "Bieżący język: angielski" / "Bieżący język: polski"

### Tests drive the button by its accessible name

Unit and e2e tests replace `selectOption` / `getByLabel(language.label)` with `getByRole('button', { name: <catalogue>.language.switchTo.<target> })`. The name comes from the catalogue, as the existing e2e helpers do, so rewording never breaks a selector.

## Risks / Trade-offs

- [The caption names the target, so a quick glance can read "Polski" as "the page is Polish"] → This is the same trade-off the theme toggle already made, and it is mitigated the same way: the tooltip and the assistive-technology description state the active language. The proposal records the assumption, so it can be flipped in one requirement.
- [A flag stands for a language] → The flag never stands alone: the language's name is always shown, and the Union Flag matches the `en-GB` formatting already in use.
- [A one-line conflict with `add-authentication` in `AppHeader.tsx`] → This change touches only the import and the element there. The task list puts it last, so it rebases cleanly over whichever version of the header is current.

## Migration Plan

This is a frontend-only change, and no stored state changes: `bmapp.language` keeps the same key and values. To roll back, revert the commit.
