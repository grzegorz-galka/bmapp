## Why

The header has two controls for presentation, and they look and behave differently. The theme is a single button that switches with one click. The language is a labelled native `<select>` that needs two clicks and doesn't take the header's styling. With exactly two supported languages a list box has nothing to offer, and a flag reads faster in a dense header than a word in a drop-down.

## What Changes

- Replace the language `<select>` in the header with a single toggle button styled like the theme toggle. One click switches between English and Polish.
- As the theme toggle does, the button is captioned with the language it would switch **to**: the flag and that language's own name ("Polski" while the interface is in English, "English" while it is in Polish).
- The flags are small inline SVG images: the Union Flag for English (the interface formats dates and numbers as `en-GB`) and the Polish flag for Polish. They are decorative. The language's name is always shown beside the flag, so the flag never carries meaning on its own.
- The button's accessible name says which way it switches ("Switch to Polish" / "Przełącz na język angielski"), and its description says which language is active, matching the theme toggle.
- The language list is fixed at English and Polish. A third language would need a different control, and a test makes that explicit rather than silently cycling through languages.
- No change to how the language is resolved, remembered or applied: the toggle calls the same `changeLanguage` the select did.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `localization`: "A user can change the language" is about a language control that names both supported languages. It now becomes a single toggle that names the language it switches to and announces the one that is active.

## Impact

- **Frontend**:
  - `src/components/LanguageSwitcher.tsx` is replaced by `LanguageToggle.tsx`, with a CSS module sharing the theme toggle's look.
  - New flag components.
  - New catalogue keys in `en.ts`/`pl.ts`, and `language.label` is retired.
  - Tests that drive the select (`LanguageSwitcher.test.tsx`, `App.test.tsx`, `routes.test.tsx`, and the e2e specs `hub-landing.spec.ts` and `register-a-team.spec.ts`) switch to clicking the toggle.
- **Backend, API, data**: none.
- **Dependencies**: none. No flag-icon package and no emoji, because Windows renders 🇬🇧/🇵🇱 as the letters "GB"/"PL".
- **Coordination**: the in-flight `add-authentication` change adds an account control to `AppHeader.tsx`. This change only swaps one import and one element there. Whichever change lands second rebases over a one-line conflict at most.

## Assumptions

- **The caption shows the target language, as the theme toggle shows the target theme.** The request asks for a toggle "similar to Dark/Light", and that one is captioned with where it goes. If the caption should show the active language instead, that is the one requirement to flip.
- **The Union Flag stands for English.** It matches the `en-GB` formatting the interface already uses. A US or combined flag would contradict the date and number conventions on the same page.
- **The flag is never the only cue.** The language name stays visible next to it, which keeps the control usable for anyone who doesn't recognise a flag and avoids treating a country as a language.
