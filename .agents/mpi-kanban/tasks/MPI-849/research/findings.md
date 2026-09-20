# MPI-849 research — four read-only investigations, 2026-09-20

Four parallel sub-agents swept the seams this umbrella touches. Every `file:line` below was
re-verified by hand against the tree before this file was written; the spot-checks are named
where they mattered. The measured DeepInfra half lives in
`docs/proprietary-models-research/01d-deepinfra-image-video.md` and is not repeated here.

---

## A. The executor seam

**The funnel is `enqueueGeneration` — `js/services/generationService.js:499`.** Eight producer
call sites, not the three the docs imply: `MpiGalleryBlock.js:759,810,937,1529,1575`,
`MpiGroupHistoryBlock.js:2111,2131,2157,2202,2254`, `flowService.js:233`,
`agentDispatch.js:304`, `llmService.js:646,912`, `MpiStepCutout.js:531`, and the loop re-fire
at `generationService.js:353`. Bypasses that never reach it: `MpiToolOptionsResize.js:614`,
`commandExecutor.js:905` (`runAutoMask`), `commandExecutor.js:1070` (`runGifCutoutTrack`).

**THE SEAM IS ONE LINE — `js/services/generationService.js:903`, `const exec = runCommand({`**
(verified). Everything above is provider-agnostic: media/mask guards (`:855`, `:879`), frozen
origin project (`:871`), control snapshot frozen back at enqueue (`:532`). Everything below —
`:942` to `:1647`, the whole save / sidecar / card / terminal path — is already written
against a generic `exec` object and contains no ComfyUI assumption. Branch the **factory**:

```js
const exec = (model.provider ? runCloudCommand : runCommand)({ … });
```

`runCloudCommand` must return `{ genId, jobId, seed, cacheHit: false, promptId, cancel() }`,
call `onPromptAck` when the POST is accepted, then exactly one of `onComplete(urls, {…})` or
`onError(err)`, and **must** `generationStore.register(…)` and reach a terminal phase on every
exit path or it wedges its lane forever.

Branch **before** `runCommand`, never inside it: `comfyController.runWorkflow` calls
`ensureServerRunning` (`js/services/comfyController.js:1344`), so dispatching a cloud job
through it cold-starts a local ComfyUI for nothing.

### The second seam worth taking

A `provider`-aware early return in `isModelUsable` / `isOperationInstalled`
(`js/data/modelRegistry.js:486`, `:534`) answering *"installed = a DeepInfra key exists"*,
taken before the dep-status cache is consulted, covers install gates 3-7 and 15-18 in one
edit, because they all reach the weights predicate through `modelRegistry`.

### ModelDef

One array, 1823 lines, `js/data/modelConstants/models.js`, typedef at `:2-34`. **There is no
`provider` or `runtime` field anywhere today.** A cloud entry needs: the DeepInfra model
string per op (the moral equivalent of `workflows[op]`), a param mapping (app `Input_*` →
DeepInfra body fields), and a pricing block; and it must declare **no** `dependencies`,
`commonDeps`, `operations`, `workflows`, `engines` or `variants`.

**Keep per-op endpoint data OUT of `operations`.** `installedOpsForContext`
(`modelRegistry.js:560-564`) returns `null` for a model with no `operations`, which makes the
op strip fall back to static `supportedOps` and work correctly. Give a cloud model an
`operations` block and it starts consulting the dep cache at `:563` and every op vanishes.

### Type-consumer sweep (everything that switches on model identity)

*Weights/install axis:* `modelRegistry.js:486,534,560,582,609,121-145,455,412` ·
`resolveModelDeps.js:503,477,247,282,294` ·
`commandExecutor.js:1451,1474,1504,1583,1599,1608` ·
`MpiModelManager.js:270,329,348,375,519,535,579,623` · `footprint.js` ·
`routes/comfy.js:1009` · `routes/remoteModels.js:285` · `routes/connector.js:80,897-918`.

*`model.type` axis (the add-model playbook's own sweep, `docs/playbooks/add-model/03-model-registry.md:101-127`):*
`ratios.js:603,639,644,737,776` · `promptReuse.js:289,352,404,409` ·
`generationService.js:461` · `MpiOptionSelector.js:25,46,71,164,175` ·
`MpiModelSettings.js:63,577-591` · `recipes/registry.js:80` + `llmService.js:736` ·
`llmService.js:521-541`.

*Op-availability axis:* `commandRegistry.js:1601,1650` · `MpiPromptBox.js:242-268` ·
`MpiGroupHistoryBlock.js:370` · `modelHelpers.js:90` · `agentService.js:88` ·
`agentDispatch.js:225,706,728,782`.

---

## B. Traps that make a naive executor wrong

1. **Two lanes only, hardcoded in three places.** `generationStore.js:73`
   `const LANES = ['local','remote']` (verified), `_laneOf` at `:115`,
   `generationService.js:85` and `:375`. A cloud job on `'remote'` **occupies the RunPod lane**
   — one DeepInfra call at a time, blocking a concurrent Pod generation — and anything that is
   not `'local'` falls back to `'remote'` anyway. Needs a third `'cloud'` lane.
   `tests/lane-agreement.test.cjs:10-19` encodes both rules as literals (verified) and will
   fail; change it deliberately.
2. **A zero-dep model reads INSTALLED by accident, twice.** `resolveModelDeps.js:505`
   `ids.every(...)` and `[].every() === true` (verified); `routes/comfy.js:1017` sets
   `allPresent = true` and never enters the dep loop, answering `installed: true` at `:1040`
   (verified — note it only applies when `deps` is an empty **array**, since a non-array short
   -circuits to `installed: false`). Result: a green tick, 0 GB and a working-looking
   Uninstall button on a model that downloads nothing. The gate does not need teaching to
   pass — it needs teaching to ask a different question.
3. **`save-generation` hard-requires `comfyViewUrl`** — `routes/projects.js:1930` returns 400
   without it (verified), and `:1976-1980` derives the extension from its `?filename=`,
   defaulting to `png`. DeepInfra returns **base64 in `data`** for images and **JPEG on lite,
   PNG on NB2/Pro**, so a naive save writes `.png` holding JPEG bytes. Pre-stage the bytes
   (`POST /project-media/:id/place-preview-asset`) or add an explicit extension.
4. **`_failBail`'s eleven bails are a load-bearing contract** — `commandExecutor.js:1416`,
   bounded by `tests/lane-settle-on-bail.test.cjs`. A "no key" / HTTP 402 bail must settle to
   `PHASES.ERROR` **then** report, in exactly that shape.
5. **The Run-locally toggle is derived for every job.** `generationService.js:557`,
   `:939`. With it on, a cloud job gets `forceLocal: true`, lands on the local lane and hits
   `_findModelNotLocal` (`commandExecutor.js:1583`). Hide or inert it for a cloud model
   (`MpiPromptBox.js:2643,2652`).
6. **The Cue badge will lie** — `generationService.js:236`, `:282` label a job `remote`, which
   in this app means the user's Pod.
7. **Cancel is not a refund.** `generationStore.cancel` fires `engine.interrupt()` +
   `deleteQueueItem` (`commandExecutor.js:1373-1387`); a blocking POST has neither. A stopped
   cloud job that still returns output saves the card **and bills**. Say so in the UI.
8. **Completion toasts coalesce off `state.generationQueueCount`**
   (`docs/generation-lifecycle.md:238-242`) — free if the job registers in the store, absent
   if it does not.
9. **The agent path refuses by name, not by toast** — `agentDispatch.js:225`,
   `routes/connector.js:459`. A "needs a key" refusal must be a coded error an agent can read.

### Progress: there is nothing to stream

DeepInfra is one blocking POST. The existing answer is **`tool:indeterminate`**, already used
for ESRGAN `imageUpscale` (`commandExecutor.js:2202`): emit `active: true` at submit, `false`
at settle. `statusBar.progress.cancel()` no longer strands the pulse
(`tests/status-bar-idle-clears-pulse.test.cjs`). `tool:running`, `tool:accepted`,
`tool:cancelled` and `tool:idle` all come free from `startGeneration`.

### The sidecar takes a cost with ZERO server edits

`routes/projects.js:2072-2074` passes `meta.generationSettings` through **verbatim** and
writes it at `:2148`; `projectReconciler.js:76` pushes the whole sidecar object back as the
in-memory item with no whitelist; `projectModel.js:82,112,143` are `{...defaults,...overrides}`
spreads. So `generationSettings.cost = { usd, provider, model, checkedOn }` survives dispatch →
disk → reload with no code change. `SCHEMA_VERSION` versions `project.json` only
(`appVersion.js:19`); sidecars carry no version and no validator.

**But five writers share the shape** and a cost must be added to all of them or a
sum-the-sidecars readout silently under-reports: `routes/projects.js:2131-2163` (the main
one), `:1420-1422`, `:2512-2575`, `:2727-2768`, `:2323-2364`.

---

## C. The price tag in the prompt box

**Mount:** a new `__col` immediately before `#bottom-right-slot` at `MpiPromptBox.js:122`.
Copy `#engine-toggle-slot` (`:121`) for the column + `hide` pattern and its `_showEngineToggle`
(`:2654-2660`) gate; copy `.mpi-prompt-box__badge-batch` (`:1704-1706`, CSS
`MpiPromptBox.css:313-319`) for the inner text — `var(--t-xs)`, `var(--accent-heat)`,
`tabular-nums`. **Never mount inside `#bottom-right-slot`**: `_renderRunCluster` does
`runSlotEl.innerHTML = ''` (`:2330`).

**Grid trap:** `MpiPromptBox.css:4` declares exactly 8 tracks (verified:
`auto 1fr auto auto auto auto auto auto`). A 9th column with no 9th track reflows the bar.
Agent mode declares its own 5-track grid at `:132-133` and `display:none`s the dropped columns
at `:136-143` — the new column must join that `:is()` list.

**Recompute here, not on events alone:** `_refreshOpSlot()` (`MpiPromptBox.js:1924-1987`) is
the single convergence point for every path that reassigns model or operation, and it
destroys and rebuilds every control, so **Width/Height can change with no event at all**. Also
hook `_emitMediaChange()` (`:446-488`), which every reference add / remove / reorder /
role-swap / prune routes through, ending in `emit('media-change', …)` at `:487`.

**Events that exist:** `settings:shared:update` (`PromptBoxControls.js:104-108`, carries
`ratioSelector`, `duration`, `batch`), `settings:model:update` (`:84-101`, carries
`qualityTier`, the turbo toggles, `upscaleFactor`), `ratio:selection-change` (`:271`),
`ratio:orientation-change` (`:279`), `ratio:quality-change` (`:185`,`:192`),
`state:changed`/`s_selectedModelIdByType` (`state.js:234-247`), `models:checked`
(`MpiPromptBox.js:2616`).

**Pixel dimensions:** `PROMPT_BOX_CONTROLS.ratio.getInjectionParams()` returns real
`{Width, Height, Ratio_Label}` — `PromptBoxControls.js:301-309` (verified). The shared
resolvers are `resolvePlannedRatio(project, model, overrides)` →
`{width,height,label,qualityTier}` (`js/data/generationControls.js:169-188`) and the pure
`resolveRatioDimensions` (`:134-143`). Seconds → frames already exists:
`effectiveDuration(model, wanted)` → `{seconds, frames, inTrainedRange}` (`:299-308`).

### The two traps that break the formula outright

- **Edit ops have NO pixel dimensions.** `modelShowsRatio(model, operation)` returns false
  when the op is listed in `model.imageSizedOps` (`commandRegistry.js:1521-1524`, verified),
  so the ratio control is not mounted and `injectionParams` carries no Width/Height. Klein's
  `kleinEdit` and `depth` do exactly this — output inherits the **source image's** size.
  A megapixel price then reads `$0.00` or a silently wrong number on every edit op. The true
  area is only knowable by probing the staged chip; `deriveResizeDims` (`ratios.js:836-848`)
  is the only existing helper and needs `srcW`/`srcH` the PromptBox does not hold.
- **There is NO steps control anywhere** (verified — `PROMPT_BOX_CONTROLS` exposes none; the
  only "steps" strings in `PromptBoxControls.js` are turbo descriptions). Real counts live
  only in comments at `js/data/promptControlDefaults.js:37-48`. So the formula's
  `steps / default_iterations` term **has no live input** and must come from a new ModelDef
  field, keyed off `resolveTurboControlId(model)` (`generationControls.js:201-205`) where a
  turbo toggle exists.

Other traps: `settings:model:select` is **Gallery-only** (`MpiGalleryBlock.js:1791`,`:1342`;
`MpiGroupHistoryBlock` never emits it) · `pb.on('model-change')` fires only when the model
vanished from the list (`MpiPromptBox.js:834`), not on a normal pick · `state.promptMedia` is
not a media mirror (no writes in History, `MpiPromptBox.js:226`; blob: urls dropped at `:228`)
· the state Proxy is shallow, so any new price state is a top-level replace ·
`projectService` debounces the project write ~300 ms, so re-reading `state.currentProject`
right after a `settings:*` emit gets the pre-edit value — read `getRunPayload()` or the event
payload · `_activeControls` is closure-private (`:271`), the only door is `el.getRunPayload()`
(`:2275`), which is the strongest argument for the price line living **inside** `MpiPromptBox`
· agent mode with the cog shut resolves settings from model defaults, not the controls, so
`resolveNamedParams` (`generationControls.js:359`) is what actually applies · the price must
hide or zero when `state.engineOverride === 'local'` (`MpiPromptBox.js:2652`).

**The gating pattern to copy** is the three-layer "op not installed" one: absent from the strip
(`_ctxWithInstalledOps`, `MpiPromptBox.js:242-268`), dim via `aria-disabled` not the disabled
attribute (`docs/component-contracts.md:82`), then a hard net at dispatch with a `ui:warning`
(`commandExecutor.js:1449-1464`).

---

## D. The Model Library's paid section

`MpiModelManager` is an **Organism** (`js/components/Organisms/MpiModelManager/`, 1618 lines),
mounted lazily by `js/shell.js:481-488`. `renderList()` at `:1321-1374` is the pipeline;
**section order is literal call order**, there is no ORDER table. `_pluginSection()`
(`:1306-1316`) is the precedent — a third, non-model section appended after the two model
sections, deliberately outside the media/tier filters and outside the "N available" count
(rationale at `:1173-1188`).

**Four additive edits:** exclude paid from `visible` at `:1336` and from the counts at
`:1348`; add `_paidSection()` modelled on `_pluginSection()`; call it at `:1366` **and** at
`:1360` inside the empty branch (or it vanishes on any search matching no local model); append
a paid segment to `_listSignature()` (`:1043-1084`) or the section never repaints when the
user saves a key.

**The tile.** `MpiTileSheet` is state-dumb by contract (`:30-33`) — the consumer hands the
bottom row over as an HTML string in `item.state` (`:193-195`). Build the item **without
calling `_modelState`**. `_tileState` (`MpiModelManager.js:640-694`) falls through to an
`Install` chip at `:693`, and `_install` (`:394`) is `if (!dependencies.length) return;` — so a
paid tile would render Install and the click would do **nothing**, silently. Add a new
`.mpi-tile__chip--paid` modifier beside `MpiTileSheet.css:215-223`; do **not** reuse
`--available`, whose `::before` literally draws a download arrow (`:217-218`).

**Hero count inflates on both sides** — `heroStats.js:65` prints
`installedCount / MODELS.length`, and `modelRegistry.js:257-258` → `isModelUsable:500`
(`model.installed !== false`) makes a paid model count as installed.

**THE HARD BLOCKER: `tests/resolve-model-deps.test.cjs:232`** asserts
`universe.length > 0` for every model in `MODELS` (verified). A weightless ModelDef fails
`npm test` there. That assertion is the right place to declare the new shape, with a `paid`
exemption and a negative control. Two more fleet audits bind every new ModelDef:
`tests/recipe-registry.test.cjs:138-152` (every model's `enhanceRecipe ?? type` must resolve a
real recipe) and `tests/agent-corpus.test.cjs:135-140` + `:120-122` (every model needs
`docs/agent/models/<recipeId>.md`, and every `t2i` model must appear in the agent corpus).

**The orphan sweep is SAFE — checked, do not "fix" it.** `_orphanedDepIds`
(`routes/downloadManager.js:304-318`) iterates `Object.keys(DEPS)`, not `MODELS`, so a model
declaring no deps adds and removes nothing. `_localSharedDepsMap` (`:189-282`) already filters
`depIds.length > 0` at `:196-199` and drops a depless model before the check payload. Same on
the remote twin (`:465-541`). The docs' prohibition is against **deleting a DEPS entry**,
which is a different edit. `docs/download-manager.md:155-198` is emphatic that a second notion
of "orphan" is how MPI-310 destroyed 5.24 GB — the correct edit is upstream (exclude paid from
the library and the counts), never inside the guards.

**The library is gated shut with no engine** — `js/shell.js:486` `blockedByNoEngine()`
(verified), MPI-390's reasoning at `:482-485` covers *installing* only. A user with no engine
is exactly the user who wants cloud models, and today cannot reach them. Product decision.

**Prerequisite pattern to copy:** `_needsLicenceProof(model)` (`:699-702`) — derived state,
never stored, changing exactly two surfaces (the tile chip at `:690-692` and the drawer's
button label at `:977-980`). The argument at `docs/model-library.md:158-180` — *"Install…
promises a download and delivers a legal wall"* — is verbatim the argument for a paid tile.
Key presence is readable from the renderer: `js/core/secretsClient.js:177`
`hasEndpointKey(profileId)`.

**Where a `paid` flag belongs:** on the ModelDef, and it is **not** the same kind of thing as
`featured`/`deprecated`, which are editorial, static and deliberately out of the render
signature (`docs/model-library.md:59-71`). `paid` is a structural discriminator. The licence
precedent (`docs/download-manager.md:329-334`) chose a side table over a ModelDef field
because *"models.js is already the biggest data file in the app"* — worth following if the
price metadata grows past two fields.

**Dep-graph edits are not live until the server restarts** — `docs/download-manager.md:180-188`;
a Ctrl+R renderer reload does not clear `createRequire`'s cache of `models.js`.

---

## E. The key, the spend readout and the agent confirm

### The key — the channel name in the older docs was WRONG

`secrets:get-deepinfra-key-request` **does not exist in shipping code** (verified: the only
occurrence in the tree is a dead branch of `tests/llm-service.test.cjs:324`). Both
`00-cubric-vision-integration-points.md:78` and an earlier draft of `01d` carried it; both
fixed in `4af0e8ef`. The live channel is **`secrets:get-endpoint-profile-request`**
(`main/secretsStore.js:407-431`, `services/llmEngines.mjs:560`), and the main process **nulls
the key when `boundURL !== profile.baseURL`** (`:418-427`).

Server-side reuse is three lines, copied from `routes/llm.js:113-117`:
`const { profile, key } = await resolveConnection(profileId, ask);` then `NO_PROFILE` /
`NO_KEY` errors. No new IPC, no new secret field, no `secretsStore.js` edit. Env fallback
(`services/llmEngines.mjs:556-570`) is DeepInfra-URL-gated and comes free. There is **no get
channel** for endpoint keys by design (`main/secretsStore.js:363-364`) — set/has/clear only.

**THE PRODUCT FORK:** since MPI-774 the app holds the **`deepinfra` profile's** key, and
`docs/llm.md:19-21` says there is exactly ONE user-picked connection. A user on OpenRouter or
Ollama has no DeepInfra key at all. Either paid generation follows the picked connection (then
it is unavailable on 4 of 5 presets) or it pins `profileId: 'deepinfra'` independently (then
Remote settings needs a DeepInfra key field they may never have filled).
`hasEndpointKey('deepinfra')` (`main/secretsStore.js:280`) is the presence check either way.

### Spend readout

Mount a fourth `.mpi-settings__form-group` at the foot of the **"Remote connection"** subgroup
in `MpiLlmSettings.js`, after `#mpiSettingsConnProbeSlot` (`:135-138`). Copy `_renderConnProbe`
(`:711-724`) line for line: a `_conn()`-registered `MpiButton` plus a `.mpi-settings__hint`
written by `_setText`, `_errorText` (`:795-801`) for the failure path, hidden when
`profileId !== 'deepinfra'` the way `_renderConnKey` hides for `ollama` (`:671-673`). **Make
the user's click the request** — do not auto-fire `/payment/checklist` on open. Money-in-UI
precedents: `heroStats.js:123-143`, `MpiRunpodSettings.js:1536-1556`.

**There is no cost ledger anywhere today** — grep for `payment`, `balance`, `spend`,
`estimatedCost` across `routes/ services/ js/` returns nothing. And the provider's own usage
object **is already reaching the app and being thrown away**: `services/llmEngines.mjs:644-656`
returns `usage: data.usage ?? null` with a comment at `:651-653` naming DeepInfra's
`estimated_cost`; `agentLoop.mjs:432-433` reads only `prompt_tokens` for the compaction
trigger.

### SECURITY — the billing hazard

`GET /payment/checklist` returns the billing address and card last4 beside the balance.
**`routes/secretRedaction.js:6-16` cannot help**: it is five regexes for key-shaped strings,
and a regex for a name, a street, a postcode or a 4-digit last4 is not writable. Only
field-picking is a mitigation.

Leak paths that exist *despite* the scrubber: `routes/logger.js:37,100-101` (anything passed
to `logger.*`) · `js/services/clientLogger.js:19-29` → `routes/system.js:250-259` (a renderer
catch block becomes a server log writer) · **`routes/system.js:371-383` builds a public GitHub
issue URL** from a `ui:error` message via `MpiErrorDialog.js:169` · `services/llmEngines.mjs:638-642`
already attaches the whole error body as `err.bodyText` on any non-ok chat ·
`routes/runpodRemote.js:52-55` keeps an unparseable upstream body as `{raw: text}` ·
`js/services/comfyController.js:1776` proves a response body *does* reach `MpiErrorDialog` ·
logs are exfiltratable by design (`routes/system.js:263,279,302`, 20 × 256 KB archives).

Good news: **no request/response-body middleware exists** (`server.js:36-105` — no morgan, no
body logger), so the exposure is entirely in what a new route chooses to do.

**The established safe pattern** is to build a new object at the route and name every field:
`sanitizePodJson` (`routes/runpodRemote.js:68-77`) with its whitelist projection at `:325-334`,
and the purest example, `routes/remotePodLifecycle.js:1358-1380`, which reads a fat upstream
object and answers **five named scalars**. Also `_safeFetch` (`routes/runpodRemote.js:81-89`),
which rebuilds a thrown error so a key cannot ride out in `err.message`.

### The agent confirm

Emitted at `services/agentLoop.mjs:888`
(`kind: 'install', modelId, modelName, downloadGb`), the turn suspends on a promise at
`:892-894`, route at `routes/agent.js:202-215` which validates only `confirmId` + `yes` and is
**kind-blind** (`agentSessions.mjs:103-105`), resolved at `agentLoop.mjs:1519-1553`, card at
`MpiAgentChat.js:201-259`.

**`kind` is not an enum and would not be rejected — it is simply never read.** Written once at
`agentLoop.mjs:888`, and `MpiAgentChat.js:351` drops it; `:213` hardcodes
`Install ${modelName}?`. So a new kind produces a **wrong card, not an error**. (Verified: the
only `kind ===` comparisons in `MpiAgentChat.js` are history entry kinds at `:474-486`, a
different field.)

Six edits: emit the new kind with the estimate and put the whole pending call on
`_pendingConfirm`; add the fields to the `pendingConfirm` projection at `:431-438` **or a
reload repaints the card with no price and the Yes button still spends**; branch `confirm()`
at `:1519-1553` on `pc.kind`, defaulting to `'install'`, and stop the decline text at `:1524`
saying "installation"; branch the card in `MpiAgentChat.js:201-259` and pass `data.kind` at
`:351` / `pc.kind` at `:503`; update `js/events.js:134`,
`.claude/rules/component-events-primitives.md:358`, `.claude/rules/component-mounts.md:350`,
`docs/agent-chat.md:45,67,155`; and **nothing** in `services/agentTools.mjs`.

**The gate goes at `agentLoop.mjs:924`** — after the existing gates, before the body build and
well before the fire at `:1004`, because `generate()` is fire-and-almost-forget and the
`:1005-1018` race only learns whether it was *refused*.

**Four paths bypass an agentLoop-only gate:** `POST /connector/generate`
(`routes/connector.js:435`) has no consent gate at all, deliberately — the sibling install
route says so at `:904-915` and `docs/agent-chat.md:114-115`, *"a CLI agent's user is its own
gate"* — and that is the path the shipped `cubric-vision-generate` skill takes; the user's own
Cue press through `enqueueGeneration`; the Flow branch (`agentDispatch.js:412`) where
`model.id` is null; and the GIF capabilities (`agentDispatch.js:871-872`). Plus
**crash-requeue re-spends**: `unfinished-generations.md` is written at submit
(`agentLoop.mjs:1021`, `docs/agent-chat.md:172-179`) precisely so a closed app can requeue the
exact call.

**`tests/agent-no-delete.test.cjs:97-139`** drives every `agentTools.mjs` export against a
real throwaway server and asserts each observed `METHOD /path` is in `ALLOWED_REQUESTS`
(`:22-45`). A new route reached from there fails until allowlisted with a stated reason; the
same test pins the tool-name list at `:74-80` and rejects any name matching
`/delete|remove|…|purge/`.

---

## Docs that go stale on this work

`docs/llm.md:155-160` · `docs/agent-chat.md:45,67,155,172-179` · `js/events.js:134` ·
`.claude/rules/component-events-primitives.md:215-221,358` ·
`.claude/rules/component-mounts.md:234-235,350` · `js/components/types.js:1060-1075` ·
`docs/model-library.md` (the new section) · `docs/generation-lifecycle.md` (the cloud executor
and the third lane).
