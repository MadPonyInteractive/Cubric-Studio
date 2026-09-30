# MPI-856 validation

## Automated (2026-09-30, session 0e08597e)

- `node --test tests/no-engine-gate.test.cjs`: 5/5. The net refuses with `no_engine` and ONE
  warning, no `ui:error`, no `/comfy/*` request; background start refuses silently; skip on +
  engine installed passes; an engine user (skip off) makes no request; `runnableBackend` falls
  `comfy` -> `endpoint` only with no engine.
- `npx playwright test --config=playwright.desktop.config.js tests/desktop/no-engine-user.spec.js`:
  1 passed, real Electron, EMPTY `CUBRIC_ENGINE_ROOT`, skip on. "+ New project" creates and opens,
  a landing row opens (no warning, no error), History rail shows the dimmed-tool reason, an engine
  start refuses once with no error dialog, `flow:open` mounts no Flow.
  **Proven RED** with the net disabled (`if (false && ...)`): `Expected "no_engine", Received
  "started"`; restored, green again.
- `npm test`: 2350 pass / 2 fail / 2 skip. Both failures are `tests/llm-connection.test.cjs`
  Ollama rows, from live peer c2f75367's uncommitted `routes/llm.js` + `services/llmEngines.mjs`
  (files this card never touched).
- eslint: clean on all nine changed source files.
- A paid cloud generation with no engine and no Pod: already proven 2026-09-29 on the B3 Linux
  box over HTTP (`flux2-dev-cloud`, $0.018). Not re-run.

## Fabio's look, round 1 (2026-09-30)

- Found: creating a project with no engine AND no key raised the zero-model popup "No models
  installed ... Go back to the Projects page to install one", whose only button left the project
  (MpiGalleryBlock `_promptInstallModels`). Installing is the one thing this user cannot do.
- Fixed: with no engine it reads "No models yet" and offers **Add a DeepInfra key** (opens the
  Remote panel, Language Models first, stays in the project; a saved key fires `models:checked`
  and the gallery watcher mounts the PromptBox) or **Go to Projects**. Engine users unchanged.
  Desktop spec extended to click it: 1 passed. Test copy relaunched on port 52031.

## Fabio's look, round 2 (2026-09-30)

- New popup offered the key; with no key the project is usable read-only and the agent tells him
  to set up Remote ("the experience is not bad"). Key stored 07:30:42Z, cleared 07:31:46Z,
  re-stored 07:33:08Z (test-copy app.log).
- Desktop spec step 6 added: a dummy key saved in the test's OWN user-data (per-profile
  `runpod-secrets.json`, never the user's) puts cloud ids into `s_installedModelIds` with no
  restart. 1 passed.

## CI (closes the card)

Tests run 36685592716 on `d5a783ce7` (the code commit): **success** - unit, desktop shards 1-4.

## Fabio's verdict (2026-09-30): "1"

In the isolated no-engine copy, with his key: the in-app agent ran FLUX Schnell (Cloud) t2i
(~$0.0005) and Seedance 1.5 Pro i2v, 8 s at 480p (~$0.10), both landed as cards; the video opened
in History and an engine tool raised the named warning ("This needs the ComfyUI engine, which is
not installed. Cloud models still work..."). Spend shown in the agent header: agent $0.006,
generations $0.10, his own key, his own runs.

His call, same message: add the DeepInfra line to the first-launch "Remote only" card - done as a
fourth fact, "Or use cloud models on your own DeepInfra key, paid per run"
(`MpiEngineInstall.js` CHOICE_REMOTE_FACE); eslint clean, no test asserts that copy.
