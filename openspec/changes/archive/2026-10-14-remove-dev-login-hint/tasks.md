# Tasks

## 1. Remove the hint

- [x] 1.1 Remove the hint paragraph from `frontend/src/features/auth/DevLoginDialog.tsx` and the `.hint` rule from `DevLoginDialog.module.css`; verify `npm run lint` reports no unused style or import
- [x] 1.2 Remove `auth.devLoginHint` from `frontend/src/i18n/en.ts` and `pl.ts`; verify `npm run typecheck` passes and `grep -rn devLoginHint frontend/src` finds nothing
- [x] 1.3 Add the unit test "the window does not say how the password is derived" to `DevLoginDialog.test.tsx`, rendering the window in English and in Polish and asserting that the dialog's text contains neither an example password (`grgapspl`) nor the words of the old hint, and that the title, the two fields and the actions are still there; verify `npm run test` passes
- [x] 1.4 Extend the Playwright test "the window opens on a page with no session" in `frontend/e2e/sign-in-and-out.spec.ts` (or add "the window does not say how the password is derived" beside it) to assert the window shows no password rule; verify `npm run test:e2e -- sign-in-and-out` passes against the running stack
- [x] 1.5 Run the frontend gates and verify they pass: `npm run lint && npm run typecheck && npm run test`

## Workflow follow-up

- Redeploy the Railway demo frontend after merge; share the demo password with whoever is given its URL.
- Archive the change with `/opsx:archive` once merged.
