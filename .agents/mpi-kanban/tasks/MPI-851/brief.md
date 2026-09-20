# MPI-851 — the cloud executor

**Umbrella:** MPI-849 phase 1. Runs in parallel with MPI-850; they share no file. Everything
in phase 2 depends on this card.

**Verify mode:** `user-ux`.

## The seam is one line

`js/services/generationService.js:903` — `const exec = runCommand({`.

Above it: media and mask guards, the frozen origin project, the control snapshot. All
provider-agnostic. Below it, `:942`–`:1647`: save, sidecar, gallery card, notifications,
terminals — already written against a generic `exec` and containing no ComfyUI assumption.

```js
const exec = (model.provider ? runCloudCommand : runCommand)({ … });
```

**Branch before `runCommand`, never inside it** — `comfyController.runWorkflow` calls
`ensureServerRunning`, so a cloud call would cold-start a local engine for nothing.

`runCloudCommand` returns `{ genId, jobId, seed, cacheHit: false, promptId, cancel() }`, calls
`onPromptAck` when the POST is accepted, then exactly one of `onComplete` / `onError`. It
**must** `generationStore.register(…)` and reach a terminal phase on every exit path, or it
wedges its lane permanently.

**Progress: there is nothing to stream.** One blocking POST. Use `tool:indeterminate`, already
shipped for ESRGAN upscale — `active: true` at submit, `false` at settle. The other `tool:*`
events come free from `startGeneration`.

## The second seam worth taking

A `provider`-aware early return in `isModelUsable` / `isOperationInstalled`
(`js/data/modelRegistry.js:486`, `:534`) answering **"installed = a DeepInfra key exists"**,
before the dep-status cache is consulted, covers most of the install gates in one edit.

## Four traps, each verified in the tree

1. **Two lanes only.** `generationStore.js:73` `const LANES = ['local','remote']`, and
   `remote` means the user's Pod. A cloud job there blocks a Pod generation and shows a badge
   that lies. Needs a third `cloud` lane; `tests/lane-agreement.test.cjs:10-19` encodes both
   rules as literals — change it deliberately, it is the guard.
2. **A zero-dep model reads INSTALLED twice, by accident.** `resolveModelDeps.js:505`
   (`[].every()` is `true`) and `routes/comfy.js:1017` (`allPresent = true` with a loop that
   never runs). Green tick, 0 GB, working-looking Uninstall button, and a user with no key
   gets a card that fails at the HTTP call.
3. **`save-generation` hard-requires `comfyViewUrl`** (`routes/projects.js:1930`) and derives
   the extension from its `?filename=`, defaulting to `png`. DeepInfra returns **base64**, and
   **JPEG on lite but PNG on NB2/Pro**. Pre-stage the bytes or pass an explicit extension.
4. **`tests/resolve-model-deps.test.cjs:232`** asserts `universe.length > 0` for every model.
   A weightless ModelDef fails `npm test` there. That assertion is the right place to declare
   the new shape — with a negative control, per `dos_and_donts.md` § Tests.

Also: the **Run-locally toggle** is derived for every job and would push a cloud job onto the
local lane; **cancel is not a refund** (a stopped cloud job that still returns output saves the
card and bills), and the UI has to say so or it reads as a bug.

## The cost comes back free

`inference_status.cost` on the **native** `/v1/inference` route — the OpenAI-compatible routes
return only `created` and `data`, so dispatching there loses the cost. Write it to
`generationSettings.cost`, which passes through `save-generation` **verbatim** and is spread
back by the reconciler, so it survives disk and reload with zero server edits. Five sidecar
writers share the shape; a cost missing from any of them under-reports the ledger.

## Verify

One real FLUX-1-schnell generation ($0.0005) lands a gallery card with history and a sidecar
carrying its true cost. `npm test` green including the two tests this card changes. With the
key cleared, the same dispatch bails through `_failBail` with actionable copy and the lane
settles — verified by `tests/lane-settle-on-bail.test.cjs`.
