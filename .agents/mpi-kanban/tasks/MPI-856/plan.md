# MPI-856 Plan - the cloud-only user (no ComfyUI, no Pod, a DeepInfra key)

**2.0 GATE (Fabio 2026-09-30).** The 2.0 website says cloud models need "no graphics card, no
download"; today a user who skips the engine cannot create or open a project. Member of umbrella
MPI-985 (its Phase 3).

## Current State

2026-09-30 (session 0e08597e): built and self-verified (validation.md), card `validating`,
NOT committed yet. Waiting on Fabio's look in an isolated no-engine app (launched with
`CUBRIC_BACKGROUND=0`, `CUBRIC_AGENT_PROFILE`/`CUBRIC_ENGINE_ROOT`/`APP_DOCUMENTS` all under the
session scratchpad `noengine/`; its log line "APP_DOCUMENTS set to: <real Documents>" is the OS
path only, the server got the scratch dir, `/list-projects` returned `[]`). On his "1": commit by
pathspec, push, CI, close. Kill it by the listener's PARENT pid (`scripts/launch-instance.mjs`).

## Audit (2026-09-30, two read-only sweeps, key claims re-read in the code)

- **Nothing on the project create/open path touches the engine.** `openProject` calls only
  project routes (`projectService.js:286-336`); the gate there was a UX choice (`engineGate.js`
  header: gate three doors, not every tool). The agent and MCP already create/open with no gate.
- **Every Flow runs on ComfyUI** (13 built-in + `user_flows` packages; none names a cloud model).
  Flow Library stays gated. Leak: Reuse on a Flow card emits `flow:open` directly
  (`flowService.js:347`), and the `flow:open` listener (`shell.js`) has no gate.
- **History is where cloud models work:** image cards -> cloud `edit`; video cards -> cloud `i2v`
  (incl. Extend = last frame -> i2v -> ffmpeg join). Crop, paint, composite, place, masks, video
  crop/reverse/combine, GIF maker and most of the GIF editor are sharp/ffmpeg/client: no engine.
- **Engine-only inside History:** Resize (its panel runs a ComfyUI preview ON MOUNT, so opening it
  throws the engine-start error dialog), Upscale, Remove Background, Interpolate, Detect
  (Points/Text/Auto = SAM3), Place's remove-background, GIF cut-out Background / By name.
- **Enhance and Describe default to the `comfy` backend** (`llmService.js` DEFAULT_BACKEND); the
  endpoint backend (default profile `deepinfra`) needs no engine.
- **Model Library:** its door is gated; inside, a local install would download GBs into the engine
  root with nothing to run them.
- **Settings > Restart engine** fails with no engine. Background auto-start at boot emitted
  `ui:error` from inside `ensureServerRunning`.
- **Agent tools** (upscale / remove background / resize) are advertised and fail with engine
  error dialogs; they all dispatch through `runCommand`.

## Design

One hard net where the app would START ComfyUI, so every engine action - today's and any added
later - refuses the same way, then two soft layers for the common surfaces.

1. **Hard net:** `comfyController.ensureServerRunning`, local branch, before the status fetch and
   outside its try: `hasNoEngine()` -> `ui:warning` (skipped when `background`) + throw
   `code: 'no_engine'`. The three `runWorkflow` catch sites in `commandExecutor.js` (main,
   autoMask, GIF cut-out) treat `no_engine` like `remote_transition`: settle, no bug dialog.
   Cost for an engine user: zero (`hasNoEngine` returns on the first line when skip is off).
2. **Doors:** project create + open ungated; Model Library opens (installs refused inside);
   Flow Library stays gated and the `flow:open` listener gets the same gate.
3. **Soft layer:** History rails dim Resize / Upscale / Remove Background / Interpolate with the
   reason (existing `setDisabled`, merged with the Cue-busy Resize lock). Enhance and Describe
   run on the endpoint backend when the engine is absent. Model Library install + plugin install
   and Settings Restart engine refuse with the named warning.
4. **Copy:** `NO_ENGINE_MESSAGE` names cloud models as what still works.

Not in scope (peer-held `agentDispatch.js` / `flowService.js` / `generationService.js`): the
agent's install tool and its tool list; the hard net already turns their failures into the named
warning. Noticed separately: a painted mask is silently ignored by a cloud edit.

## Verification

**Verify mode:** auto for the gate logic (unit test `tests/no-engine-gate.test.cjs`: the net
refuses with `no_engine`, warns not errors, never calls `/comfy/*`; an engine user passes with no
request), plus a desktop spec `tests/desktop/no-engine-user.spec.js` on a real Electron with an
EMPTY engine root: "+ New project" creates and opens, a landing row opens, History dims the engine
tools, an engine start refuses once with no error dialog, `flow:open` mounts nothing. Then
**user-ux**: Fabio's look at the copy (the warning, the dimmed-tool reason, the UNRELEASED line)
and at the first-launch "Remote only" card, which still names RunPod only. A paid cloud run with
no engine was already proven on the B3 Linux box (2026-09-29, $0.018, over HTTP).

## Completed

- 2026-09-30: net + doors + rail dimming + Enhance/Describe fallback + install/restart refusals +
  copy + docs (`cloud-generation.md` § The cloud-only user, `shell.md`, `agent/runpod-setup.md`)
  + UNRELEASED line. `npm test`: 2350 pass, 2 fail = `tests/llm-connection.test.cjs` Ollama rows,
  caused by live peer c2f75367's uncommitted `routes/llm.js` + `services/llmEngines.mjs`, not
  this card. eslint clean on every changed file.

## Plan Drift

- 2026-09-30: Enhance/Describe keep the stored pick and fall to `endpoint` only while there is no
  engine (`runnableBackend`); Settings still shows the stored pick (greyed ComfyUI). Left as is.
- 2026-09-30: agent install tool (`agentDispatch.js`, held by peer 26163994) can still start a
  local download with no engine; not touched.
