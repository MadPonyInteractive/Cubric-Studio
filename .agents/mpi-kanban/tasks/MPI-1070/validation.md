# MPI-1070 validation

## 2026-10-11 - verified (auto)

- `npx playwright test -c playwright.desktop.config.js tests/desktop/no-gpu-pod-project.spec.js`
  - 1 passed. Drives the real UI with a faked No GPU Pod (renderer mirror) plus a faked
  DeepInfra key:
  - "+ New project" creates and opens the project.
  - The engine toggle is visible, active and disabled, `engineOverride === 'local'`, and the
  install check went to `/comfy/models/check-local`.
  - Going home clears the override. Opening the landing row re-locks it.
  - Connecting a GPU Pod instead lifts the lock and re-enables the toggle.
  - There is no "download-only Pod" warning anywhere.
- The neighbouring desktop specs passed (8 of them): prompt-box-badge, prompt-box-peek,
  prompt-box-use-tiles, prompt-box-video-ref, prompt-box-voice, no-engine-user and
  history-prompt-model.
- `landing-grid-release.spec.js` fails with `ENOENT ... project\project.json`. It fails
  identically with HEAD's `projectUI.js` + `MpiPromptBox.js` swapped back in, so it is
  pre-existing and not caused by this card.
- `node --test tests/download-mode-pod-guards.test.cjs`: 5/5 pass, so the MPI-539 local
  routing is unchanged.
- `npx eslint js/shell/projectUI.js js/components/Organisms/MpiPromptBox/MpiPromptBox.js`
  is clean.

## Close

- The CI tests.yml run 38094634698 on `7dcac288b` succeeded.
- The claim auditor proved all 7 of the commit's claims, with no findings.
