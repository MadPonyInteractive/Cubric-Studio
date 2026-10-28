# MPI-1321 validation

- `tests/dev-updates.test.cjs`: the boot fetch announces nothing, a new post announces only itself, the same feed again announces nothing. Pass.
- `npm run lint` + `npm test`: 3790 pass, 0 fail.
- Live, own `app:isolated` instance (scratch profile + APP_DOCUMENTS): inside a project (`currentPage: gallery`) an arrival shows the toast "Dev update: Cubric Studio 2.1.4 is out now" with View changes; pressing it lands on `landing` with the Dev updates panel open and the toast gone.
- Fabio 2026-10-28 clicked it himself in the pane: "It looks good." One button (View changes) is the call: the panel already carries the Update button, so no second one on the toast.
