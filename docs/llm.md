# Language Models

Vision's own LLM client (MPI-677), which retired the round trip to Cubric Prompt's broker.
Three jobs run on it: **prompt enhancement** (the PromptBox Enhance button, and a Flow's own
Enhance), **image descriptions** (gallery/history right-click "Describe image", and the agent's
`look`) and the **agent** ([agent-chat.md](agent-chat.md)). The user picks where each job runs;
nothing infers it from the model or the content. The pick is **compute placement**, not a quality
ranking (Fabio, 2026-09-12): generating on a Pod, describe locally; generating locally, push the
text jobs off the card.

## Jobs and backends

| Job | ComfyUI | Remote | Ollama |
|---|---|---|---|
| Prompt enhancement | yes (default) | yes, needs the connection | yes, needs the model downloaded |
| Image descriptions | yes (default), needs the Image Describer plugin | yes, needs a vision model | no |
| Agent | no | yes, the only option (a fixed label) | no |

- **Remote** (code value `'endpoint'`, UI label "Remote", MPI-737 D2) is the ONE user-connected
  OpenAI-compatible connection (MPI-774): presets DeepInfra, OpenRouter, OpenAI, Ollama `/v1`,
  custom. `'remote'` is NOT used in code: it already means the RunPod GPU lane.
- **Ollama** stays its own backend beside Remote (D3): it owns install/start/pull and releases VRAM
  after every call, which a bare `/v1` connection does not.
- ComfyUI enhance and describe are gated on the `image-describer` plugin
  (`js/data/pluginsRegistry.js`, `requiredDeps: ['qwen3vl-abliterated-clip']`): the enhancer
  graph's default `CLIPLoader` and the descriptor graph load the same weight.

## Files

| File | Role |
|---|---|
| `routes/llm.js` | The `/llm/*` routes: what the renderer cannot do itself (use a connection's key, drive the Ollama app, read an image off disk). |
| `js/services/llmService.js` | Renderer-side: the prefs, recipe resolution (`enhance()`), Flow enhance (`enhanceFlow()`), the ComfyUI dispatch (`runComfyEnhance()`), the ONE describe switch (`describeImage()`). |
| `services/llmEngines.mjs` | `OllamaEngine`, `DeepInfraEngine` (any OpenAI-compatible URL), `ComfyUIEngine`, `MODEL_REGISTRY`, `resolveConnection`, `listRemoteModels`, `RECOMMENDED_REMOTE_MODELS`. Pure ESM, no Electron; shared with the recipe harness (`scripts/recipe-engines.mjs` re-export). Not in `scripts/`: that folder is excluded from the portable build. |
| `services/ollamaLifecycle.js` | Start / install / download for the desktop Ollama app. Server-side, so it survives the panel closing. |
| `main/secretsStore.js` | Connection profiles and their write-only keys. |
| `js/utils/describeAction.js` | The right-click "Describe image": calls `describeImage`, lands the text in the prompt box. |
| `js/components/Organisms/MpiLlmSettings/` | Remote panel's Language Models section: the connection block, then one row per job. |
| `js/components/Compounds/LandingPages/MpiOllamaSetup/` | The Ollama row: install / start / download, polled while busy. |
| `js/components/Compounds/MpiEnhanceDialog/` | The Enhance overlay: short prompt above, editable enhanced text below. |

## Prefs (`llmService.js`, localStorage)

| Key | Values | Read by |
|---|---|---|
| `cubric.llm.backend` | `comfy` (default) / `endpoint` / `ollama`. A stored `deepinfra` migrates to `endpoint` on read and is persisted. | `backendPreference()` |
| `cubric.llm.enhancerModel` | a `MODEL_REGISTRY` id: the **Ollama** pick | `enhancerModelPreference()` |
| `cubric.llm.endpointModel` | a raw provider id: the **Remote** enhance pick; empty = the server's recommended one | `endpointModelPreference()` |
| `cubric.llm.describeBackend` | `comfy` (default) / `endpoint` | `describeBackendPreference()` |
| `cubric.llm.describeModel` | a raw provider id; empty = the server's recommended one | `describeModelPreference()` |

Remote enhance has its OWN key because the shared `enhancerModel` sent a Remote id to Ollama. Both
`enhance()` and `enhanceFlow()` resolve it through `_endpointEnhanceModel(profileId)`: the Remote
pick, else a pre-MPI-737 DeepInfra pick (a registry id) mapped to its `deepInfraId` over
`GET /llm/models` **only on the `deepinfra` connection** (that id means nothing elsewhere), else
nothing. The connection itself is `Storage.getLlmConnection()` -> `{ profileId }`.

## Routes (`routes/llm.js`)

| Route | Does |
|---|---|
| `GET /llm/models` | The `MODEL_REGISTRY` catalogue for the Ollama picker (+ `deepInfraId` for the legacy mapping). |
| `GET /llm/ollama` | Read-only Ollama state: running, per-model downloaded/size/pull progress. |
| `POST /llm/ollama/start` | Starts an installed, stopped Ollama. Never installs. |
| `POST /llm/ollama/install` | Silent winget install, Windows only, reached only from the user's own click. |
| `POST /llm/ollama/pull` | Starts a model download; progress comes back over `GET /llm/ollama`. |
| `POST /llm/connection/probe`, `GET /llm/connection/models` | The shared connection (MPI-774; [agent-chat.md](agent-chat.md)). |
| `POST /llm/enhance` | One completion. Body `{ prompt, system?, backend, modelId?, maxTokens?, profileId? }`, `backend` **required**, `endpoint` or `ollama`: there is no server-side default. Replies `{ ok, text, backend, model }`, naming what actually answered. |
| `POST /llm/describe` | One image description on the connection. Below. |

- **`/llm/enhance` `endpoint`:** `resolveConnection(profileId, ask)`; a raw `modelId`, no registry
  lookup; none -> `recommendedModel(profileId, 'enhance')`. Errors `{ code, message }`
  (`BAD_REQUEST`, `NO_PROFILE`, `NO_KEY` - never for `ollama` - `ENDPOINT_ERROR`), flattened to
  text plus `errorCode` by `runServerBackend`, because every caller renders `error` as a string.
- **`/llm/enhance` `ollama`:** a registry id; a stopped Ollama is started, a missing install or
  model is reported by name, and VRAM is released in `finally` on every exit path.
- **`/llm/describe`** body `{ profileId, modelId?, imagePath, question?, crop? }` ->
  `{ ok, text, backend, model }` | `{ ok:false, error:{ code, message } }`, codes `BAD_REQUEST`,
  `NO_PROFILE`, `NO_KEY`, `ENDPOINT_ERROR`, `NOT_VISION`, `BAD_IMAGE`, `RUNTIME_ERROR`.
  `imagePath` is absolute or a `/project-file?path=` URL (the right-click sends the latter). The image
  is cropped, downscaled to <= 1 MP in 16-px steps (matching `image_descriptor.json` node 41, so
  `mapFromDescribeSpace` stays valid; it never upscales) and sent as a JPEG base64 `image_url` part.
  The default instruction is READ from node 38 (`Input_Describe_Prompt`) at runtime, never copied;
  node 38 unparseable -> `RUNTIME_ERROR`. A `question` replaces it as plain text (ChatML is
  ComfyUI-only). A 4xx naming image/vision input -> `NOT_VISION`, never a silent retry without the image.
- **`DeepInfraEngine(key, baseURL, profile)`** reports the profile as `backend` (never a hardcoded
  `'deepinfra'`). It borrows `DEEPINFRA_API_KEY` only for a DeepInfra URL (or none); a keyless
  connection (Ollama `/v1`) sends no `Authorization` at all.
- **`RECOMMENDED_REMOTE_MODELS`** carries exact ids per preset: DeepInfra enhance =
  `google/gemma-4-26B-A4B-it`, `google/gemma-3-12b-it`; describe =
  `meta-llama/Llama-4-Scout-17B-16E-Instruct` (live-checked 2026-09-16; not abliterated).

## Enhance paths

1. **Prompt box** (`MpiEnhanceDialog` -> `enhance()`). Resolves a per-target-model recipe
   (`resolveRecipeId`, `js/data/recipes/registry.js`) into a system prompt (`composeSystemPrompt`),
   then runs it on `chooseBackend({ override: backend ?? backendPreference() })`.
2. **Flow enhance** (`enhanceFlow()`). The user's pick with the Flow's own declared recipe. See
   [playbooks/add-flow/ui/prompt-enhance.md](playbooks/add-flow/ui/prompt-enhance.md) — **do not**
   wire a Flow into `enhance()`'s recipe resolution.
3. **The ComfyUI graph** (`runComfyEnhance()`). The *only* dispatch of the `promptEnhance` op: it
   queues `qwen3vl_4b_prompt_enhancer.json` through the normal generation queue and resolves on
   `onText` (a text op has no `onComplete`).

`comfy` and the server backends are not interchangeable rewrites of the same call — the ComfyUI
graph is a **pipeline**: after generation it strips newlines (`Replace Text`), deletes "no ..."
clauses (`Input_Scrub_Negation`) and trims trailing punctuation (`Input_Tidy`). A server enhance
carries it: `enhancerGraphDefaults(graph)` reads the graph's baked values at runtime (the caller's
params on top, same `Title.widget` keys) and `postProcessLikeGraph(text, params)` replays the three
text nodes. `enhancerClipParams(workflow)` lets the graph borrow the *generation* model's
`CLIPLoader` for `CLIPLoader.type` in `{krea2, flux2}` (`BORROWABLE_CLIP_TYPES`).

**`ComfyUIEngine` is not this path.** It submits a pipeline-free 4-node graph for the recipe
harness only; the app never instantiates it.

## Describe path

`describeImage({ imagePath, question, crop, scope, group })` -> `{ ok, via:'comfy'|'endpoint', text?,
errorCode?, error?, cancelled? }`, never rejects. Both callers use it: the right-click
(`describeAction.js`) and the agent's `look` (`agentDispatch._describeImage`, relay `agent.describe`).

- **`comfy`:** plugin check (`DESCRIBER_MISSING`), then an `enqueueGeneration` of the `imageDescribe`
  op - the only one outside `js/data/`. It rides the Cue, so it waits behind a generation, and on a Pod it runs on
  the Pod. A `question` is ChatML-wrapped into `Input_Describe_Prompt` (`buildDescribeInjectionParams`).
- **`endpoint`:** `POST /llm/describe` with the connection and `describeModelPreference()`. **Not
  queued**: it never waits behind a generation and never shows in the Cue.
- **Failure never falls back** (D1): no connection, no key, a non-vision model -> the caller says so.
  The right-click toast points at Remote settings only for an endpoint failure, keeps the Model
  Library warning for `DESCRIBER_MISSING`, and stays silent for a ComfyUI run failure (the
  generation pipeline reports it). The agent gets the code and message back.

## Settings (`MpiLlmSettings`)

One `GET /llm/connection/models` fetch per render (`_refreshModels`) feeds every Remote model
dropdown through `_remoteModelOptions(job, saved, filter)`: recommended-for-that-job first, labelled
"(recommended)". Remote is greyed only on `NO_KEY` / `NO_PROFILE` (`_remoteBlocked`); an unreachable
endpoint stays pickable and shows its error under the model list. The describe list keeps the
models the endpoint flags `vision` (plus the describe recommendation), and shows the whole list with a
"this provider does not say which models can see" note when it reports no flags. The Ollama-model dropdown comes from `GET /llm/models`. The DeepInfra sign-up
box tops the connection block; the key group hides for the keyless Ollama preset.

## Secrets

Keys are write-only: IPC `secrets:{set,has,clear}-endpoint-key`, **no get**; the forked server reads
profile + key over the fork bridge (`secrets:get-endpoint-profile-request`) and hands the key straight
to the engine — never logged, never returned by a route. A key is bound to the `baseURL` it was saved
with. The `deepinfra` preset's key is the old `deepInfraApiKey` slot (a key saved before MPI-774 counts
as bound to DeepInfra), never the `runpodApiKey` one. No IPC channel names DeepInfra any more.

## Ollama lifecycle (`services/ollamaLifecycle.js`)

- **Nothing runs at boot.** Ollama starts only when picked or enhanced on (`ensureOllama()` ->
  `'running' | 'started' | 'missing' | 'failed'`).
- On Windows it launches `ollama app.exe`, not a bare `ollama serve` — a detached console child of a
  console-less server would leave a visible terminal window open for the server's whole life.
- Install (`installOllama()`, winget, Windows only) and download (`startPull`/`pullState`, summed-layer
  byte progress) run **server-side**; `MpiOllamaSetup` just polls `GET /llm/ollama`.
- Never stopped on quit — Ollama is the user's own service.
- VRAM release (`OllamaEngine.releaseOwnModels()`, `keep_alive:0`) on every exit path: an idle local LLM
  sitting on VRAM was measured to push a sub-10s video render past 3 minutes.

## Rules a future change must not break

- **Nothing switches backend on its own.** No content-based switch (MPI-728 removed the `-nsfw`
  override and the `comfy -> ollama` downgrade: a LoRA can make any model uncensored), no server-side
  default, no fallback when the pick cannot run. A pick that later becomes unavailable stays selected
  with a note. The settings copy says a hosted model may refuse adult material; nothing enforces it.
- **A Flow calls `enhanceFlow()`, never `enhance()`.**
- **Every Remote model id is the connection's own.** Never send a `deepInfraId` to another provider,
  and never send a Remote id to Ollama.
- **`Input_Seed` is always randomised, never a user field, never persisted.**
- **One describe switch.** A new describe caller goes through `describeImage`, never its own enqueue.
