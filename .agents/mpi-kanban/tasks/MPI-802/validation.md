# MPI-802 Validation

## What changed

- `js/core/storage.js` — `DEFAULT_PROMPT_REUSE_OPTIONS.ask: true` and
  `normalizePromptReuseOptions` reads a missing `ask` as `true` (`!== false`).
- `js/core/storage.js` — `DEFAULT_RUNPOD_CONFIG.stageOnConnect: true` and
  `normalizeRunpodConfig` reads a missing key as `true`.
- `js/components/Organisms/MpiRunpodSettings/MpiRunpodSettings.js` — the plate copy said
  "Off by default"; now says "On by default". It was the only user-facing string naming a
  default (the Reuse "Ask each time" plate names none, so MpiSettings.js was left alone —
  a live peer session held a write claim on it).

## Evidence

Fresh-store check (node, stubbed `localStorage`, importing the real `js/core/storage.js`):

    OK: both defaults ON, explicit false respected

Asserted three cases per setting: empty store -> ON; explicit stored `false` -> OFF;
a stored object missing the key -> ON. `npx eslint` clean on both changed files.

## Scope note

Every store the app has ever written carries an EXPLICIT boolean for both keys
(`normalize*` writes them on every save), so this flips the default for fresh installs and
for a corrupt/cleared store only. An existing install keeps whatever it last stored — the
toggle in Settings is the way to change it there.
