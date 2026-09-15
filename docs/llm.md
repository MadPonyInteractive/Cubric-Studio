# Language Models

Vision's own LLM client (MPI-677), which retired the round trip to Cubric Prompt's broker.
Two jobs run on it today — **prompt enhancement** (the PromptBox Enhance button, and a Flow's
own Enhance) and **image descriptions** (gallery/history right-click "Describe image") — on
three possible backends: the bundled **ComfyUI** engine, the cloud **DeepInfra**, or a local
**Ollama**. The user picks where each job runs; nothing infers it from the model or the content.

## Jobs and backends

| Job | ComfyUI | DeepInfra | Ollama |
|---|---|---|---|
| Prompt enhancement | yes (default) | yes, needs a key | yes, needs the model downloaded |
| Image descriptions | yes, only option | no | no |

Descriptions are ComfyUI-only because `services/llmEngines.mjs`'s `MODEL_REGISTRY` is four
text-only LLMs — none can look at an image. This is a measured limit, not missing plumbing;
MPI-737 owns growing it. Both jobs are gated on the same thing: the `image-describer` plugin
(`js/data/pluginsRegistry.js`, `requiredDeps: ['qwen3vl-abliterated-clip']`), because the
enhancer graph's default `CLIPLoader` and the descriptor graph load the same weight.

## Files

| File | Role |
|---|---|
| `routes/llm.js` | The `/llm/*` Express routes: the server-side half, for what the renderer cannot do itself (use the DeepInfra key, drive the Ollama app). |
| `js/services/llmService.js` | Renderer-side: backend/model preference, recipe resolution (`enhance()`), Flow enhance (`enhanceFlow()`), the ComfyUI dispatch (`runComfyEnhance()`). |
| `services/llmEngines.mjs` | `OllamaEngine`, `DeepInfraEngine`, `ComfyUIEngine`, `MODEL_REGISTRY`. Pure ESM, no Electron — shared with the Stage 1 recipe-research harness (`scripts/recipe-test.mjs` via the `scripts/recipe-engines.mjs` re-export). Moved out of `scripts/` because that folder is excluded from the portable build (`scripts/build-portable.mjs:135`); a route importing from there would work in dev and vanish from a shipped build. |
| `services/ollamaLifecycle.js` | Start / install / download for the desktop Ollama app. Server-side, so it survives the settings panel closing. |
| `main/secretsStore.js` | The DeepInfra key's storage (~line 157 on). |
| `js/components/Organisms/MpiLlmSettings/MpiLlmSettings.js` | Remote panel's Language Models section — one row per job. |
| `js/components/Compounds/LandingPages/MpiOllamaSetup/MpiOllamaSetup.js` | The Ollama row: install / start / download, polled while busy. |
| `js/components/Compounds/MpiEnhanceDialog/` | The Enhance overlay: short prompt above, editable enhanced text below, OK/Cancel. |

## Routes (`routes/llm.js`)

| Route | Does |
|---|---|
| `GET /llm/status` | `{ deepinfra:{hasKey}, ollama:{running}, defaultBackend }`. Never 500s — a probe failure reads as "not ready". |
| `GET /llm/models` | The `MODEL_REGISTRY` catalogue plus live DeepInfra prices (`fetchDeepInfraPrices()`, cached per-process). |
| `GET /llm/ollama` | Read-only Ollama state: running, per-model downloaded/size/pull progress. |
| `POST /llm/ollama/start` | Starts an installed, stopped Ollama. Never installs. |
| `POST /llm/ollama/install` | Silent winget install, Windows only, reached only from the user's own click. |
| `POST /llm/ollama/pull` | Starts a model download; progress comes back over `GET /llm/ollama`. |
| `POST /llm/enhance` | One completion. Body `{ prompt, system?, backend?, modelId?, maxTokens? }`. Replies `{ ok, text, backend, model }`, naming the backend/model that actually answered. |

`POST /llm/enhance`'s own fallback when `backend` is omitted is `defaultBackend()`
(`routes/llm.js:78`): DeepInfra if a key is stored, else Ollama. This is **not** the same
default as the UI's (`comfy` — see below) and is reached only by a caller that skips the
field; `llmService.js` always sends an explicit `backend`, so this path is normally unused.

## Enhance paths

Three different callers reach an LLM, and none of them agree on plumbing:

1. **Prompt box** (`MpiEnhanceDialog` -> `llmService.enhance()`). Resolves a per-target-model
   recipe (`resolveRecipeId`, `js/data/recipes/registry.js`) into a system prompt
   (`composeSystemPrompt`), then runs it on `chooseBackend({ override: backend ?? backendPreference() })`.
2. **Flow enhance** (`llmService.enhanceFlow()`). Runs the backend the user picked in Language
   Models, honouring the Flow's own declared recipe. See
   [playbooks/add-flow/ui/prompt-enhance.md](playbooks/add-flow/ui/prompt-enhance.md) for the
   `enhance`/button declaration shape — **do not** wire a Flow into `enhance()`'s recipe
   resolution; it must call `enhanceFlow()`.
3. **The ComfyUI graph itself** (`runComfyEnhance()`). The *only* dispatch of the `promptEnhance`
   op anywhere in the app: it queues the shipped `qwen3vl_4b_prompt_enhancer.json` through the
   normal generation queue and resolves on `onText` (a text op has no `onComplete`).

`comfy` and the server backends (`deepinfra`/`ollama`) are not interchangeable rewrites of the
same call — the shipped ComfyUI graph is a **pipeline**, not a bare completion: after generation
it strips newlines (`Replace Text`), deletes "no ..." clauses (`Input_Scrub_Negation`) and trims
trailing punctuation (`Input_Tidy`). A server-backend enhance must carry that pipeline or it
silently changes shape from what a recipe was tuned against:

- `enhancerGraphDefaults(graph)` reads the graph's four baked node values at runtime (never
  copied/hardcoded); the caller's own params sit on top of them under the same `Title.widget` keys.
- `postProcessLikeGraph(text, params)` replays the same three text-node transforms on a server
  reply.
- `enhancerClipParams(workflow)` lets the enhancer graph borrow the *generation* model's own
  `CLIPLoader` instead of its default 4B, for `CLIPLoader.type` in `{krea2, flux2}` only
  (`BORROWABLE_CLIP_TYPES`) — both are Qwen3 LMs the `TextGenerate` node can run.

**`services/llmEngines.mjs`'s `ComfyUIEngine` class is not this path.** It submits a minimal,
deliberately pipeline-free 4-node graph, used only by the Stage 1 recipe-research harness to
measure a model without a regex in the way. The app's own ComfyUI enhance never instantiates it.

## Model registry (`services/llmEngines.mjs`)

`MODEL_REGISTRY`: `gemma-4-e4b` (default on both backends, but NOT the same model: Gemma 4 E4B on
Ollama, `google/gemma-4-26B-A4B-it` on DeepInfra, so the two write noticeably different prompts), `gemma-3-12b` (the Stage 1 judge of
record), `dolphin3-abliterated` and `gemma-4-abliterated-12b` (uncensored, Ollama only — no
serverless catalogue carries an abliterated build). Coverage is asymmetric **on purpose**;
`getModel(id)` / `modelName(m, backend)` are the only lookups, and a model valid on one backend
can be absent on another (`routes/llm.js` answers that by name, never `model: undefined`).

## Secrets

The DeepInfra key lives in `main/secretsStore.js` under its **own** `deepInfraApiKey` slot,
never the `runpodApiKey` one — different vendor, different blast radius on a leak.
`setDeepInfraKey`/`hasDeepInfraKey`/`getDeepInfraKey`/`clearDeepInfraKey` follow the RunPod key's
encryption shape (OS `safeStorage`, else a derived-key AES-256-GCM fallback). **There is no
renderer-readable get channel** — only `secrets:set-deepinfra-key` / `secrets:has-deepinfra-key`
/ `secrets:clear-deepinfra-key` over IPC. The forked Express server resolves the actual value
on demand over the fork bridge (`secrets:get-deepinfra-key-request/-response`,
`secrets:has-deepinfra-key-request/-response` in `registerForkBridge`), and `routes/llm.js`'s
`deepInfraKey()`/`hasDeepInfraKey()` are the only callers. The value is never logged, cached to
disk outside the encrypted store, or returned by any route.

## Ollama lifecycle (`services/ollamaLifecycle.js`)

- **Nothing runs at boot.** ComfyUI is the default backend; Ollama starts only when picked or
  enhanced on (`ensureOllama()` -> `'running' | 'started' | 'missing' | 'failed'`).
- On Windows it launches `ollama app.exe` (the desktop app), not a bare `ollama serve` — a
  detached console child of a console-less server would leave a visible terminal window open
  for the server's whole life.
- Install (`installOllama()`, winget, Windows only) and model download (`startPull`/`pullState`,
  summed-layer byte progress) run **server-side**, so closing the settings panel does not stop
  either; `MpiOllamaSetup` just polls `GET /llm/ollama` back into view.
- Never stopped on quit — Ollama is the user's own service and may be shared with something else.
- `routes/llm.js`'s `/llm/enhance` always releases Ollama's VRAM in a `finally` block
  (`OllamaEngine.releaseOwnModels()`, `keep_alive:0`) on every exit path, failures included: an
  idle local LLM sitting on VRAM was measured to push a sub-10s video render past 3 minutes.

## Rules a future change must not break

- **NSFW routing is a UI warning, not a code gate.** MPI-728 deliberately removed the old
  `-nsfw`-suffix backend override, the silent `comfy -> ollama` downgrade, and the
  stored-key-picks-DeepInfra default — a LoRA can make any model uncensored, so "is this
  uncensored" was never a fact the model card could state truthfully. `MpiLlmSettings.js`
  tells the user a hosted backend may sanitise material a local build will not; nothing in
  `routes/llm.js` or `llmService.js` inspects the model or prompt to enforce it. Do not
  reintroduce an automatic content-based backend switch — the picker is where the user states it.
- **A Flow calls `enhanceFlow()`, never `enhance()`.** The latter resolves a per-target-model
  recipe for the prompt box; a Flow's recipe is its own declaration.
- **`Input_Seed` is always randomised, never a user field, never persisted** — a fixed seed
  returns the same phrase on every press.
- **Image descriptions cannot be routed to DeepInfra or Ollama today** — every registry model is
  text-only. Do not offer the choice in the UI ahead of a vision-capable registry entry.
