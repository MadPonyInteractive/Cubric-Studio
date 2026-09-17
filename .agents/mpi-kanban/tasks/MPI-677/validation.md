# MPI-677 Validation

Verify mode: `auto`, with one exception — **step 1c (the overlay) is `user-ux`**.
Step 1d is Fabio's measurement on the GPU and gates nothing.

## Step 1a — the enhance service (2026-09-08)

Built. **Both backends are now proven live; one bullet is owed a GPU run and is
recorded as owed, not rounded up.**

### What ran

| Check | Command | Result |
|---|---|---|
| Whole suite | `npm test` | **907 pass / 0 fail** |
| New tests | `node tests/llm-service.test.cjs` | **13 pass / 0 fail** |
| Lint | `npm run lint` | clean, `--max-warnings=0` |
| Harness still imports its backends | `node -e "import('./scripts/recipe-engines.mjs')"` | resolves all 7 exports |
| Server boots with the route | `CUBRIC_PORT=3199 node server.js` | `Server started at http://127.0.0.1:3199` |

### The live one-shot call (the bullet's own verify)

Against the booted server, port 3199 so it could not attach to a running app:

```
GET  /llm/status  -> {"deepinfra":{"hasKey":false},"ollama":{"running":true},"defaultBackend":"ollama"}
POST /llm/enhance -> {"ok":true,"text":"The lighthouse glowed at dusk.","backend":"ollama","model":"gemma4:e4b"}
```

**Honest state is real, not a field that is filled in optimistically:** `backend`
and `model` come off the engine's own result, so the reply names `gemma4:e4b` on
Ollama because that is what answered. Two negative paths were exercised in the
same run and both return a usable sentence rather than a stack trace:

```
POST /llm/enhance (empty prompt)      -> {"ok":false,"error":"Write a prompt first, then Enhance."}
POST /llm/enhance (abliterated model,
                   backend=deepinfra) -> {"ok":false,"error":"\"Gemma 4 Abliterated 12B (Uncensored, local only)\" has no deepinfra variant."}
```

### The cloud path, live (2026-09-08, second boot)

Fabio supplied a key. Re-booted on 3199 with `DEEPINFRA_API_KEY` exported from
that file — **the key is not in this repo, not in `.env`, and must never be
committed**; its location is in the handoff, not here:

```
GET  /llm/status  -> {"deepinfra":{"hasKey":true},"ollama":{"running":true},"defaultBackend":"deepinfra"}
POST /llm/enhance -> {"ok":true,"text":"A solitary lighthouse stands sentinel against the bruised
                      purples and burning ambers of a dying twilight.",
                      "backend":"deepinfra","model":"google/gemma-4-26B-A4B-it"}
```

So the whole decision chain runs end to end: a key exists → `defaultBackend`
resolves to `deepinfra` → the request goes to the cloud with no `backend` named →
the reply carries the model that actually answered. **Ollama was running at the
same time and was not used**, which is the point — the default is the cloud when
a key is present, not "whatever is reachable".

### The VRAM release, measured rather than asserted

`GET /api/ps` immediately after that enhance returned **`[]`** — the `keep_alive:0`
release in the route's `finally` actually ran. This is MPI-14's rule on Vision's
side of the family: a local LLM must not sit on VRAM the generator is about to
want, and on a 16 GB card an idle LLM alongside a video generation took a
sub-10-second render past three minutes.

### Owed, and why it is owed

- **The ComfyUI-encoder backend has NOT been run end to end.** `runComfyBackend()`
  is written and dispatches the existing `promptEnhance` operation with the
  injected recipe, and a test proves every injection key addresses a real node
  title in `qwen3vl_4b_prompt_enhancer.json` — but the bullet's own verify ("an
  enhance on `krea2` with no DeepInfra key and no Ollama returns text matching the
  `krea-2` recipe's shape") needs the app running and the button, which is **step
  1b**. It also needs the GPU: the lease was held by MPI-591's bench at the time
  (`gpu_lease.py status` → `GPU 0 busy … pid 23504`), and loading an encoder
  alongside a live generation is the exact contention this repo documents.
- ~~No live DeepInfra call.~~ **Closed the same day** — see "The cloud path,
  live" above. What is still untested on that path is the key coming from
  `secretsStore` rather than the environment: the fork-bridge round trip is unit
  tested (`testForkBridgeAnswersDeepInfraRequests`), but no one has yet typed a
  key into a settings field, because there is no field until step 1b/1c.

### Recorded for step 1d, because it changes what that measurement means

The shipped enhancer graph leaves `use_default_template: True` on `TextGenerate`
*and* hand-rolls its own ChatML, so an injected recipe lands inside the default
template's user turn. The Stage 1 harness measures the opposite — template off,
ChatML hand-rolled (`services/llmEngines.mjs`). Both configurations are proven,
on different instruments: the graph's shape returned a correct French translation
from an injected recipe on 2026-08-19, and the harness's shape produced every
recorded green. **So a `comfy`-backend enhance is not the configuration any
recipe went green on.** It is left alone deliberately; flipping the widget on a
hunch would change the instrument without a measurement.

### One structural change the plan did not name

`scripts/recipe-engines.mjs` moved to **`services/llmEngines.mjs`** and the old
path is now a pure re-export. Reason: **`scripts/` is excluded from the portable
build** (`scripts/build-portable.mjs:135`), so a route importing the backends from
there works in dev and is absent in the shipped app. Nothing in the file was
edited — every constant the sweeps were measured on travelled verbatim, which is
what keeps the app and the harness on one implementation instead of two that
drift.

## Step 1b — the control (2026-09-08)

Built and **exercised in a running app against a live cloud backend**. Six of the seven
bullets are proven; the seventh needs the GPU and is recorded as owed, not rounded up.

### What ran

| Check | Command | Result |
|---|---|---|
| Whole suite | `npm test` | **915 pass / 0 fail** (was 907; +1 new file, +7 asserts) |
| New tests | `node tests/enhance-control.test.cjs` | **7 pass / 0 fail** |
| Lint | `npm run lint` | clean, `--max-warnings=0` |
| Server boots | `CUBRIC_PORT=3199 node server.js` with the key exported | `/llm/status` → `{"deepinfra":{"hasKey":true},…,"defaultBackend":"deepinfra"}` |

### The live run, in the app, on port 3199

**Three enhances, three models, one code path.** Typed into the real prompt box and the
real button pressed:

| Model | key → recipe | Output (first words) |
|---|---|---|
| the project's SDXL card | `sdxl` (exact) | `POSITIVE PROMPT: landscape photography, lighthouse, weathered stone…` |
| `krea2` | `enhanceRecipe: 'krea-2'` | `A lone lighthouse stands tall against a darkening sky in this wide shot…` |
| `chroma-flash` | `type: 'chroma'` | `A wide shot captured on a Hasselblad X2D 100C depicts a weathered stone lighthouse…` |

Every one toasted **"Prompt enhanced."** with no `note`, so all three resolved EXACTLY —
none fell through to `FALLBACK_RECIPE_ID`. Three different recipes, and the control's own
code never branched: the same button, the same handler, `resolveRecipe()` doing the work.

**THE BROKER IS OUT OF THE PATH, measured rather than asserted.** The network log across
those three presses shows three `POST /llm/enhance → 200` and, under `?connector`, only
`GET /connector/jobs/stream` — the SSE relay step 2 deliberately KEEPS. Zero
`/connector/enhance`, zero `/connector/capabilities`. The capability probe and its
10×3 s poll are gone with the import: the button is unconditional because there is no
longer a second app for it to be conditional on.

### The operation gate, live

`workspace:set-operation` driven through five ops on one card, reading the slot each time:

```
t2i: buttons=1 hidden=false | qwenEdit: buttons=0 hidden=true | control: buttons=1 hidden=false
kleinEdit: buttons=0 hidden=true | i2i: buttons=1 hidden=false        (inpaint: buttons=0 hidden=true)
```

`control` keeping the control is the non-obvious half and it is the correct half: the
reference constrains STRUCTURE, so the prompt still carries the creative load. That is
why Qwen Image Edit is not wholly exempt — **the exemption is per OPERATION, never per
model**, which is the whole content of Cubric-Prompt MPI-21.

### The in-graph enhancer is off, and it needed no graph edit

All four graphs ALREADY bake `boolean: false` on their `Input_enhance_prompt` MpiIfElse
(`krea2_t2i_sfw` #241, `krea2_t2i_nsfw` #241, `klein_t2i` #8, `klein_9b_t2i` #8) —
verified by reading the JSON. The only thing that ever set it `true` was the
`enhancePrompt` control's `getInjectionParams()`, so **deleting the control forces false
and no workflow file was touched.** Confirmed live: `getRunPayload().injectionParams` on
a `krea2` t2i now contains no key matching `/enhance/i` at all.

Both halves are asserted in `tests/output-prompt-capture.test.cjs` — nothing offers the
toggle AND every graph bakes false — because either alone is a false green.

### Owed, and why

- **The ComfyUI-encoder backend end to end — STILL OWED, same reason as step 1a.**
  `gpu_lease.py status` → `GPU 0 busy … MPI-591 … pid 4592`, so the local path could not
  be exercised. The cloud path is what ran above. This is now the ONLY thing standing
  between step 1a's last open bullet and closed.
- **Character Sheet and Music Maker were not RUN**, for the same lease. What was checked
  is the half that does not need a GPU: all three enhance declarations still collect
  through `_enhanceDecls`' filter, Music Maker still carries its 1,940-character
  `Input_System_Prompt` and its three-marker `to` map, and Character Sheet still
  correctly carries none (its recipe is baked in the graph). Dispatch shape is shared
  code now; the run is owed.

### One thing that LOOKS like a regression and is not

An `sdxl` enhance returns `POSITIVE PROMPT: …\nNEGATIVE PROMPT: …` as one blob and the
whole blob lands in the positive field. **The broker path did exactly the same** —
Cubric-Prompt has no splitter anywhere in `src/main/` (grepped), so its responder
returned the labelled text as `prompt` and left `negativePrompt` undefined, and Vision
wrote `result.negativePrompt ?? negativeValue`, i.e. the negative unchanged. So this is
PARITY, not something 1b broke, and it is step 1c's own bullet ("the lower box mirrors
the model's fields"). Splitting it silently here would pre-empt a UX decision that is
Fabio's: which channel the negative block lands in is something the user should see and
approve in the overlay, not something the control does behind them.

Corroborated independently and already written down: `pony.recipe.js:216-227`
reached the same conclusion from the other side while deciding not to emit a
negative block at all, and named `sdxl` as carrying the same defect. Its pointer
said "fixing the split is MPI-27's" — a card in the repo this work retires — and
has been repointed at step 1c.

### The scope call worth recording

**"Fold in the two Flow-internal enhance buttons" was read as ONE DISPATCH, not one
backend**, and the difference is load-bearing. Routing the flows to the cloud default
would have dropped three post-processing nodes they depend on — `Replace Text` strips
newlines, `Input_Scrub_Negation` deletes "no …" clauses, `Input_Tidy` eats the trailing
full stop because a character phrase is spliced into the middle of a longer sentence —
on two flows that were tuned by real GPU runs against that chain. That is changing the
instrument without measuring it. So `MpiBaseFlow._runEnhance`'s near-copy of the
`enqueueGeneration` call was deleted and both flows now call `runComfyEnhance()`, which
is the single dispatch to that graph in the app; the op name and the "not in this build"
guard moved with it, which is why the declarations no longer carry `op: 'promptEnhance'`
and the plan's literal grep passes.

**The seed rule is why this mattered rather than being tidiness.** `Input_Seed` must be
spread LAST so no caller can pin it; it was written twice, in two files, and a test now
asserts the ordering in the one place it survives.

## Step 1c — the overlay (2026-09-10)

Built. **The verify mode is `user-ux`, so this section does NOT close the step** — it
records what is proven underneath the UI so that Fabio's pass is about the UI and
nothing else.

### What ran

| Check | Command | Result |
|---|---|---|
| Whole suite | `npm test` | **916 pass / 0 fail** (was 915; +1 new file) |
| New tests | `node tests/enhance-overlay.test.cjs` | **10 pass / 0 fail** |
| Repointed test | `node tests/enhance-control.test.cjs` | **7 pass / 0 fail** |
| Lint | `npm run lint` | clean, `--max-warnings=0` |
| Server boots with the key | `CUBRIC_PORT=3199 node server.js` | `/llm/status` → `{"deepinfra":{"hasKey":true},…,"defaultBackend":"deepinfra"}` |

### The shape

`MpiEnhanceDialog` (a new Compound: `MpiModal` + `MpiInput` ×3 + `MpiButton`). Short
prompt above, **Enhance**, the enhanced text editable below, OK / Cancel. The prompt
box keeps only the short prompt and holds the approved enhancement beside it as
`_enhanced = { source, positive }`.

**The iteration loop is structural, not a rule.** Enhance always reads the UPPER box,
so editing the short prompt and pressing Enhance again re-runs the recipe on the
user's own words — there is no code path by which an enhancement can be fed back into
the enhancer. That was the actual defect in the shipped control: it wrote its result
over the user's words, so the second press enhanced an enhancement.

**ONLY THE POSITIVE IS HELD BACK.** A `separate-field` recipe's negative half is
written into the box's own negative field, where it is visible and editable. "Lands in
its own channel" means the user can SEE it, not that a second hidden value rides along
— and it leaves the submit path with one source of truth for the negative instead of
two that can disagree.

**No Enter-to-confirm, deliberately.** `MpiModal` binds `modal.confirm` with
`allowWhileTyping: true`, so a dialog that listens for it turns the newline key of a
multi-line editor into OK. This one never subscribes to `confirm`.

### The negative-channel split, measured live rather than reasoned about

Step 1b recorded the labelled blob landing whole in the positive field as **parity, not
a regression**, and deliberately left it for this step. It is now cut — and the cut was
proven against the real cloud backend on the booted server, not against a fixture:

| Recipe | `negativeHandling` | Result |
|---|---|---|
| `sdxl` | `separate-field` | `POSITIVE PROMPT: landscape photography, lighthouse…` / `NEGATIVE PROMPT: bad hands 5, bad dream…` → **split, both halves clean** |
| `kling-3.0` | `separate-field` | prose scene, then `Negative Prompt: morphing textures, warped limbs…` → **split** |
| `chroma` | `none` | prose → **not cut**; the raw text stays in the positive channel |

**THE FOUR `separate-field` RECIPES DO NOT AGREE ON A FORMAT, and a splitter written
to `sdxl`'s shape is wrong for half of them.** Found by the test sweeping every
`separate-field` recipe's own `examplePrompts` rather than by reading one recipe:

- `sdxl` labels **both** halves, and its system prompt states the contract literally.
- `kling-3.0` writes an **unlabelled** positive and a **trailing `Negative Prompt:`
  block** — a different label, a different case, no positive label at all. An
  `sdxl`-shaped regex reads that as prose and welds the negative into the positive,
  silently, which is precisely the defect being fixed.
- `pony` and `illustrious` declare the field and **emit no negative block at all** —
  the author's baseline negative is a constant ladder, and a constant needs no LLM to
  write it. They parse to `null` and keep their raw text, which is correct.

So the splitter anchors on the **negative** label alone and treats everything before it
as the positive half, stripping a positive label if one is there. It is called only
when the recipe DECLARES two channels: a prose recipe that happens to write the words
"negative prompt" is not offering a second field, and cutting there would delete half
the prompt.

### Staleness is detected, never announced

The box shows the short prompt and the submit path carries the enhanced one, so an edit
to the short prompt orphans the enhancement — **and the user cannot see that, because
the thing that changed is not the thing on screen.** Storing the SOURCE the
enhancement was made from is what makes it checkable at all; the textarea's input
handler re-checks on every keystroke and the control simply drops back to un-enhanced.
No toast, no dialog — the state is the message.

### Reuse carries both texts, and the ABSENCE of one is the signal

`sourcePrompt` runs `getRunPayload()` → `startGeneration` → the sidecar
(`routes/projects.js`) → `buildPromptReusePayload()` → `injectPrompts({ enhanced })`.
Both Blocks forward it. **Every card generated before this shipped, and every
un-enhanced run, has no `sourcePrompt`** — so `positive` falls through to `prompt` and
`enhanced` is null, and reuse behaves exactly as it always did. Both branches are
asserted.

`project.json` stores only uuid strings, so the sidecar is the durable half — without
the `routes/projects.js` line, Reuse would hand back the enhancement but never the
words it was made from, and only after a reload, which is the worst kind of bug to
find.

### Driven live in the running app (2026-09-10, port 3199)

Fabio dismissed the 18+ gate; everything below was driven without touching the UI
chrome. Project `1.5.0 Local Test`.

| Bullet | How it was driven | Result |
|---|---|---|
| The overlay opens with the box's text | SDXL card, typed `a lighthouse at dusk`, clicked the control | Three labelled boxes, `ENHANCE / CANCEL / OK`; negative box **hidden** until a negative exists |
| The lower box mirrors the model's fields | pressed Enhance on `sdxl` | positive `landscape photography, lighthouse, weathered stone…`, **negative box appeared** with `bad hands 5, bad dream, unrealistic dream:1.2, big eyes, camera`; short prompt untouched |
| The iteration loop | edited the SHORT box to `a lighthouse at dawn, storm rolling in`, re-enhanced | new output describes dawn + storm |
| …proven AT THE WIRE | wrapped `window.fetch`, pressed Enhance a THIRD time with a full enhancement sitting in the lower box | request body's `prompt` was **`a lighthouse at dawn, storm rolling in`** — the short prompt. An enhancement cannot reach the enhancer |
| OK keeps the short prompt | clicked OK | box shows the short prompt; button carries `is-active`; `getRunPayload()` → `positive` = the enhancement, `sourcePrompt` = the short prompt, `negative` = the enhanced negative |
| Staleness | appended ` at night` to the box | button `is-active` **false**, `positive` back to the box text, `sourcePrompt` **null** — no toast, no dialog |
| Reopen is non-destructive | enhanced `a red bicycle`, OK, reopened | lower box **restored** the exact enhancement |
| Empty lower box = run raw | cleared it, OK | `positive` = `a red bicycle`, `sourcePrompt` null, control un-enhanced |
| The operation gate still bites | `workspace:set-operation` through seven ops | `t2i`/`i2i`/`control`/`upscale` → 1 button; `qwenEdit`/`kleinEdit`/`inpaint` → 0, slot hidden |
| Reuse restores both texts | built a payload from a card shaped as `generationService` now writes one, fed it through `injectPrompts()` — the same call both Blocks make | box shows `a lighthouse at dusk`, control `is-active`, `getRunPayload()` → `positive` = the enhancement, `sourcePrompt` = the short prompt |

**One leg of Reuse was NOT driven and is recorded as not driven:** the sidecar
write/read. Exercising it needs a real image generation and an app reload, which is a
card written into Fabio's project for a path that is unit-tested
(`buildPromptReusePayload` both branches) and source-asserted (`routes/projects.js`
carries `sourcePrompt`; `/load-meta` returns the sidecar whole). Everything on either
side of that leg is proven live.

### The two owed GPU runs — BOTH CLOSED

`gpu_lease.py status` read `GPU 0 free`; the slot was **held for the whole
browser-driven block** by a sentinel-writing holder, because the lease wraps a command
and the dispatching here happens inside a running app the script cannot see. The
sentinel is the artefact that proves acquisition — `gpu_lease.py run` gives up after
its timeout and exits **0 without running the command**.

**1. The ComfyUI-encoder backend, end to end — owed since 2026-09-08, now RUN.**
Krea 2 card, backend pinned `comfy`, `chooseBackend()` → `comfy`, `canEnhanceInGraph()`
→ true:

```
Enhanced by qwen3vl_4b_abliterated.        (34 s)
"A lighthouse at dusk stands sentinel on a weathered cliff, its lantern glowing softly
 against the bruised twilight sky. Photograph, photorealistic, portrait, editorial,
 natural light from a low sun… Shot with an 85mm lens, shallow depth of field…"
```

Prose, camera, lighting — the `krea-2` recipe's shape, which is exactly what the
bullet's own verify asked for. **Re-run with `window.fetch` wrapped: zero
`/llm/enhance`, only ComfyUI** — a `comfy` enhance really is a queued engine job, not
the server route. The negative box stayed hidden, correct: `krea-2` is not
`separate-field`.

*Recorded for step 1d, not fixed here:* the output carries the known
`use_default_template` divergence — "Skin texture of the lighthouse's surface… pores of
moss", "Studio lighting simulates ambient decay" — recipe-quality leakage from the
graph's doubled ChatML, not backend plumbing. It is the measurement step 1d exists for.

**2. Character Sheet + Music Maker — RUN.** Both through the shared
`runComfyEnhance()` dispatch that step 1b folded them into.

- **Character Sheet**, Describe slide, `a grizzled desert bounty hunter, long coat,
  scarred face` → **13 s** → a proper character phrase: `a 40-year-old tall,
  broad-shouldered male… faded brown leather coat over a stained denim shirt…` — no
  newlines, no trailing full stop, which is the post-processing chain doing its job
  and the reason the flows deliberately did NOT move to the cloud default. Its own help
  text states step 1c's rule verbatim: *"whatever is in the lower box is what runs.
  Leave it empty and your own words run raw."*
- **Music Maker** has no button — its enhance is `auto: true` and fires inside
  Generate. Pressed Generate, watched `Writing the description…`, and read the job off
  the engine's own history rather than the app: it **completed successfully** and
  produced the three-marker output its `to` map addresses —
  `[MOOD] Distant, weary, intimate…` `[VOCAL] Raw, cracked, emotionally restrained…`
  `[ARRANGEMENT] Acoustic guitar — fingerpicked, slow, arpeggiated, in E minor…`
  Cancelled before the music graph ran: **no song rendered, no card written**, and the
  engine queue drained to `running: 0 pending: 0`.

### An environmental trap that cost the first attempt, and is NOT a step-1c defect

The **first** `comfy` enhance failed at 22 s with `Remote engine dropped —
promptEnhance / null`. The cause is in the server log and is worth writing down,
because nothing about it points at the enhance path:

- A second Vision instance already owned the engine on `:48188`. The 3199 boot logged
  `Engine already serving on 48188 (started by another app instance) — attaching`.
- That boot then found **custom-node drift** — `ComfyUI-MpiNodes installed=287edb83
  pinned=a1890c86`, the pin **MPI-714 changed 40 minutes earlier** — and wiped and
  re-downloaded the node folder **of an engine it does not own**.
- It then logged `Custom nodes installed — triggering auto-restart` →
  `Restart delegated to the instance that owns the engine`. The engine restarted under
  the running enhance, the WS dropped, and the job died mid-flight.
- `/comfy/status` had said `needsRestart: true` before the run. **That was the tell.**

Retried after the engine came back: clean, 34 s. So: **an attached second instance will
repair another instance's engine and can restart it underneath a running job.** Read
`needsRestart` before dispatching to an engine you did not start.

The same ownership split explains Music Maker's app-side hang: the engine's history
showed the job `success` while the app still read `Writing the description…` and had
re-dispatched. Completions do not reliably cross the attached WS relay. The RUN is
proven by the engine's own history; the app-side relay is a separate concern and is not
this card's.

### Owed, and why

- **FABIO'S USER-UX PASS IS THE ONLY THING LEFT.** Every bullet is now driven live and
  every owed GPU run is closed. What is owed is a person looking at it.

### One thing that looks like scope creep and is not

`tests/enhance-control.test.cjs`'s "the prompt box imports the local service" assertion
was **repointed, not deleted**. Step 1c moved the CALL one layer down — the overlay
owns it, the box owns the button and the approved result — so the test now asserts the
box reaches the dialog AND the dialog reaches the service, and that NEITHER carries
`connectorOps` or a capability probe. The property under test is unchanged: whatever
runs the enhance runs it locally.

---

## Step 2 — cut the cord (2026-09-10)

Done. Verify mode is `auto`, and this section closes the step.

### What ran

| Check | Command | Result |
|---|---|---|
| Whole suite | `npm test` | **917 pass / 0 fail** |
| Lint | `npm run lint` | clean, `--max-warnings=0` |
| Syntax, the unlinted files | `node --check server.js main.js routes/connector.js` | OK (ESLint only covers `js/`) |
| Recipe resolution audit | `node --test tests/recipe-registry.test.cjs` | 1 pass / 0 fail |
| Portable build | `npm run build:portable:dry-run` | completes, 16 files staged |
| Server boots without the SDK | `CUBRIC_PORT=3199 node server.js` | started — and see the boot log below |
| The routes | probe script, live on 3199 | table below |
| Enhance still works | `POST /llm/enhance`, live | `ok:true`, `deepinfra` / `google/gemma-4-26B-A4B-it` |

**917 is not 916 plus this step's arithmetic, and the difference is another session's.**
Step 1c closed at 916. A peer added `tests/mention-picker.test.cjs` (9 tests) to the
shared tree, and this step removed 8 — the 7 in `tests/connector-responder.test.cjs`
and the one brokerBoot test in `tests/windows-hide-spawn.test.cjs`. 916 + 9 − 8 = 917.
**A test count taken from a shared tree is not a delta** until the peer's contribution
is subtracted out; unreconciled, this one would have read as "8 tests appeared".

### What was deleted

- `services/brokerBoot.js`, `services/connectorResponder.js`, `js/shell/connectorOps.js`
- `POST /connector/enhance`, and the `promptEnhance` field on
  `/connector/capabilities` (which now returns `generationSubmit` alone)
- `routes/connector.js`'s `_client` / `setClient` pair — dead the moment those two
  readers went, and the only reason that file ever held broker state
- `server.js`'s whole broker chain: `ensureFamilyBroker` → `startConnectorResponder`
  → `setClient`, plus the **D1 eager spawn of headless sibling apps**
- the `@cubric/connector` dependency (`package.json`, and `package-lock.json` —
  including the stale `extraneous` entry npm leaves behind), its
  `node_modules/@cubric/**` exclusion in `scripts/build-portable.mjs`, and
  `tests/connector-responder.test.cjs`

**The plan's sixth target was already gone.** It named the wand block at
`MpiPromptBox.js:1749-1840` plus its import at `:23`; step 1b removed both when it
repointed the button, which is why the grep the plan supplies as its own verify never
hit that file.

### Four orphans the plan did not name, removed because this step created them

The broker was the only consumer of a two-way relay between `main.js` and the server
fork, so cutting it left both ends dangling:

- `main.js` sent `cubric-window-state` on window show and on `closed`; `server.js`
  received it and forwarded it to the broker as `reportWindowState`. Receiver and both
  senders removed, along with `server.js`'s `_connectorClient`.
- `connectorResponder` answered `system.shutdown` by sending `cubric-shutdown` to
  `main.js`, which called `app.quit()`. The sender is deleted, so the handler became
  unreachable; removed.

Nothing else sends or receives either message —
`grep -rn 'cubric-shutdown|cubric-window-state|reportWindowState'` returns nothing
outside `node_modules`.

### The routes, live on a booted server

The point of the step is that the cord is cut and **the agent's hands are not**. A
`400` in this table is a pass, not a failure: it is a kept route running and rejecting
an empty body, which a deleted route cannot do.

| Route | Status | Body |
|---|---|---|
| `POST /connector/enhance` | **404** | — *(deleted)* |
| `GET /connector/capabilities` | 200 | `{"generationSubmit":true}` — **no `promptEnhance`** |
| `POST /connector/generate` | 400 | `body.flowId, or body.modelId and body.operation, are required.` |
| `POST /connector/open-project` | 400 | `body.folderPath is required.` |
| `POST /connector/jobs/:id/result` | 200 | `{"received":false}` |
| `GET /connector/jobs/stream` | 200 | `event: connected\ndata: {}` |
| `GET /llm/status` | 200 | `{"deepinfra":{"hasKey":true},"ollama":{"running":true},"defaultBackend":"deepinfra"}` |

`generationSubmit:true` is the probe's own SSE subscriber — the reader was aborted but
the stream had already registered. Not a step-2 change: the flag and its computation
are untouched.

Then a real enhance through the local path, to prove the cut did not take the feature
with it:

```
POST /llm/enhance  { prompt: "a lighthouse at dusk", backend: "deepinfra" }
-> ok: true   backend: deepinfra   model: google/gemma-4-26B-A4B-it
   "A solitary, weathered stone lighthouse stands sentinel against a bruised twilight
    sky, its rhythmic golden beam sweeping across the churning, indigo swells…"
```

### The boot log is the evidence, and it is evidence of an ABSENCE

The previous boot logged `Broker ready (spawned=…)` and `Connector responder registered
(system.memory.release, system.shutdown, generation.submit) + caller routes live.`, and
could log `Spawned headless siblings`. This one logs none of them — it goes straight
from `Server started at http://127.0.0.1:3199` to GPU detection. **Booting Vision no
longer starts a broker and no longer spawns a headless Cubric Prompt beside it**, which
was the boot-probe hazard every prior session on this card had to clean up after.
Checked afterwards: no broker process and no headless Prompt exists.

### A stale server nearly produced a false PASS

The first probe attempt read `UP after 0 ms` and would have answered every question
about the new code — except that **port 3199 was already held by the PREVIOUS session's
`node server.js`, started 11:20 and never killed.** My own server had exited 1 with
`Port 3199 is already in use — refusing to start`, in a background task whose failure
is easy to skim past. Two readings that agreed with each other, and neither was about
this diff.

The tell was in the two lines read together: a server cannot be `UP after 0 ms` when
the process meant to serve it has exited. **A readiness probe that passes instantly is
not a fast boot, it is somebody else's server** — check the listener's PID and start
time, not just that the port answers. Same family as the dev-launch trap this card
already carries, one rung lower: not stale *code* behind a live app, but a stale
*process* behind a live port.

### Left in place deliberately

`resources/cubric/connector-manifest.json` still declares four broker capabilities —
`project.context.read`, `asset.import`, `generation.submit`, `system.memory.release` —
and **nothing serves any of them over a broker any more.** It was not deleted because
it is load-bearing for the build, which is only visible from the dry run:
`build-portable.mjs` reads it, runs `assertConnectorManifest()` on it, and writes its
path and sha256 into the update manifest (`connectorManifestHash`). Deleting it breaks
`npm run build:portable`.

So it is a stale advertisement rather than dead weight, and the honest edit is not
obvious: `generation.submit` is still genuinely reachable — over plain HTTP, on the
route this step deliberately kept. **Step 5 owns it**, when it decides what an external
caller is told about Vision's surface. Recorded here so it is not mistaken for an
oversight.

### One thing that looks like a regression and is not

`shouldExcludeAppPath()` no longer skips `node_modules/@cubric/**`, so a developer who
has not re-run `npm ci` still has the old `file:` symlink on disk and their next
portable build will **fail** on `assertNoDanglingSymlinks` instead of quietly skipping
it. That is the correct outcome — the link points at a repo Vision no longer depends on
— and the fix is `npm ci`. The test that asserted the exclusion was replaced by its
inverse (a scoped package is not excluded merely for being scoped);
`assertNoDanglingSymlinks`, the check that actually caught the shipped-dangling-link
bug in MPI-416, is untouched.

### The handoff says another session is doing this step. It was this one.

The handoff record was annotated at ~13:30 with *"Step 2 — IN FLIGHT IN ANOTHER
SESSION … DO NOT START IT"*, listing `connectorOps.js` / `brokerBoot.js` /
`connectorResponder.js` deleted, `@cubric/connector` out of `package.json` and
`llmService.js`'s header rewritten to past tense. That is this diff, seen uncommitted
in the shared tree by a peer who could not tell whose it was. **In a shared tree an
uncommitted diff is anonymous**, and the peer's caution was right — but the cost is
that the record now warns the next reader off work that is finished. Corrected in the
handoff itself; the lesson is to commit a structural deletion promptly rather than
leaving the tree ambiguous across sessions.

---

## Step 1c — what Fabio's user-ux pass has found so far (2026-09-11)

The pass is UNDERWAY, not finished. Two defects found and fixed; the step stays open.

### 1. Reopening an approved enhancement dropped its provenance (`4f493f4f`)

`_note()` was only ever called inside `_run()`, and nothing seeded it from
`props.enhanced`. So reopening restored the enhanced text into the lower box with a
**blank** note line.

That line is not decoration — **it is the only surface the fallback warning has.**
When a model's key matches no recipe the pinned fallback answers anyway, which is
exactly how two MiniMax-H3 *video* cards were enhanced by the `chroma` *image*
recipe for a week without anything failing loudly. On reopen the enhancement was
kept and the warning about it silently vanished.

Provenance now belongs to the **text**, not to the run: recorded on a successful
run, emitted with `apply`, stored on `_enhanced`, seeded back on reopen, and
dropped exactly when the text is. A failed re-run still renders its error without
recording it, because the previous text is still standing and its provenance is
still the true one. Reuse deliberately gets none — the sidecar stores `sourcePrompt`
and nothing else, so a blank line is the honest reading there.

### 2. A toast on every OK, and no signal during the run (`238d3081`)

Fabio: the toast fired on every press and was annoying. It was also in the wrong
place — a confirmation for an action the user just took is noise, and the part of
the flow with no signal in it was the **wait**. `_enhanceToast` had exactly one
call site and went with it; `MpiSpinner` now covers the enhanced box while a run is
in flight. Raised before the call, cleared in **`finally`** — a spinner that
survives a failed run leaves the box reading busy forever, which is worse than no
spinner. Its scrim takes the pointer too, so a run cannot be typed into and then
overwritten by its own result.

### A test-script defect that was mine, not the app's

My step-4 instruction said "Cancel, then reopen, the enhancement should still be
there" and Fabio correctly reported it as a failure. **Cancel is supposed to
discard.** `_enhanced` is set only on `apply`; the property that exists is narrower
— *Cancel is non-destructive to an ALREADY-APPROVED enhancement*, i.e. `OK → reopen
→ Cancel → reopen` keeps it. What was driven live in the original pass was `OK →
reopen`, and the script generalised it into something the code never claimed.
**A user-ux script derived from a validation table must quote the table's
precondition, not just its outcome** — otherwise the tester spends a cycle
reporting a false defect, and the next reader cannot tell it was false.

### Verified

3 + 2 new source-contract tests in `tests/enhance-overlay.test.cjs` (**15/15** in
that file), `npm test` **921/921**, `npm run lint` clean. Each of the five
provenance assertions was run against **HEAD's pre-fix source** and confirmed to
FAIL there — a source-contract test that passes on both versions proves nothing.

### Still owed on 1c

`OK → reopen → Cancel → reopen`; the separate-field negative channel (needs an
**SDXL / Pony / Illustrious / Kling** card — the pass so far ran on a prose recipe,
which cannot produce a second channel); the operation gate; and **Reuse after an
app reload**, still the one leg nothing has ever driven.

### A shared-index mistake worth writing down, because the rule as written does not prevent it

`238d3081` **swept in nine files that were not mine** — `docs/proprietary-models-research/**`,
3,098 lines belonging to the concurrent session. They staged them in the shared
index in the gap between my `git status` check and my `git commit`. Their content
is intact on master, but under my commit message and earlier than they chose. Not
unpicked: undoing another live session's files mid-flight is a second uncoordinated
action on work already disturbed once.

**`behaviour.md` says stage by pathspec and forbids `git commit --only` — and in a
shared index those two rules collide.** `git add <paths>` does not constrain what
`git commit` writes; the commit takes the whole index, including anything a peer
staged a second ago. `git commit -- <paths>` is the only form that commits *what
you named*, and it is the form the rule bans. The ban was written against sweeping
work in; here it is what allows it. Checking `git status` first does not help — the
race is between the check and the commit.


## Step 1c — Fabio's user-ux pass, round 2 (2026-09-12)

Six items raised in one pass. **Three were real defects and are fixed; two are
features that were never built and are reported as not built; one could not be
reproduced from the code and needs one more datum from him.** The step stays open.

### 3. The Enhance button died after a generation, permanently (fixed)

The worst of the six, and a whole class rather than a one-off. `_openEnhanceDialog()`
opened with `if (_enhanceDialog) return;` — a guard against double-mounting that
assumed the handle is cleared whenever the dialog goes away. It is cleared on
exactly one path: the **Cancel button**, which is the only thing that emits
`cancel`.

**`MpiModal.hide()` does not emit `cancel`, and says so in its own contract**
(`js/components/Primitives/MpiModal/MpiModal.js:33`). So a backdrop click, an
Escape, an `Overlays.reset()`, or a `ui:close-all-popups` pulse tore the modal
down and left `_enhanceDialog` non-null forever. Every later click hit the guard
and returned. A generation pulses close-all, which is why Fabio found it there and
why it read as "after a generation" rather than as "after any dismissal".

**This trap is already known in this codebase and was already commented in two
other components** — `MpiLicenceGate.js:338` and `MpiAudioRecorder.js:345` both
carry the same warning in prose, and the licence gate goes as far as a
`MutationObserver` to catch it. The overlay simply missed it. *A hazard documented
in a sibling component is not a hazard the next component avoids;* only a check
that runs does that.

The fix is a deletion, not an addition: the guard is gone and
`_closeEnhanceDialog()` runs unconditionally before the mount. Tearing down
nothing costs nothing, and the button is unreachable under an open backdrop
anyway, so the double-mount the guard defended against is not a state a user can
produce.

### 4. The provenance line named the engine but not the target model (fixed)

Fabio enhanced with **Krea 2** selected, switched to **SDXL**, reopened, and the
line still read `Enhanced by gemma4:e4b.` — true, and not the half that mattered.

Underneath the cosmetic ask was a real hole: **`_syncEnhancedState()` compares only
the stored `source` against the current text, and nothing anywhere compared the
MODEL.** `setModel` / `setModelList` never call it. So an approved enhancement
survived a model switch intact and `getRunPayload()` would submit Krea 2 prose to
SDXL — a perfectly valid prompt in the wrong shape, with nothing on screen saying
so. This is the same failure family as the pinned-fallback miss: the system
answers, so nothing looks broken.

**Deliberately NOT modelled on the short-prompt staleness rule.** An edit to the
prompt invalidates the words, so dropping the enhancement is right. A model switch
does not invalidate them — the user may well want to keep them — so the
enhancement is **kept and the mismatch is announced**. `_enhanced` now carries
`modelId` + `modelName`, the dialog's success note reads `Enhanced by <engine> for
<model>.`, and reopening against a different model replaces the note with a warn:
`Enhanced for Krea 2 — SDXL Realistic is selected now. Press Enhance to rewrite it
for this model.` The mismatch note **outranks** the stored one: both ride the same
single line and "these words are for another model" is the more urgent of the two.

### 5. The Ollama error told the user to open a terminal (fixed)

`routes/llm.js:127` read *"Start it with `ollama serve`"*. Ollama ships a desktop
app with a tray icon on every platform we target, so the ordinary fix is "open
it". Naming the terminal command first sends a user who HAS it installed to do the
awkward thing and tells a user who does NOT have it nothing useful. Now: *"Ollama
is not running. Start Ollama, or install it from ollama.com, or add a DeepInfra key
in settings."*

### 6. NOT BUILT — nothing handles a missing Ollama MODEL, and nothing starts or installs Ollama

Fabio asked what happens when the user does not have the model we call. Answer,
grepped rather than assumed: **nothing does.** There is no `api/pull` call anywhere
in the repo, no model-presence check, no toast, no settings entry, and no install
or lifecycle path — `ensureOllama` appears nowhere. The three files that mention
Ollama at all are `routes/llm.js`, `services/llmEngines.mjs` and
`js/services/llmService.js`, and `OllamaEngine` has `isRunning()`, `chat()`,
`complete()`, `loadedModels()` and `releaseOwnModels()` — no pull.

So a user with Ollama running but without the model gets `/api/chat` → 404 →
`Ollama chat failed: 404 Not Found`, surfaced raw. And the "Start Ollama" message
above is the app's entire answer to Ollama not running.

**This is consolidation debt, not a new gap.** Cubric Prompt had the whole ladder
as MPI-8 — `ensureOllama()`: probe the server, spawn `ollama serve` detached,
treat `ENOENT` as the not-installed signal, one-time consent, then `winget`, with
the download page as the fallback — plus MPI-17's finding that the spawn must
inherit the desktop app's model directory or the user's models silently vanish.
**None of it came across in step 1a.** Step 1a ported the engine and the route; it
did not port the lifecycle, and nothing recorded that it had not. Fabio's question
is the first thing that surfaced it.

Not built here: it is its own card's worth of work (a pull with progress, a
presence check, and the install ladder), it touches the settings surface, and it
is not what step 1c is about. Recorded so it is not mistaken for working.

### 7. NOT REPRODUCED — the positive/negative selector "disappearing" on enhance

Nothing in the enhance path touches the negative toggle. `_refreshNegToggle()`
gates it on exactly three things — `props.includeNegative === true`, the model's
`capabilities.negativePrompt !== false`, and `!_krea2TurboOn` — and neither
`_openEnhanceDialog()` nor the apply handler writes any of them. The apply handler
sets `negativeValue` and re-reads the textarea; it never remounts or destroys the
toggle.

Reported as **not reproduced from the code**, not as "works fine". Needs from
Fabio: which model was selected, and whether the toggle comes back on a reload or
a model switch.

### 8. RECORDED, not actioned — `pony` and `illustrious` emit no negative block

Fabio: a negative is genuinely useful on Pony (`realistic`, `furry`, `anime` as
counter-tags), and the two recipes declare `negativeHandling: 'separate-field'`
while emitting nothing, which is why the box stays hidden. That is correct
*today* — step 1c measured it and the splitter is right to leave their raw text
alone — but the recipes themselves could be authoring a negative and are not.

**Not done here, deliberately.** It is a recipe edit, which resets the twice-green
counter and owes two clean Stage 1 sweeps per recipe under the GPU lease, and
Fabio's own framing is that it is low priority: *"I'm not very worried about these
models. People don't use them much anymore. These SDXL models were placed there
just as starter models."* Recorded for whoever picks the recipe layer back up.

### Verified

`node tests/enhance-overlay.test.cjs` **17/17** (was 15; +2 new). `npm test`
**923/923**, `npm run lint` clean.

**The count is reconciled, per this card's own rule:** 921 -> 923 is exactly the two
tests added here, with no peer contribution in the window — unlike the 916 -> 917 -> 921
sequence, where a peer's 9 mention-picker tests had to be subtracted before the
delta meant anything.

**All six new assertions were run against HEAD's pre-fix source and confirmed to
FAIL there** (scripted against `git show HEAD:<path>` rather than by eye): the
dialog naming the target model, the box recording `modelId`, the id comparison,
the absence of the early return, the teardown-before-mount, and the mismatch-note
fallback. A source-contract test that passes on both versions proves nothing.

**One of the two pre-existing tests had to be loosened, and the reason is worth
keeping:** `testAnEmptyLowerBoxMeansRunMyWordsRaw` asserted the `_enhanced`
assignment as one exact string, so adding two fields to the kept branch failed a
test whose actual subject — that the empty branch is `null` — was untouched. It now
matches the shape (keyed on `positive`, empty branch `null`, kept branch carries
`source`). An exact-string source contract fails on edits that do not concern it,
and each such false failure is an invitation to weaken the assertion under time
pressure.

### Still owed on 1c

Unchanged from round 1, none of it closed by this round: `OK -> reopen -> Cancel ->
reopen`; the separate-field negative channel (**`sdxl-realistic` / `sdxl-nsfw` are
the cards that resolve to the `sdxl` recipe** — `nvidia-pid` is the only other
`sdxl` key and it is a deprecated upscaler; `pony-mix` / `ill-anime` are the
control case that must show NO negative box; **no Kling card ships in Vision**, so
that half of the old note is unreachable); the operation gate; and **Reuse after an
app reload**, still the one leg nothing has ever driven. Plus item 7 above.


## Step 1c — round 2b (2026-09-12): item 7 reproduced, and it was not the toggle

### 7 (CLOSED, and it was a different bug) — the negative leaked across models

Round 2 reported item 7 as *not reproduced from the code*, because nothing in the
enhance path touches the negative TOGGLE — which was true and was the wrong thing
to look at. Fabio's own repro named the real one: *"I've done an enhancement on
SDXL realistic, and then I selected Illustrious and did an enhancement there. I
closed it, and when I reopen it, it has a negative prompt from the SDXL prompt
enhancement."*

The toggle was never the subject. **The negative VALUE survived a model switch.**
The chain:

1. `sdxl` is `separate-field` and writes its counter-tag ladder — `bad hands 5,
   bad dream, unrealistic dream:1.2, big eyes, camera` — into `negativeValue`.
2. Switch to Illustrious. `illustrious` declares `separate-field` and **emits no
   negative block at all** (measured in step 1c: its baseline negative is a
   constant ladder, so there is nothing for an LLM to write), so `_run()` sets
   `negText = ''` and hides the box *inside the dialog*.
3. OK emits `negative: ''`, and the box's apply handler read
   `if (negative) negativeValue = negative;` — so the empty value did nothing and
   **SDXL's ladder stayed standing**.
4. Reopening seeds the dialog with `negative: negativeValue`, so it reappears
   under the label "Enhanced negative prompt", attributed to a recipe that never
   wrote it.

**The guard was right and its reasoning was right; it was missing one
distinction.** Its comment says blanking the user's own negative because this
recipe had nothing to say about it would be a silent delete — true. But it could
not tell a negative the USER typed from one a PREVIOUS ENHANCEMENT wrote, and
treated both as the user's.

Authorship is now recorded: `_enhanced` carries the `negative` it wrote, and a run
that produces none clears the standing value **only when it is byte-identical to
what the last enhancement wrote**. Typed by the user, or edited by them since →
untouched, exactly as before.

Worth keeping as a general shape: *a guard that protects "the user's data" needs
to know what makes it the user's.* Ownership is a fact about provenance, and if
provenance is not recorded the guard degrades into "never touch it", which is a
different rule with different bugs. This is the third thing on this card that had
to start being recorded for the same reason — the short prompt (`source`), the
target model (`modelId`), and now the negative.

### The enhancer LLM is not the one the recipes were measured on (recorded, not changed)

Fabio: *"Why are we using Gemma E4B? Didn't we train all the recipes on an
uncensored model?"* He is right, and the answer is in our own registry.

`chooseEngineModelId()` (`js/services/llmService.js:166`) returns
`UNCENSORED_MODEL_ID` (`gemma-4-abliterated-12b`) **only when the TARGET model
card's id ends in `-nsfw`**. Every other local enhance returns `undefined` and
falls through to `DEFAULT_MODEL_ID` = `gemma-4-e4b` → `gemma4:e4b`; every cloud
enhance falls through to `google/gemma-4-26B-A4B-it`.

And `MODEL_REGISTRY`'s own entry for `gemma-4-abliterated-12b` reads: *"The
ENHANCER of record: every v1 recipe is Stage 1 green on this model. Word-budget
adherence is a capability threshold between 8B and 12B, so recipes hold their
length here and drift on smaller models."* `llmEngines.mjs`'s header adds that
these models **are the instrument**, and that changing one silently invalidates
every green recorded in `docs/recipes/research/`.

So the shipped SFW path runs an enhancer on the wrong side of the threshold its
own registry states, no recipe was ever green on it, and **nothing anywhere
records this as a decision** — it is the default winning by omission. Two
defensible positions exist (the recipes' instrument vs. what most users can
actually run on their own hardware) and this is not an agent's call, so it is
written down rather than changed. It is the third gap on [[MPI-728]].

Also measured while answering: the user cannot change any of it. The *backend* has
a preference (`cubric.llm.backend` in `localStorage`, `backendPreference()`) with
no UI anywhere; the enhancer MODEL has neither a preference nor a UI.

### Card filed

**[[MPI-728]]** — *Prompt-enhancement settings: the DeepInfra key, the Ollama
models, and which LLM enhances* (todo / planned), on Fabio's explicit request. It
absorbs round 2's item 6 (nothing installs Ollama or pulls a model), the DeepInfra
key field that `routes/llm.js` already tells the user exists, the enhancer-model
choice above, and the plain-English explanation of what enhancement does.

### Verified

`node tests/enhance-overlay.test.cjs` **18/18** (15 → 17 → 18 across both rounds).
`npm test` **927/927**, `npm run lint` clean.

**Count reconciled, and this time it was NOT all mine:** 923 → 927 is my one new
test plus **three from a peer** — `tests/desktop/flow-roster-survives-navigation.spec.js`,
`tests/flow-field-constraints.test.cjs` and `tests/mention-picker.test.cjs`, all of
which they had already STAGED in the shared index during this session. Read as a
delta it would have said "four tests appeared". The staged-peer-files hazard this
card recorded on 2026-09-11 is therefore live right now: **commit with
`git commit -F <msg> -- <paths>`**, never a bare `git commit` after `git add`.

The three new assertions were run against HEAD's pre-fix source and confirmed to
FAIL there, scripted against `git show HEAD:<path>` rather than checked by eye.


## Field evidence: the dog was dropped (2026-09-12) — first real signal on the enhancer-model question

Fabio ran `a man walking his dog` on **ILL Anime** (`ill-anime` -> the
`illustrious` recipe) through the shipped path, i.e. on `gemma4:e4b`. Output:

```text
masterpiece, best quality, very aesthetic, absurdres, newest, 1boy, solo, man,
medium brown hair, blue eyes, t-shirt, jeans, walking, looking at viewer,
outdoors, park, green grass, full body, street light, afternoon, from side,
sharp focus, cinematic lighting
```

### The format is CORRECT, and the instinct about it was inverted

Fabio read the tag grammar as a Pony prompt reaching an Illustrious card. It is
not: this is `illustrious`'s own shape, byte for byte. Its three
`examplePrompts` (`illustrious.recipe.js:262-264`) all open
`masterpiece, best quality, very aesthetic, absurdres, newest, <count>` and the
recipe's rule 0 calls that six-tag header "COPIED, never composed".

The inversion is worth writing down because it is the exact opposite of the
intuition: **`masterpiece, best quality` is the ILLUSTRIOUS marker, and it is the
block `pony` deliberately WITHHOLDS.** MPI-25 measured both on split corpora —
on Illustrious the Animagine block is native (`masterpiece` 73%/78%,
`best quality` 73%/73%) while the score chain is dead (`score_9` 2%/4%); on the
shipped Pony merge the six-tag score chain appears in **0 of 32** prompts. Both
checkpoints are SDXL-derived anime models and **both recipes are tag grammars** —
tags do not distinguish them, the header does. Nothing to fix here.

### The dog is a RULE VIOLATION, not a judgement call

`illustrious.recipe.js:278`, rule 1, verbatim: *"THE SUBJECT IS FIXED... Everything
the user named — every person, animal, object, garment and place — is written into
the line BEFORE anything you chose yourself... When the count is tight it is your
inventions that go, **never their furniture and never their pets**."*

The rule names pets explicitly. The output has no `dog` tag, and instead carries
`street light`, `green grass` and `afternoon` — three of the model's own
inventions kept while the user's subject was dropped. That is the precise
inversion rule 1 forbids, and the line is nowhere near its budget, so no
condense pressure explains it.

Note `1boy, solo` is NOT itself the defect and should not be "fixed": in Danbooru
grammar `solo` counts PEOPLE, so `1boy, solo, dog` is a normal, correct
combination. The missing tag is `dog`.

### Two candidate causes, and the experiment that separates them — run this FIRST

1. **The instrument.** The shipped SFW path runs `gemma4:e4b`, and every v1 recipe
   was measured on `huihui_ai/gemma-4-abliterated:12b`, which the registry's own
   description places above an 8B-12B capability threshold. A dropped subject is
   exactly the class of drift that predicts.
2. **The recipe's exemplars.** All three `examplePrompts` and the trailing
   in-prompt exemplar (`:328`) are single-subject: two are `1girl/1boy, solo`
   with no animal, the third is `no humans, fox`. **There is no demonstration
   anywhere of a person WITH their animal.** MPI-25's own §7.2e finding was that a
   slot is fixed by DEMONSTRATION, not instruction — the picker slot survived
   three reframes of the instruction and closed the moment a tag was added to the
   trailing exemplar. So an instruction that says "never their pets" with no
   exemplar showing a pet is the shape that has already failed once on this recipe.

**The experiment is one run and it isolates them:** same input, same recipe, on
`gemma-4-abliterated-12b`. Dog survives -> cause 1, and this is evidence for
[[MPI-728]]'s third gap rather than a recipe defect. Dog still missing -> cause 2,
the recipe owes an exemplar carrying a person and their animal, plus a re-sweep.
**Do not edit the recipe before running it** — a recipe edit resets the
twice-green counter and owes two clean sweeps, and half of the candidate causes
here are not in the recipe at all.

Also owed either way, and cheap: the Stage 1 harness already checks user-term
retention, so a dropped `dog` should fail a sweep. It was never going to, because
**no sweep has ever run on the model the app actually ships**. That is the gap in
one sentence.

**Scope note, the discipline this card keeps relearning:** this is ONE run, on ONE
recipe, on ONE input, through the shipped backend. It is first-class evidence
about `illustrious` on `gemma4:e4b` and says nothing yet about the other eleven
recipes — which share neither its exemplars nor its grammar.

## Step 1c — round 3 (2026-09-12): the short prompt was never stored at all

### 9 (FIXED) — every card in the test project read `sourcePrompt: null`

Fabio raised it as a design question, not a bug: after Reuse he expected the box to
hold the SHORT prompt with the control lit, and the overlay to open with the short
prompt above and the enhancement below. **That IS the built design, and the whole
reason both texts are stored.** It had never once happened, because the field was
being dropped on the way OUT.

**Measured, not inferred.** Every sidecar in
`Documents/Cubric Vision/Projects/Prompt Enhancement tests/Media/.meta/` reads
`sourcePrompt: null` — including `t2i_001` (sdxl-realistic) and `t2i_002`
(ill-anime), whose `prompt` fields plainly hold enhanced text.

**Where it went.** Both ends were right and the middle was not:

- `MpiPromptBox.getRunPayload()` builds `sourcePrompt` (`:2186`).
- `generationService` stores it on the sidecar (`:1199`) AND the live item (`:1240`).
- **`MpiGalleryBlock._galleryGenerationFromPayload()` (`:1407`) and
  `MpiGroupHistoryBlock._generationFromPromptPayload()` (`:1526`) destructure an
  EXPLICIT field list and rebuild the config from it.** Neither named
  `sourcePrompt`, so it was dropped between the two — no error, no warning.

**THE RULE: an explicit-field destructure mapper is a silent drop point, and a field
is not "wired" until something walks the whole path.** Both ends of this one were
built in the same session, tested at both ends, and shipped broken through the
middle. The tests asserted that the box BUILDS the field and that reuse CONSUMES it;
nothing asserted anything in between, so 18 green tests coexisted with a feature
that had never worked once. Same shape as the `flowId` and live-item duplications
already commented in `generationService` — this repo drops fields in mappers,
repeatedly, and only a test that names the mapper catches it.

**Why the user-ux pass could not see it.** Reuse DID restore a prompt — the enhanced
one, via `positive: _shortPrompt || _enhancedText` falling through exactly as
designed for an un-enhanced card. A card with no `sourcePrompt` is indistinguishable
from one that was never enhanced, so the failure renders as the correct behaviour of
a different case. It is also why **"Reuse after an app reload"** never passed: there
was nothing stored to reload.

**Fix:** `sourcePrompt` added to both destructures and both config literals (4 lines).
**Verified:** `tests/enhance-overlay.test.cjs` 18 → 19, the new assertion proven to
fail on HEAD's pre-fix source by script (`git show HEAD:<path>`), not by eye. 933/933,
lint clean. The suite count is a SHARED-TREE number — peers landed tests in the same
window; one of the six is this one.

**Not healable, and it needs a fresh render to verify.** The seven existing cards have
no short prompt anywhere on disk — the enhanced text is all that was ever written, so
there is nothing to reconstruct it from. Closing this leg needs a NEW enhanced
generation, then Reuse, then Reuse again after an app RELOAD.

## THE DOG EXPERIMENT — run, 30 runs, and it refutes BOTH candidate causes (2026-09-12)

`a man walking his dog` → `illustrious` t2v, via `selectSystemPrompt()` and the app's
own `OllamaEngine`/`DeepInfraEngine`. Nothing was edited first, per the handoff.

| enhancer model | role | animal kept | leash kept | subject kept |
|---|---|---|---|---|
| `google/gemma-4-26B-A4B-it` | **the shipped CLOUD default** | **10/10** | 10/10 | 10/10 |
| `gemma4:e4b` | the shipped LOCAL default | **10/10** | 9/10 | 10/10 |
| `huihui_ai/gemma-4-abliterated:12b` | **the model of record** | **4/10** | 9/10 | 10/10 |

**The hypothesis was posed backwards.** It read "the shipped path runs the weaker
instrument; the recipe was measured on the 12B". The measurement says the opposite:
both shipped models keep the dog every single time, and **the model every v1 recipe is
green on drops it in 6 runs out of 10**.

**The consequence is a decision, not a curiosity.** Switching the default enhancer to
`gemma-4-abliterated-12b` is a live question — it is MPI-728's third gap and it was
recorded here as Fabio's product call. On this evidence that switch would **introduce**
the defect it was being considered to fix. It does not settle the switch (one recipe,
one input), but it inverts the burden of proof.

**The tell, and it is worth more than the counts:** the 12B keeps `holding leash` 9/10
while dropping the animal 6/10. It writes a man holding a leash attached to nothing.
That is not a budget problem or a vocabulary problem — the tag naming the thing is
absent while the tag describing the relationship to it survives, so the recipe's rule 1
("never their furniture and never their pets") has nothing pinning it for this model.
An exemplar showing a person WITH an animal is still owed; it is now owed for the 12B,
not for the path users are on.

### A recorded claim that is wrong: "the shipped SFW path runs `gemma4:e4b`"

It runs `gemma4:e4b` **only when there is no DeepInfra key.** `chooseBackend()` returns
`'deepinfra'` whenever the server reports a key (`routes/llm.js:70`, `:83`), and
`chooseEngineModelId()` then sends `undefined` so DeepInfra takes the registry default —
`google/gemma-4-26B-A4B-it` (`llmEngines.mjs:52`). **Fabio has a key**, so unless he
pinned a backend in localStorage, his enhance ran in the cloud on a model neither the
handoff nor rounds 1–2 of this experiment had touched. The local `e4b` reading was an
inference from `DEFAULT_MODEL_ID` that skipped the backend branch above it.

### Fabio's original dropped dog is NOT reproduced

20 runs on the two shipped paths, zero drops. His run is real and was seen, so what it
measured is still open — a pinned backend, the in-graph ComfyUI encoder
(`chooseBackend` sends uncensored cards there), or a different input. **It is not the
shipped SFW path on this recipe.** Worth noting that the card he generated immediately
afterwards, `t2i_002`, DOES carry `dog` in its stored prompt.

Raw runs: `scratchpad/dog-runs.json`, `scratchpad/dog-runs-deepinfra.json` (session
scratchpad, not committed).

### CORRECTION, same day: Fabio's enhance runs LOCAL, not in the cloud

The section above reasoned that a DeepInfra key makes `chooseBackend()` return
`'deepinfra'`, so his enhance ran on `google/gemma-4-26B-A4B-it`. **His screenshot
says otherwise: the provenance line reads "Enhanced by gemma4:e4b for ILL Anime."**
The app's key lives in its own secret store, not in the `~/.secrets/di.txt` file the
measurement scripts read, so the app has no key and falls to Ollama.

The measurement is untouched — `e4b` keeps the dog 10/10 either way, and the cloud
model was worth measuring. What was wrong is the claim about which one HE ran. **A
backend inferred from config is a hypothesis; the provenance line is the reading.**
That line exists because round 2 put it there, and it answered this in one glance.

## `lightingg` — a malformed final tag on the SHIPPED local model (2026-09-12)

Visible in Fabio's own screenshots twice (`volumetric lightingg`, `soft lightingg`)
and initially read as a typo. It is not:

| enhancer | malformed final tag |
|---|---|
| `gemma4:e4b` (shipped local) | **8/10** |
| `huihui_ai/gemma-4-abliterated:12b` | 0/10 |
| `google/gemma-4-26B-A4B-it` | 0/10 |

The obvious suspect was the prompt's tail. `illustrious`'s `systemPrompt` deliberately
ends on a bare, unterminated tag line whose last two words are `cinematic lighting` —
the MPI-25 pony finding that the prompt's own last characters set the model's first
ones. **Tested and REFUTED:** bare tail 8/10, tail + newline 9/10, tail + comma 7/10.
Terminating it changes nothing; the variation is noise.

So it is the model, not the recipe, and it is confined to the one model users are
actually on. **Nothing was changed** — `illustrious` is green 24/24 and an edit owes
two clean sweeps, so a recipe edit on refuted evidence would be paid for twice. Left
for a recipe card to decide with the rate in hand. Note a `forbiddenPatterns` entry
would FAIL the run rather than repair the tag, which is the honest behaviour but not
a fix.

## Step 1c — CLOSED (2026-09-12)

Fabio drove the last leg himself: new prompt → Enhance → OK → generate → **restart
the app** → Reuse. The short prompt returns to the box, the enhancement returns to
the overlay, the provenance line names engine and target model. Nine defects across
three rounds, all fixed. The reload leg could not have passed a day earlier — round 3
is why.

## Flows follow the pick + the borrowed Klein encoder — service side (2026-09-13)

**Automated, all green:**
- `npm test` 966/966 (961 before + 5 new in `tests/llm-service.test.cjs`);
  `tests/enhance-control.test.cjs` 7/7; `tests/inject-params-titles.test.cjs` green.
- eslint clean on `js/services/llmService.js` and `js/data/modelConstants/models.js`;
  `node --check routes/llm.js`; `services/llmEngines.mjs` imports.
- **Three mutations, each RED, each file restored byte-exact** (script in the session
  scratchpad): `gi` → `g` fails `testServerTextGetsTheGraphPipeline`; dropping the
  forwarded `maxTokens` from `complete()` fails `testEnginesForwardTheTokenCap`; dropping
  `flux2` from the borrow list fails `testTheEnhancerBorrowsKleinsEncoder`. The script's
  first run reported all three SURVIVING — it read stdout, and this runner prints `FAIL`
  through `console.error`. Fixed and re-run; the RED results are from the second run.

**Facts the design stands on, measured rather than assumed:**
- ComfyUI `RegexReplace` defaults `case_insensitive=True`, `count=0`; `StringReplace` is
  `str.replace` — `G:\ComfyUi\ComfyUI\comfy_extras\nodes_string.py` (bench v0.34.2; the
  app pins v0.34.0).
- `Qwen3_4B` and `Qwen3_8B` both carry `BaseGenerate` — `comfy/text_encoders/llama.py:1214,1232`
  — so `TextGenerate` runs on Klein's encoders. Both Klein graphs already carry a
  `TextGenerate` chain on that loader, baked off.
- The enhancer's node 13 `MpiClearVram` calls `unload_all_models()` —
  `ComfyUi-MpiNodes/vram.py:11`. A borrowed encoder therefore goes back to RAM before the
  generation; the saving is the second encoder's disk load and RAM, not a warm VRAM copy.

**NOT verified:** nothing driven live. The flow path is unreachable until `MpiBaseFlow`
calls `enhanceFlow` (held on MPI-747's claim `c15cce05`), and the Klein borrow needs a GPU
run — Fabio's `user-ux` check.

## The call site, and two defects Fabio's check found (2026-09-14)

**Swap:** `MpiBaseFlow._runEnhance` calls `enhanceFlow`; `tests/enhance-control.test.cjs`
now also fails if it calls `runComfyEnhance` directly.

**Live, Fabio:** DeepInfra (Gemma 4 26B A4B) × Character Sheet Enhance returned one line,
no "no …" clause, no trailing full stop. `app.log` shows no ComfyUI prompt that day, so
the server path answered (the route logs only failures).

**Defect 1 — Enhance dead after reopening Character Sheet.** Fabio reopened the flow:
the phrase box held his brief verbatim, and Enhance changed nothing. Root cause: the
"no Enhance pressed → run the raw prompt" fallback was applied inside `_collectInputs`,
whose output is ALSO the session snapshot (`_persistInputs`) and the sidecar
`flowInputs`. So the brief was saved as `Input_Positive`, `_seedField` restored it with
no `enhanceWrote` mark, `_mayEnhanceWrite` read it as the user's writing, and
`_writeEnhanced` discarded every answer silently. Reuse of any unenhanced card: same.
- Fix: `withEnhanceFallback` (`js/utils/declaredFields.js`) builds `runInputs`, which
  `submitFlowGeneration` strips before `flowInputs` exactly like `runMediaItems`.
  `enhanceEchoTargets` drops an OLD snapshot's echo on seed (target == source verbatim,
  not Enhance-owned): lossless, the brief is still in its own box.
- Blast radius, measured by script over `flowsRegistry.js`: only `character-sheet`
  (`Input_Positive`, both surfaces). `minimax-music` is a marker map (no fallback); no
  `derived` or step `param` id collides with a visible field.

**Defect 2 — the picker hid which Gemma runs.** One registry entry is `gemma4:e4b` on
Ollama and `google/gemma-4-26B-A4B-it` on DeepInfra, both labelled "Gemma 4 (Default)".
`names` per backend + `modelName()`; `/llm/models`, `/llm/ollama` and the enhance route's
not-downloaded error use it. Provenance already reported the real id.

**Automated:** `npm test` 969/969; lint clean; `node --check routes/llm.js`.
`tests/flow-model-choice.test.cjs:640` pinned the old `inputs.injectionParams` text and
was updated to `run.injectionParams` (same merge order, same guard).
**Five mutations, each RED, each file restored byte-exact** (scratchpad `mutate.py`):
fallback back in `_collectInputs`; `runInputs` not stripped; echo ignores ownership;
fallback mutates the snapshot; one name for both backends.

**NOT verified:** the reopen repair and the new labels in the app (needs an app restart:
`routes/llm.js` and `llmEngines.mjs` are server-side). Ollama, ComfyUI and Music Maker
still owe Fabio's check.

**Live, Fabio, after the restart — Character Sheet PASSES on all three backends:**
- Ollama (Gemma 4 E4B): wizard enhanced; editing the brief emptied the phrase (placeholder
  back, button hot); re-Enhance wrote a new phrase that carries the added "yellow gem".
- ComfyUI (Qwen3-VL 4B graph): same brief, one line, recipe shape, no trailing stop.
- Recipe observation, not a code defect: both Ollama E4B phrases added a "gunbelt" (one
  "a working cowboy's gunbelt and a hunter's quiver") to a wizard. That is rule 4's own
  example list in the Character Sheet system prompt (`qwen3vl_4b_prompt_enhancer.json`),
  copied verbatim by the 4B although rule 3 applied (the user named a staff). The 26B and
  the ComfyUI Qwen did not do it. Changing the recipe changes ComfyUI output too: Fabio's call.

**Refusal message (Fabio: "yes add the feedback message").** `_runEnhance` now checks
`_enhanceTargets(d).some(_mayEnhanceWrite)` BEFORE dispatching and warns
`"The character phrase" is your own text. Clear it first, then Enhance.` — no GPU job or
billed call for an answer that would be discarded. `_writeEnhanced` keeps its own check
for text typed mid-run. `npm test` 970/970, lint clean; removing the guard turns the new
test RED (scratchpad `mutate2.py`).

## The rest of the user-ux check, run by the agent at Fabio's request (2026-09-14)

Fabio could no longer reproduce the reopen bug (the phrase came back empty after a
backend switch and a return, button hot) and asked the agent to run the remaining checks
itself. None touched his app on :3000 or its engine on 48188.

- **Refusal message — desktop spec, own Electron on port 64414:**
  `tests/desktop/flow-enhance-writes-textarea.spec.js` 2/2. The new test types the brief
  and a phrase, presses Enhance, and asserts the exact warning, the phrase untouched, and
  the label never reading "Enhancing…" (nothing dispatched).
- **Song (`minimax-music`) on DeepInfra and Ollama — scratchpad `song_backends.mjs`**, the
  same steps as `enhanceFlow`'s server branch (source text built like
  `_enhanceSourceText`, graph defaults + Song's params, ChatML unwrapped, cap 800, graph
  post-processing, `_writeEnhanced`'s marker split), under `gpu_lease.py`. Skips only the
  `/llm/enhance` hop Character Sheet crossed live. Result `song_result.json`:
  - DeepInfra `google/gemma-4-26B-A4B-it`, 7.1 s, 1,177 chars: MOOD / VOCAL / ARRANGEMENT
    all filled, one line.
  - Ollama `gemma4:e4b`, 10.9 s, 589 chars: all three filled, one line; model unloaded.
  - The unwrapped system prompt carries no ChatML marker. DeepInfra's reply keeps its
    closing full stop: Song's `Input_Tidy` is `\s+$` by design (prose, not a spliced phrase).
- **Klein 9B prompt-box Enhance on ComfyUI — BENCH 8188, scratchpad `klein_bench.mjs`**,
  injection built exactly as `enhance()` builds it for `klein-9b` (`enhanceRecipe: 'flux'`
  → recipe `flux-2`, `buildComfyInjectionParams`, `enhancerClipParams(klein_9b_t2i.json)`),
  under `gpu_lease.py`. `Load CLIP` ran `qwen_3_8b_int8_convrot.safetensors` / `flux2`;
  status `success`, 65.9 s including the encoder load, no execution error; output one
  line: "a lighthouse keeper stands alone on a cliffside tower during a violent storm, …".
  Bench models freed afterwards (`POST /free`).
- **Song on ComfyUI — not re-run, by reasoning:** `enhanceFlow`'s `comfy` branch is
  `runComfyEnhance` with the declaration's params, the call Song shipped on (MPI-664),
  and Character Sheet crossed that exact branch live today.

**Correction, Fabio (2026-09-14):** `MpiClearVram` does NOT unload the models; it releases
VRAM and the models stay loaded (in RAM) and are reused when asked for again. The earlier
"a borrowed encoder therefore goes back to RAM ... not a warm VRAM copy" reading stands only
in that sense: no second load from disk. The timing job it motivated is dropped.

## Step 4a — the first app-knowledge playbooks (2026-09-14)

- `docs/agent/runpod-setup.md` and `docs/agent/gallery.md`, written for the agent. Every UI
  label checked against source (`MpiRunpodSettings.js`, `MpiEngineInstall.js`,
  `MpiGalleryGrid.js`, `hotkeyRegistry.js`), not copied from the Docs site.
- `app:operations` is RENDERED in `services/agentCorpus.mjs` from `commandRegistry.js` (label,
  info, help body) and `models.js` (`supportedOps`), per corpus decision 1: 16 model ops + 9
  tools. Flows and `promptEnhance` excluded; model names deduped (LTX 2.3 and Boogu Image Edit
  each appear twice in MODELS); ops no model runs are skipped (`extend`).
- **Plan verify:** `listCorpus()` returns `app:runpod-setup`, `app:gallery`, `app:operations`,
  each non-empty: `testTheFirstPlaybooksShip` + `testOperationsIsRenderedFromTheRegistries`.
  `node tests/agent-corpus.test.cjs` 6/6.
- Mutations on scratch copies (tracked files untouched): drop first op, drop info, let Flows in,
  drop a model, keep dead ops, no dedupe -> each RED in the operations test; eager app read ->
  RED in `testListingReadsNoFiles`; unmutated control green.
- `npm test` 970/970, exit 0. `npx eslint --max-warnings=0 services/agentCorpus.mjs
  tests/agent-corpus.test.cjs` clean.
- Docs-site drift found while checking labels, NOT actioned (sibling Docs repo): the Gallery page
  lacks the **Audio** filter and the **Archive** menu item; the install screen is now **Remote
  only -> Set up RunPod** (page: "Skip this - set up RunPod in Settings"); the Settings page lacks
  the **Skip the local engine install** toggle.
- **Heal trigger decided (Fabio, 2026-09-14): option A, a card he files.** Detection (a model
  version change in `models.js`) is not the trigger; it may come later as a nudge that files one.

## CI red on c81de709, and the line-ending class closed (2026-09-14)

- **Cause:** `tests/flow-enhance-ownership.test.cjs` searched `MpiBaseFlow.js` for
  `_enhanceTargets(d);\n`. The Windows runner checks out with autocrlf and `.gitattributes` pinned
  only `*.sh`/`*.command`, so the search returned -1 there and passed on this box. Reproduced
  without touching the tree: the `c81de709` test is 9/9 on LF and fails with CI's exact message
  ("_runEnhance must check its targets are writable") under a preload that turns every `js/`
  read into CRLF.
- **The instance:** fixed by the peer session (7231419c, Fabio's instruction) in `e4355f6b`
  (`\r?\n`); CI run 34828396585 green. This session released its overlapping claim and did not
  edit the file.
- **The class, Fabio's option B:** `64dfa46d` pins `*.js`/`*.cjs`/`*.mjs` to `eol=lf`. All 568
  are stored LF in the index, so nothing renormalized. Proof: a scratch repo with
  `core.autocrlf=true` checks `MpiBaseFlow.js` out 3596/3596 lines CRLF under the old attributes
  and 0 under the new. `git status` in the live tree unchanged by the edit (2 JS lines before and
  after, both this card's). **CI run 34832501738 green.**
- Three more tests anchored on `\n` (`auto-mask-inject-titles.test.cjs:25`,
  `auto-mask-pick-cache.test.cjs:77,120`) were silently widening their slice on CI; with LF
  checkout they now cut where they were written to.

## Step 4c — the heal leg, and the engine-recipes rule port (2026-09-14)

**In the tree, not committed:**

- `create-enhancer-recipe` gains **Phase 5 — Heal** in both tracked copies
  (`.agents/skills/…` and `.claude/skills/…`, `diff` identical). The trigger is a card Fabio
  files (his decision, option A) naming the recipe id, the modes shot, the findings path and his
  instruction. `description:` gains the heal triggers; the skill list picked the new one up live.
- `.claude/rules/engine-recipes.md` ported from Cubric-Prompt on Fabio's yes: 546 → ~200 lines.
  Dropped as Prompt-only: Zod, its engine-readiness UI, its Ollama lifecycle, the broker
  memory-release contract, and the stale "mode is hardcoded" / "nothing enforces the exemption"
  sections (Vision has `resolveMode()` and `ENHANCE_EXEMPT_OPS`). Every path and symbol it cites
  was checked to exist. Row added to `.claude/rules/README.md`; the playbook README's link to the
  rule, dead since the port, now resolves.

**Verify: a static dry run by a COLD sub-agent**, graded against the by-hand merge — Cubric-Prompt
MPI-27, `c761448`, `validation.md` § "The recipe changes" (6 changes). This session read that
answer key, so it could not be the test.

- Inputs: Phase 5 as written, a mock heal card carrying Fabio's real instruction, the pre-merge
  recipe (`Cubric-Prompt 02215cc`, 669 lines), the findings doc (unchanged since `81c6bec`,
  2026-08-15 — exactly what the hand merge read), the vendor repo via `gh api`.
- Barred: the post-merge recipe, `docs/recipes/research/`, the ported rule, all of Cubric-Prompt,
  the kanban, memory, git history. Every table row and edit had to cite a findings heading + line
  or a vendor file. No writes, no sweep, no GPU.

**Run 1 — a MISS, and every miss traced to Phase 5's wording, not to the agent.**

| Hand merge | Run 1 |
|---|---|
| 1 `[Shot N]` / `At MM:SS.mmm` notation (vendor) | **missed** — Phase 0 read the syntax; it never became an edit |
| 2 r2v single shot, no mandatory `CUT 1 / TRANSITION / CUT 2` | found — measured + vendor |
| 3 `wordBudget` from the encoder | found — r2v max 500 (the hand merge re-derived base and ref budgets) |
| 4 two named sound fields, `N/A` legal | found — t2v/i2v correctly marked vendor-only |
| 5 the bans that follow from 1 | missed, with 1 |
| 6 r2v reference rules (job, cite in-sentence, role ban, delivery before dialogue, every second written) | **partial** — role ban and the voice/dialogue syntax only |

Also budgeted 20 sweeps (per edit). No contamination (files-read list checked). Wording fixed:

- step 3 classified only the findings, so vendor rules from step 2 never met the recipe → step 2
  now diffs the vendor's documented format against the recipe mode by mode, and step 3 requires
  both sources;
- step 3 did not start from the production's own rule list → now it does, and every stated rule
  is a row even where the recipe is silent;
- step 6's "each edit resets the counter" read as per-edit → the count is per MODE on the final
  text, and "one format change per measurement" sits where `09` puts it, on Stage 2 rolls;
- no exception for model-level facts (the shared encoder) → step 1 adds `model` scope;
- `sources.md` row shape unstated → "in the shape of the rows already there".

**Run 2, on the fixed wording — better, still NOT a reproduction of the hand merge.**

| Hand merge | Run 2 |
|---|---|
| 1 `[Shot N]` notation | found in the vendor diff, then **deferred for r2v with a written reason** ("single shot is the default; needs its own roll"). **t2v/i2v never diffed** — the diff table compared the vendor only against r2v, though `base-en.txt` IS the T2VA/I2VA guide |
| 2 r2v single shot | found — measured + vendor |
| 3 `wordBudget` from the encoder | row correctly tagged `model`, but the **edit raised r2v's `BUDGET` only**; `BEAT_BUDGET` (t2v/i2v, same encoder) stayed at 230 |
| 4 two sound fields, `N/A` legal | found for r2v; t2v/i2v deferred to "a separate card" as a hypothesis, though the vendor documents them for those modes |
| 5 the bans that follow from 1 | n/a — 1 deferred |
| 6 r2v reference rules | mostly — "give every asset a job" correctly **confirmed** (the pre-merge recipe already had it), inheritance ban, voice-reference + `<d>` syntax; not found: "cite each reference inside its sentence", "every second written" |

Plus one edit the hand merge did not make and the findings support: no mix language (measured
A/B on two scenes). Sweep budget now per mode (2). Files-read list clean.

**One root cause left, seen in both runs:** the agent read "a finding from a mode the production
did not shoot is a hypothesis" as "that mode is out of scope", and stretched it to VENDOR evidence
and to `model` facts. Wording fixed a second time, **not re-run** (the brief allowed one re-run):
step 2's diff now covers every mode the recipe declares, because vendor evidence is scoped by the
vendor's document, not by the production; step 5 lands a `model` row's edit in every mode on that
encoder or node, and a `vendor` row's in every mode the vendor document covers. The two reference
rules run 2 missed look like reading depth, not wording.

**Status: Phase 5 is written, and two graded cold runs improved it, but it is NOT yet verified to
reproduce the hand merge.** A third run is Fabio's call.

**Run 3, on the second rewording (Fabio asked for it, 2026-09-14) — still NOT a reproduction.**
One cold `general-purpose` agent, the brief's prompt verbatim with only `<SCRATCH>` filled in.
Inputs re-staged: card copied, `Cubric-Prompt 02215cc` → 669 lines, findings still `81c6bec`,
both skill copies `diff`-identical and committed. Result: 192 lines, 12 table rows, 7 edits.

| Hand merge | Run 3 |
|---|---|
| 1 `[Shot N]` notation | **missed, third run running.** Seen in the t2v/i2v vendor diff and in findings L217–220, then deferred in EVERY mode: r2v keeps `CUT 1 / TRANSITION / CUT 2` because moving notation "at the same time is a second format change and must wait for its own card and measurement"; t2v/i2v "untested in any mode". It never became a step 3 row, so step 5 never had to turn it into an edit |
| 2 r2v single shot | found — r2v, measured + vendor (§ Shot count is the user's, L83–95) |
| 3 `wordBudget` from the encoder | **fixed since run 2:** row tagged `model`, edit lands on BOTH `BUDGET` (r2v) and `BEAT_BUDGET` (t2v/i2v). Direction only: `max` left blank for Fabio, where the hand merge took 400/600 from the vendor docs |
| 4 two sound fields, `N/A` legal | **fixed since run 2:** r2v measured (L221–230, two seeds) + vendor; t2v/i2v in Edit B and in the sweep budget, labelled vendor-only, "read their outputs". But the report's own §2 calls the t2v/i2v half "Deferred", which contradicts its edit list |
| 5 the bans that follow from 1 | missed, with 1 |
| 6 r2v reference rules | partial. Cite-in-sentence correctly **confirmed** (pre-merge L619 has it); give-every-asset-a-job is already in pre-merge (L575, L610), not rowed; delivery-before-dialogue and `<d>` syntax found (Edits D, E). **Missed:** the inheritance/role ban (findings L126, L151–152, which run 2 found) and "every second written" (L997, L1269) |

The rest of the pass bar holds: no t2v/i2v change claimed as measured, harvest listed before
edits, sweeps per mode (3 × 2 = 6), files-read list clean (six files, three read-only `gh api`
calls). Citations spot-checked: L61, L75, L83–95 and L221–230 are correct. One heading is wrong:
the sound-field bullets sit under `## Open questions`, and the report cites them as "Verified".
Two edits go beyond the hand merge, and the evidence supports both: a voice reference must not
contain its own line (§ 2026-08-13, L1272, Edit F), and 8 vendor camera terms in every mode
(`base-en.txt` §4.3, Edit G, labelled vendor).

**Verdict: MISS.** Run 2's root cause is closed: vendor and `model` evidence now reach t2v/i2v.
What remains is change 1, missed in all three runs, and this run gives the reason in its own
words. It read step 5's *"One format change per measurement"* as grounds to defer a vendor
notation, though the same sentence limits that rule to Stage 2 and says it "does not multiply
Stage 1 sweeps". Two more openings let the deferral through. The notation difference sat in the
step 2 diff but never became a step 3 row, though step 3 asks for one row per difference, per
mode. And step 5's "a reason only when it names the measurement it waits for" accepted "its own
card and measurement", which is really a Stage 1 sweep.

Candidate wording fix, **NOT made** (no fourth run without Fabio). Step 5: a vendor-documented
notation that differs from the recipe's replaces it in this merge, in every mode the document
covers. The one-format-change rule never defers a Stage 1 edit, and a sweep is not a measurement
a deferral can name. Step 3: every row of the step 2 diff enters the table before step 5 reads it.

Procedure gaps the runner raised that are worth keeping:
1. A vendor doc can hold both input syntax and a rewriter's intermediate format (H3's
   six-section shape), and Phase 5 does not say which layer the diff targets.
2. Nothing says whether a deferred edit still counts its mode as touched.
3. Nothing covers an edit whose value needs a measurement the findings lack (the budget `max`).

One defect is the brief's, not Phase 5's: step 4's "`sources.md` row in the shape of the rows
already there" cannot be followed while `docs/recipes/research/` is forbidden.

**Status: 4c NOT ticked. Back to Fabio:** reword steps 3 and 5 and run a fourth, or accept
Phase 5 as it stands with change 1 recorded as a known miss.

**Reword 3 (Fabio: "reword", 2026-09-14), then Run 4 on the same brief.** Both skill copies,
`diff`-identical:
- **Step 3:** every step 2 difference becomes a row, one per mode, including those you expect
  to defer. "A difference that never becomes a row is never decided."
- **Step 5, notation:** a notation the vendor documents replaces the recipe's own in this
  merge, in every mode the document covers.
- **Step 5, rejections:** a format the recipe already rejects with a written reason stays
  rejected unless the evidence answers that reason. This is the runner's gap 1, the vendor's
  six-section rewriter shape.
- **Step 5, deferrals:** a deferral must name a measurement the heal cannot run (a Stage 2
  render, or a decision of Fabio's), never a Stage 1 sweep.
- **Step 5, format changes:** *one format change per measurement* is a Stage 2 rule that never
  defers a heal edit.

Not addressed by wording: the role ban and "every second written", which look like reading
depth. The brief stays verbatim, so its `sources.md` defect stands. Run 3's `result.md` was
moved out of the staging folder (to `heal-run3-result.md`) so run 4 cannot overwrite it.

**Run 4, on reword 3 — change 1 FOUND for the first time, still NOT a full reproduction.**
Same brief verbatim, same staged inputs. Result: 236 lines, 16 rows, 6 edits (A–F), 2 deferrals.

| Hand merge | Run 4 |
|---|---|
| 1 `[Shot N]` notation | **found in every mode, through the vendor diff:** rows 2/7/8, Edits A (r2v), E (t2v), F (i2v). Reword 3 closed this. One flaw: r2v's notation is labelled "measured (24 clips)", but findings L215–216 say whether the syntax changes output "is untested"; the 24 clips were single-cut prose. Hand merge basis: vendor |
| 2 r2v single shot | found — r2v, measured + vendor (row 1, Edit A) |
| 3 `wordBudget` from the encoder | found — rows 4/9 tagged `model`, Edit D on `BUDGET` (r2v → 120–500) and `BEAT_BUDGET` (t2v/i2v max → 400), sized from the vendor's 350–500 target. Hand merge: `BASE` 50–400, `REF` 200–600 |
| 4 two sound fields, `N/A` legal | found — r2v measured (S14, two seeds) + vendor; t2v/i2v rows 5/6 vendor-only; Edit B in every mode |
| 5 the bans that follow from 1 | follows, unspecified — Edits E/F retire `LONE_TIMESTAMP` / `UNMARKED_BEATS` / `REPEATED_SPAN` "with equivalent patterns"; no stamped-`[Shot 1]` ban named, no ban on r2v's retired `CUT 1:` markers |
| 6 r2v reference rules | **missed.** No row for job or cite-in-sentence (both already in the pre-merge recipe), the inheritance/role ban (L126), delivery-before-dialogue (§ 2026-08-13, L1352) or every second written (L997, L1269). Run 3 had delivery-before-dialogue |

The rest of the pass bar holds: no t2v/i2v change claimed as measured, harvest before edits,
sweeps per mode (6), files-read list clean (six files, three `gh api` reads). Citations
spot-checked: L63, L75, L146, L222–230 and L999–1006 are correct. Row 1's "line 200" is really
L206, under `## Open questions`.

**Two new faults, and both are worse than a miss:**

- **An edit that breaks a measured rule.** Edit B puts the constraint line BEFORE the two
  sound fields. Findings § Three traps, L136–142, is measured: "one camera line, one audio
  line, one constraint line, in that order, nothing after". The hand merge kept the constraint
  line last. Run 4 never made trap 1 a row (run 3 had it as a confirm), so nothing checked the
  edit against it.
- **A deferral resting on an invented decision.** Row 12 (`<d>` dialogue tags, `(Sx)` speaker
  IDs, audio reuse vs reference) is deferred as "part of the six-section format … that Fabio
  has not authorised adopting", citing L1343. But L1339–1344 defers only the six-section OUTPUT
  FORMAT. The dialogue syntax is measured in L1306–1337 (two prose rolls failed, two syntax
  rolls worked), and no input records any decision of Fabio's. Reword 3's "a decision of
  Fabio's" opened the door, and the runner flagged its own doubt (its gap 3).

**Verdict: MISS on the pass bar (change 6), though change 1 is now fixed.** The root cause left
is step 3, and it shows in all four runs. The agent builds the table from what it judges
important instead of walking the production's rule sections. Measured rules that the recipe
already honours, or that sit in dated entries, never become rows, and a confirm that never
became a row cannot stop an edit that breaks it (Edit B).

Candidate wording fix, **NOT made**:
- **Step 3:** walk the findings' Verified and rule sections heading by heading, one row per
  stated rule, confirms included. Then check every proposed edit against the `confirms` rows;
  an edit that would break one is a contradiction to resolve, not a merge.
- **Step 5:** "a decision of Fabio's" means one quoted from the card or the findings, never
  inferred. A vendor syntax the findings call untested has basis `vendor`, whatever mode it
  lands in.

One confound: the brief caps `result.md` at ~240 lines, and runs 3 and 4 both ran close to that
cap. A limit a real heal does not have may be squeezing the table, but testing that means
changing the brief, which breaks comparability with runs 1–4.

**Status: 4c NOT ticked. Back to Fabio.**

**Reword 4 (Fabio: option 1, 2026-09-14), then Run 5 on the same brief.** Both skill copies,
`diff`-identical, applied by one script with an exact-match assert per replacement:
- **Step 3, findings source:** "walked rather than sampled". Go through the rule sections
  heading by heading, then every dated entry, one row per rule, with `confirms`,
  `contradicts` and `new` all required. "Judging which rules matter is step 5's job, not the
  table's."
- **Step 3, `measured` basis:** means rolls that tested THIS rule, not a neighbour of it. A
  vendor syntax the findings call untested is `vendor` in every mode.
- **Step 5, rejections:** a written rejection covers only what its reason names, never syntax
  the findings measured on its own.
- **Step 5, deferrals:** a "decision of Fabio's" used as a deferral must be QUOTED from the
  card or the findings, never inferred.
- **Step 5, confirms check:** before writing any edit, check it against every `confirms` row.
  An edit that would break one is not made, and the conflict is resolved in the table first.

Run 4's result moved to `heal-run4-result.md`. The brief is unchanged, so its ~240-line cap
confound stands.

**Run 5, on reword 4 — a MISS, and a regression from run 4.** Same brief, same inputs. Result:
204 lines, 11 rows, 3 edits, 2 deferrals.

| Hand merge | Run 5 |
|---|---|
| 1 `[Shot N]` | **missed again**, deferred in every mode, on two reasons that are both wrong. "Findings explicitly defer this A/B": L239–241 says the opposite, that `[Shot N]` and the sound sections "were adopted surgically", and only the six-section rewrite is deferred. "Belongs in its own card after at least one Stage 2 roll": step 5's deferral clause ("a Stage 2 render") lets that through, against step 5's own "replaces the recipe's own in THIS merge" |
| 2 r2v single shot | found — Edit B, measured + vendor. Keeps `CUT 1 / TRANSITION / CUT 2` for multi-shot |
| 3 `wordBudget` | **missed** — row 11 records `wordBudget.max: 230` as `confirms`, citing the very passage (L71–81) that calls the ceiling "not real" and warns the enhancer condenses to it |
| 4 two sound fields | found — Edit C in every mode, t2v/i2v vendor-only |
| 5 bans | missed, with 1 |
| 6 r2v reference rules | missed — not one of them is a row |

The rest of the pass bar holds: no t2v/i2v change claimed as measured, harvest before edits,
sweeps per mode (6), files-read list clean (it adds the vendor's own `SKILL.md`, which the brief
allows). Citations spot-checked: trap 3 at L155–159 and the six-section quote at L241 are
correct. Row 7's "measured (24 clips)" is inflated, because trap 2 (L144–149) rests on one
Cubric Prompt sweep.

**Step 3's walk was not done.** 11 rows from a 1,854-line findings doc gave the new confirms
check almost nothing to check against.

**Five runs, scored on the six changes:**

| Run (on) | 1 `[Shot N]` | 2 single shot | 3 budget | 4 sound fields | 5 bans | 6 ref rules |
|---|---|---|---|---|---|---|
| 1 (reword 0) | ✗ | ✓ | r2v only | ✓ | ✗ | partial |
| 2 (reword 1) | ✗ | ✓ | r2v only | r2v only | ✗ | mostly |
| 3 (reword 2) | ✗ | ✓ | ✓ | ✓ | ✗ | partial |
| 4 (reword 3) | ✓ | ✓ | ✓ | ✓ | loose | ✗ |
| 5 (reword 4) | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ |

**Verdict: MISS, and the reword loop is not converging.** Each reword closed its target in the
next run while something else fell out. Reword 4 only ADDED requirements, and run 5 still lost
two changes that run 4 had. With one sample per wording, run-to-run variance is bigger than the
effect of a reword, so another single run cannot tell a better wording from a lucky one.

**Two defects stand whatever comes next:**
- **Step 5 contradicts itself.** "A notation the vendor documents replaces the recipe's own in
  THIS merge" sits against "deferring … a Stage 2 render", and run 5 took the second.
- **The brief fights step 3.** A heading-by-heading walk of 1,854 lines is many dozens of rows,
  but the brief caps the whole report at ~240 lines. Runs 3–5 produced 12, 16 and 11 rows.

**Options for Fabio (recorded, none taken):**
1. **Fix the step 5 contradiction, stop testing, close 4c as a documented partial.** A heal's
   table reaches Fabio on the card before any sweep, so a missed row is caught there, not in a
   shipped recipe. Cheapest option; 4c closes as written and graded five times, not reproduced.
2. **Change the test, not the wording.** Fix the step 5 contradiction, move the table out to
   its own uncapped file, and run THREE cold agents in parallel on one wording, then grade the
   pattern. This measures the variance instead of guessing at it (~3 × 150k subagent tokens).
3. **Make step 3 mechanical.** Split it into a rule inventory first (every stated rule, quoted,
   with heading + line, as its own file), then classification against it, so a skipped rule
   shows up missing from a file. Then test it the way option 2 does.

Recommended: option 2, and option 3 only if uncapped runs still skip rules.

**Status: 4c NOT ticked. Back to Fabio, and no sixth run without him.** The run 3–5 results are
in the session scratchpad as `heal-run{3,4,5}-result.md`.

**Fabio chose option 2 (2026-09-14): change the test, not the wording.**

- **Reword 5, step 5 only**, both copies `diff`-identical: "A vendor notation row is never
  deferred, not even to a Stage 2 render — the notation sentence above already decided it, and
  the vendor document is its evidence." This closes run 5's escape.
- **Brief v2** (`research/heal-dryrun-brief.md`; v1 kept at `6c6b1a46`):
  - the classification table goes to its own `table.md` with no length cap;
  - three runs (6a, 6b, 6c) go in parallel on one wording, each writing only to its own `run-*`
    folder and forbidden to open the others;
  - the pass bar is a pattern, fixed BEFORE dispatch: each of the six changes in at least 2 of 3
    runs, no edit breaking a measured rule, no deferral on a misread citation or an unquoted
    decision, every files-read list clean.
  - A change found in 1 of 3 means the wording cannot hold it reliably. A change found in 0 of 3
    means a wording or structure gap, which is the case for option 3.

**Runs 6a–6c (brief v2, reword 5), graded against the pattern bar fixed before dispatch.** Three
cold runs went in parallel on one wording, each writing only its own `run-*` folder. Tables came
back at 31, 30 and 46 rows (runs 3–5: 12, 16, 11). Every files-read list is clean; 6a and 6b
also read the vendor's own `SKILL.md`, which the brief allows.

| Change | 6a | 6b | 6c | Held |
|---|---|---|---|---|
| 1 `[Shot N]`, every mode, via the vendor diff | ✓ | ✓ | ✓ | **3/3** |
| 2 r2v single shot | ✓ | ✓ | ✓ | **3/3** |
| 3 `wordBudget` from the encoder, every mode | partial — r2v → 400 tagged r2v, not `model`; t2v/i2v "raise to 300" filed under "Deferred rows" | ✗ — "about the MODEL's ceiling, not the enhancer's output budget"; notes only | ✗ — notes only; value deferred to "a new Stage 1 measurement", which step 5 rules out | **0/3** |
| 4 two sound fields, `N/A`, every mode | ✓ | ✓ | ✓ | **3/3** |
| 5 the bans that follow from 1 | loose — drops the span placeholder bans, adds an `At MM:SS.mmm` placeholder ban | follows — names `SPAN` / `LONE_TIMESTAMP` / `UNMARKED_BEATS` / `REPEATED_SPAN` for rewrite; a lone shot is `[Shot 1]` with no `At` | follows — bans the retired `CUT 1:` / `CUT 2:` and rewrites the span regexes | **2/3** (none names a stamped-`[Shot 1]` ban) |
| 6 r2v reference rules | 3/5 | 3/5 | 4/5 | **0/3 in full** |

Change 6 by sub-rule:

| Sub-rule | Held | Note |
|---|---|---|
| job | 3/3 | correct confirms |
| cite inside the sentence | 3/3 | correct confirms |
| delivery before the `<d>` tag | 3/3 | L1375 |
| inheritance/role ban | **1/3** | 6c Edit D only |
| every second written | **0/3** | L997, L1269 |

Also held 3/3: no t2v/i2v change claimed as measured, the constraint line stays last (no repeat
of run 4's Edit B), harvest listed before edits, and sweeps budgeted per mode (6).

**Faults:**
- **6a** defers `<Subject N>` as "Fabio's call": unquoted, and on a Stage 2 A/B that reword 5
  forbids for a vendor notation. That alone breaks the strict bar.
- **6b R24 confirms a rule the recipe does not contain.** Its "Recipe today" column quotes
  `CONSTRAINT_RULE` as saying "The one exception is a role ban". A `grep` of the pre-merge recipe
  finds no "role ban", no "one exception" and no inheritance ban anywhere. So the role ban reads
  as already shipped, and no edit adds it. 6c's row 19 repeats the same false quote, but 6c made
  the edit anyway.
- **6b R17** rejects the base-mode `integrated_multimodal_description:` as "part of the
  six-section format". That reason covers only the r2v rewriter shape, and 6a and 6c adopted the
  field.
- **Basis inflation in 3/3:** every run labels r2v's `[Shot N]` "measured", but findings
  L215–216 say it is untested whether the syntax changes output. Reword 4's "rolls that tested
  THIS rule" did not hold.
- **Reword 5 overreaches on `<Subject N>`.** Its "never deferred" pushed 6b to adopt a vendor
  label the hand merge left out, while 6a and 6c deferred it. The rule does not separate a
  notation that REPLACES one the recipe has from one the recipe has no counterpart for.

**Verdict: MISS on the pattern bar, but the gap is far narrower than in runs 1–5.** Uncapping the
table did it: the reference rules and the constraint-last rule came back once the table had room.

**Diagnosis, by the rule fixed before dispatch (0 of 3 = a wording or structure gap):**
- **Change 3 is a wording gap.** All three runs read the encoder fact and then treated "the
  model's ceiling" as separate from "the enhancer's budget". Step 1's `model` exception says a
  model fact holds in every mode, but never that it contradicts every recipe value SIZED to the
  limit it overturns. Findings L78–81 say exactly that: the enhancer condenses prompts to fit the
  fake ceiling.
- **"Every second written" and the role ban are a structure gap.** One sits as a bold "Portable
  rule" inside a dated entry (L995–997), the other inside `### The prompt shape` (L126). Tables
  of 30–46 rows still skipped them, and 6b's confirm rested on a quote nobody checked against the
  recipe. That is option 3's case: a rule inventory as its own pass, and every "Recipe today"
  quote verified verbatim against the recipe before a row can say `confirms`.

**Options for Fabio (none taken):**
1. **Option 3 now.** Split step 3 into two passes: first an inventory of every stated rule
   (heading, line, quote, including bold rule sentences in dated entries), then classification,
   with every "Recipe today" quote checked verbatim. Add the step 1 budget wording, and scope
   reword 5 to a notation that replaces an existing one. Re-test with brief v2's three-run
   pattern.
2. **Close 4c as a documented partial.** Phase 5 reliably carries notation, shot count and sound
   fields (3/3) and most of the reference rules. Write the two known gaps into step 7's hand-back
   as checks for Fabio: the budget, and portable rules in dated entries.

**Recommended: option 1.** The diagnosis fixed before dispatch points there, and both gaps are
specific.

**Status: 4c NOT ticked. Back to Fabio.** The results are in
`<scratchpad>/heal-dryrun/run-{a,b,c}/`.

**Fabio chose option 1, the option 3 build (2026-09-15).** It is handed to a fresh session; the
plan's Current State holds the four steps.

**Option 3 built (2026-09-15), then runs 7a–7c on brief v2.1.** Both skill copies `diff`-identical,
not committed:
- **Step 1:** a `model` fact that overturns a limit contradicts every recipe value sized to it
  (`wordBudget` first), in every mode on that encoder. An unmeasurable exact value is not a deferral.
- **Step 3 split.** 3a is the inventory: heading, line, exact quote; rules inside dated entries and
  descriptive sections count; vendor diff one line per mode; ends with a count. 3b is the
  classification: every inventory number lands in the table, and "Recipe today" is quoted and
  searched verbatim before `confirms`/`contradicts`. New `Inventory #` column.
- **Reword 5 scoped:** "never deferred" covers a vendor notation that replaces one the recipe has.
  A vendor label with no counterpart is an ordinary `new` row.
- **Brief v2.1:** output section 3 names the inventory too. Inputs, forbidden list and bar unchanged.
  Re-staged in this session's scratchpad: card, `02215cc` → 669 lines, findings still `81c6bec`.

Inventories 49 / 58 / 41 (7c never wrote its list out, only an `Inv #` column); tables 25 / 30 / 37
rows. Every files-read list is clean (7a and 7b also read the vendor `SKILL.md`, allowed).

| Change | 7a | 7b | 7c | Held |
|---|---|---|---|---|
| 1 `[Shot N]`, every mode | r2v only — t2v's span notation is `contradicts` in its own diff, then folded into an r2v-tagged row and never edited | ✓ Edits 3 + 9; r2v basis `vendor` | r2v only — t2v/i2v filed `new`, declined on "prior Stage 1 sweeps" and a Stage 2 render | **1/3** |
| 2 r2v single shot | ✓ | ✓ | ✓ | 3/3 |
| 3 `wordBudget`, every mode | ✓ `model`, 500 | ✓ `model`, 500 | ✓ both consts, 400 | **3/3** (was 0/3) |
| 4 sound fields, `N/A`, every mode | ✓ | ✓ | ✓ | 3/3 |
| 5 the bans that follow from 1 | r2v only | follows, loose — retires the three span bans, adds a placeholder ban, drops `CUT 1:` rather than banning it | r2v only | **1/3** |
| 6 r2v reference rules | 3/5 | 4/5 | 3/5 | **0/3 in full** |

Change 6 by sub-rule: job 3/3; cite inside the sentence 3/3; delivery before `<d>` 2/3 (7a gives
the syntax, not the placement); role/inheritance ban **2/3** (was 1/3 — 7a Edit 7, 7b row 29);
every second written **0/3**. Also 3/3: harvest before edits, sweeps per mode (6), constraint line
stays last.

**Faults:**
- **The quote check failed on the one row it was built for.** 7b R19 and 7c R14 confirm
  `CONSTRAINT_RULE` as saying "The one exception is a **role ban**". The pre-merge recipe has no
  such sentence (`CONSTRAINT_RULE` is L67; a Python substring count gives 0). It is verbatim in
  `docs/recipes/playbook/09-field-evidence.md:106`, which the procedure sends every runner to read —
  the source of 6b's identical false quote too. Every other "Recipe today" quote in the three tables
  was checked and is real, so the runners did search; they did not search this one.
- **7a row 15** confirms the location inheritance ban on a real quote that only gives each
  reference a job. Edit 7 adds the ban anyway.
- **7c rejects `<Subject N>` on "Fabio's quoted decision", L1340–1344.** Those lines defer the
  six-section format, are not Fabio's words, and never mention `<Subject N>`. A misread citation:
  this alone breaks the strict bar.
- **7a and 7c defer t2v/i2v notation** although the recipe has its own (`Shot 1 [0s-` ×5,
  `Timeline:`), so step 5's never-deferred clause applies. That is change 1 falling from 3/3 to 1/3.
- **The walk still skips dated entries.** 7a's inventory jumps from L241 to L999 ("2026-08-11 to
  2026-08-12 … no prompt-format rules"); 7b's from L240 to L999. L995–997 ("Portable rule … every
  second of the clip has something written for it") is in none of the three.
- Basis inflation down to 1/3: 7c R34 labels `[Shot N]` "measured (S14 confirmed)", but S14 tested
  the sound fields. 7a and 7b label r2v's notation edit `vendor`.

**Verdict: MISS on the v2 pattern bar.**

**Diagnosis:**
- Step 1's wording closed the budget, 0/3 → 3/3.
- The inventory did not force the walk. A runner can still call a stretch of dated entries "no rules"
  without listing it, so a skipped entry is invisible rather than a missing number.
- 3b's "several lines may share a row" let 7a fold a t2v/i2v vendor line into an r2v-tagged row, and
  the mode fell out with it.
- The quote check is self-reported. A runner that believes it has seen a sentence reports it found.
- As in runs 3–5, the round closed its targets and something else fell out (change 1: 3/3 → 1/3).

**Options for Fabio (none taken):**
1. **Close 4c as a documented partial.** Phase 5 carries shot count, budget and sound fields 3/3.
   Write the known gaps into step 7's hand-back as checks on the card: t2v/i2v notation moved, rules
   inside dated entries, each `confirms` quote's recipe line, the reference rules.
2. **One more structural round.** The inventory lists every heading and dated entry with its rules
   or `none`; a vendor line never shares a row across modes; a `confirms` row gives the recipe line
   its quote sits on. Re-run three.

**Recommended: option 1.** Seven graded runs show variance bigger than any wording's effect, and the
table reaches Fabio on the card before any sweep, which is where a missed row gets caught.

**Status: 4c NOT ticked. Back to Fabio.** Results in `<scratchpad>/heal-dryrun/run-{a,b,c}/`.

**Fabio chose option 1 (2026-09-15): 4c closes as a documented partial.** Phase 5 step 7 now
ends with four checks put on the card for Fabio: notation moved in every mode the vendor document
covers; rules inside dated entries are in the inventory; every `confirms` quote is really in the
recipe; rules stated in passing are rows. Both skill copies `diff`-identical. 4c is ticked on this
basis. **Phase 5 is NOT verified to reproduce the MPI-27 hand merge**, and no further dry run is
planned.

## Close-out yeses — 2026-09-15 (Fabio: "yes to all")

Each proposal was checked against disk before it went to Fabio, then applied:

1. `docs/playbooks/add-flow/ui/prompt-enhance.md` :58 and :185: already committed in `c81de709`.
   Kept. The symbols they name exist: `withEnhanceFallback` (`js/utils/declaredFields.js:421`),
   `postProcessLikeGraph` / `enhanceFlow` (`js/services/llmService.js:384` / `:575`).
2. `docs/llm.md` (new) + one `docs/README.md` row: no LLM doc existed (`ls docs/llm.md` failed,
   no `llm` hit in the README). Written by a background worker; its verification is recorded below.
3. `project-knowledge-index.md`: a "Language models" topic, none existed.
4. `.claude/rules/component-mounts.md`: the `MpiOllamaSetup` mount (slot, props, destroy, the
   `state`-driven rebuild) appended to the `MpiLlmSettings` line; no rule file named it before.
5. `.claude/rules/component-events-primitives.md`: an `MpiOllamaSetup` section (component-local
   `state` emit at `MpiOllamaSetup.js:79`, `el.setModel`, `el.destroy`).
6. `docs/releases/UNRELEASED.md`: one What's-new entry. `js/data/releaseNotes.js` had zero hits for
   Ollama / DeepInfra / language model, so no shipped note ever named it. Scoped to Prompt
   enhancement: Image descriptions' backends are MPI-737's. UI labels checked in code ("Remote"
   menu item `js/shell/projectUI.js:87`, "Language Models" / "Prompt enhancement" headings).
7. Memory `in-flight.md`: MPI-198/249 now read BLOCKED on Linux (needs a local engine the box
   cannot provision); `MEMORY.md` hook reworded to match.
8. Memory `tool_drive_a_remote_test_box_over_ssh.md`: dated 2026-09-13 line, a timeout means OFF.

`git diff --stat` on items 3-6: 23 insertions, 1 line changed, nothing else. Board validator passed.

Also closed on the way: **MPI-526** (stale umbrella, both members shipped), evidence in its own
`validation.md`.

**`docs/llm.md` checked by the orchestrator, not taken on the worker's word.** Under the 200-line
cap. Every backticked path exists (the two IPC channel shorthands verified at
`main/secretsStore.js:267-276`); all 45 backticked symbols grep-resolve. Spot-checked in code:
Image descriptions offers ComfyUI only (`MpiLlmSettings.js` `_renderDescribe`), `defaultBackend()`
= DeepInfra if a key else Ollama (`routes/llm.js:78`), safeStorage + AES-256-GCM fallback, the
"sub-10s render past 3 minutes" VRAM note (`routes/llm.js:323`), `Input_Seed` randomised
(`llmService.js:525`). Two fixes applied: the `routes/llm.js` role row (it also drives Ollama), and
`gemma-4-e4b` is a different model per backend (E4B on Ollama, 26B A4B on DeepInfra).
**The brief's NSFW premise was stale and the worker caught it:** MPI-728 removed the automatic
NSFW-to-local routing on purpose (`llmService.js` header, ~L118-135); the doc states the real rule,
a UI warning with the user's pick deciding. The step 1a checklist line is annotated accordingly.
Noticed, not actioned: a comment in `routes/llm.js` names `releaseLocalModels`; the call is
`OllamaEngine.releaseOwnModels()`.

## Close-out — 2026-09-15: step 1c had already closed, and the card closes

Checked before re-running anything:

- `git log -S "Step 1c — CLOSED" -- validation.md` → `de74431b` (2026-09-12), "step 1c closes, …".
  Its `--stat` names plan.md and validation.md only; checklist.md kept `[ ]` on step 1c.
- The later "1c is owed" lines trace to that box: a 2026-09-15 plan block reads "Per the
  checklist that is …", and handoff 7b777f9e copied its four checks.
- Covered by Fabio's own rounds (this file): reopen (round 1, item 1), the negative box (round 2
  items 7–8, round 2b), and Reuse after an app restart (§ Step 1c — CLOSED). Driven by an agent
  only (2026-09-10, port 3199): `OK → reopen` and the operation gate. **`OK → reopen → Cancel →
  reopen` was never driven by anyone** (§ "A test-script defect that was mine"); it rests on the
  source: `MpiPromptBox.js` wires the dialog's `cancel` to `_close` only, and `_enhanced` is
  assigned only on `apply`, the draft seed, the staleness check and Reuse. Caught by the
  close-out claim audit, after Fabio had been told an agent drove it.
- Fabio, 2026-09-15, shown the above: skip the re-run, go ahead with close-out. A re-run today
  would also have exercised MPI-774 Batch 1's uncommitted `MpiPromptBox` edits.
- Fabio, same message: nothing here tests the vision model; its smoke belongs to MPI-737 once
  the model is incorporated.

Closes on steps 1–4 ticked, step 5 spun out as MPI-774. Left open, not gates: step 1d, and the
`connector-manifest.json` line (MPI-774 owns it). `validate_board.py .` → "Board validation
passed." before the move.

## Step 1c — `OK → reopen → Cancel → reopen`, driven live (2026-09-15)

The one sequence the close-out audit found never driven. Fabio: "Yeah, you can do that with
the deepinfra key." The card stays done.

**Rig.** Own server, `CUBRIC_PORT=3199 node server.js`, `DEEPINFRA_API_KEY` exported in the same
call; `/llm/status` → `{"deepinfra":{"hasKey":true},…,"defaultBackend":"deepinfra"}`. No Electron
and no renderer boot, so no `/comfy/start` and no `/engine/repair-deps`: the real `MpiPromptBox`
mounted on a `/package.json` host page in `playwright-cli`, `sdxl-realistic`, op `t2i`, prompt
`a lighthouse at dusk`. `localStorage['cubric.llm.backend']` pinned to `deepinfra` first, because
the client default is `comfy` (a queued job on Fabio's engine). Every user action was a real
pointer `click`; reads were `eval`s of the dialog's textareas and `getRunPayload()`.

Caveat, stated to Fabio before the run: this tree carries MPI-774 Batch 1's uncommitted
`MpiPromptBox.js` edits, so the run exercised that WIP too.

| Step | Result |
|---|---|
| Control: Enhance → **Cancel** (no OK) → reopen | lower box `""`, note `""`, control not active, `positive` = the short prompt, `sourcePrompt` null. Cancel discards an unapproved enhancement, as designed |
| Enhance | 169-char SDXL tag string + negative `bad hands 5, bad dream, unrealistic dream:1.2, big eyes, camera`; note `Enhanced by google/gemma-4-26B-A4B-it for SDXL Realistic.` |
| **OK** | dialog gone; control `is-active`; box shows `a lighthouse at dusk`; `positive` === the enhancement, `sourcePrompt` = the short prompt, `negative` === the enhanced negative |
| **reopen** | lower box === the enhancement, negative box === the negative, note restored |
| **Cancel** | dialog gone; control still `is-active`; payload unchanged (all three equalities hold) |
| **reopen** | lower box === the enhancement (169 chars), negative box visible and ===, note restored |

Equalities are strict `===` against the text captured in the dialog before OK. At the wire,
`window.fetch` wrapped before mount: `/agent/history` (MPI-774's chat panel), `/llm/enhance` ×2,
**zero `/comfy`**. So *Cancel is non-destructive to an ALREADY-APPROVED enhancement* is now driven,
not source-backed. Fabio's :3000 and the engine on :48188 were not contacted; the 3199 server was
stopped afterwards.

### Step 1d, measured in MPI-774 (2026-09-17)

Recorded in `tasks/MPI-774/validation.md` § "ComfyUI enhance VRAM": nothing stays resident between
prompts on ComfyUI 0.34 (free VRAM back to 15.1 GB after every run), so an enhance does not make the
next generation cold. It also found that the Klein encoder borrow and `Replace Text.replace` never
reached the graph (fixed there). The step 1d text calling DeepInfra the default is stale: ComfyUI is.
