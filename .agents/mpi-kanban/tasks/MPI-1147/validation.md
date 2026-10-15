# MPI-1147 Validation

2026-10-15, agent checks (all passed):

- `npx eslint` on the 5 touched JS files: clean.
- `npm run app:isolated` (own profile, port 60918), driven with playwright-cli:
  - Landing nav reads `Library, Settings, Remote, Hotkeys, About`.
  - Library → Model Library with the switcher (title hidden), `Models` active.
  - Flows click → Flow Library open, Model Library closed, `Flows` active; Models click → back.
  - Escape closes the library.
  - `currentPage = gallery`: both libraries show the plain title, switcher hidden (after the
    `[hidden]` CSS fix — before it, the switcher showed beside the title).
  - Simulated no engine (`skipLocalEngine` + stubbed `/engine/version-check`): Flows click shows
    the "needs the ComfyUI engine" warning, Model Library stays open with `Models` still active.
- `playwright test --config=playwright.desktop.config.js` flow-queue-hotkey, flow-reuse-opens-
  without-model, gallery-drop-overlay-reset, radial-menu: 10 passed.

Pending: Fabio's look-and-feel check (verify mode user-ux).

2026-10-15: Fabio said "1" from the screenshots, then clarified he could NOT open the app (an
agent's queue was running on it). In-app look still PENDING — do not close on that "1".
