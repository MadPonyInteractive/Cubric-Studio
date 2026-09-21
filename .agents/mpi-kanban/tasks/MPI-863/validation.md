# MPI-863 validation

Commit: `e2bc81f5` — `js/core/storage.js`, `js/shell.js`, `tests/autostart-comfy-default.test.cjs`.

## What changed

- `Storage.hasAutoStartComfy()` — the third state. `getAutoStartComfy()` still defaults
  `false` (correct with no engine); `has…` says whether a value was ever written.
- `_bootApp` seeds the pref from `/engine/version-check` when it is unset and the boot is
  not a remote auto-connect. **One-way**: it writes only `true`. A `false` would freeze
  "no engine yet" in permanently for the MPI-390 escape-hatch user who installs later.
- Placed after the install gate, so a user who just installed reads as installed rather
  than as the `needsInstall` they booted with.

## Evidence

- `node --test tests/autostart-comfy-default.test.cjs` — 2 pass. Pins the tri-state
  (unset vs explicit `false`), the one-way seed, its gate, and its position after the gate.
- Pre-fix proof: `git show HEAD:js/core/storage.js | grep -c hasAutoStartComfy` → `0`, same
  for `js/shell.js`. Both tests assert on symbols that did not exist before the commit.
- `node --test tests/runpod-skip-local-engine.test.cjs tests/prompt-reuse-options-persist.test.cjs
  tests/reuse-snapshot-defaults.test.cjs` — 12 pass, the neighbouring boot-gate and
  reuse-default pins still hold.
- `npx eslint js/core/storage.js js/shell.js tests/autostart-comfy-default.test.cjs` — clean.

## CI

Run `35545481031` on `d6726460` (carries `e2bc81f5`): **success**. Card closed on that run.

## Follow-on by a peer, not a defect here

MPI-797 added a third gate to the seed block, `&& !_isE2E()`, and updated the test's regex
with it. A spec profile is always fresh, so the seed always ran under the harness; on a dev
box that HAS an engine it turned auto-start ON, boot tried to start ComfyUI inside the
harness, and the failure modal's backdrop swallowed every click for the rest of the run.
The suite is engine-blind by design (MPI-446). Correct fix, owned by that card's commit —
it landed after run `35545481031`, and the test passes with it (2 pass, re-run 2026-09-21).

## Not verified in a running app

The seed is renderer boot code; it was not watched execute in a live Electron session. The
one runtime input is `/engine/version-check`'s `needsInstall`, which three existing
`_bootApp` call sites already read the same way.

## Checked and already correct — no change needed

Reuse Prompt → "Ask Each Time" already defaults ON (`DEFAULT_PROMPT_REUSE_OPTIONS.ask:
true`, `js/core/storage.js`; `normalizePromptReuseOptions` reads `value?.ask !== false`).
Flipped by MPI-823. A store written before that flip holds an explicit `ask: false` and
keeps the old behaviour — the default is right, an individual profile may not be.
