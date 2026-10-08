# MPI-1046 validation

## 2026-10-08 (session 9ac7a7c7)

- `npx playwright test --config=playwright.desktop.config.js tests/desktop/no-engine-user.spec.js
  tests/desktop/llm-settings-remote.spec.js`: **5 passed** (own port 64926, the dev app on 3000
  untouched). The no-engine spec now opens Remote > Language Models with `skipLocalEngine` on, an
  empty engine root and no Pod, and asserts: ComfyUI `is-disabled` with "Needs the ComfyUI engine"
  in BOTH rows, and the describe note "runs on Remote".
- Mutation check: with `_comfyOption` forced to the enabled entry the same spec FAILS at
  `toHaveClass(/is-disabled/)` (line 98). File restored from a copy, grep-confirmed.
- `npx eslint js/components/Organisms/MpiLlmSettings/MpiLlmSettings.js`: clean.
- `llm-settings-remote.spec.js` (engine present) still green: ComfyUI enabled there.

Ships in the same commit as MPI-1045 (same file, and MPI-1045 is what removed the old gate).
