# MPI-774 Brief

**In-app agent, slice A.** MPI-677 step 5, spun out 2026-09-15 (Fabio: *"otherwise it's too many
cards waiting on too many cards"*). Designed in a brainstorm with Fabio the same day; every decision
below is his, including the defaults he accepted.

Parent spec: MPI-677 `brief.md` § "The product shape" and § "Decisions locked". Its constraints are
not re-argued here: **the user is the gate at every step**, **project is durable state, not the
transcript**, **the agent reads corpora rather than calling black boxes**, **every spend is
confirm-then-VERIFY**. This card is the first slice of that shape, not the whole of it.

## What slice A does

1. **Entry: an Agent | Prompt toggle on `MpiPromptBox`.** Agent mode turns the box into the chat:
   same expand behaviour, Enter sends, Shift+Enter is a line break, drag-and-drop images like the
   prompt box. **Also on the landing page**, for users who install without ComfyUI and need answers.
   With no project open it answers, recommends and installs, and asks for a project before it
   generates.
2. **The mascot is always in the prompt box.** Idle when quiet; a working animation whenever the
   agent is doing anything (thinking, a tool call, compacting). Placeholders until Fabio's
   animation repo delivers: `assets/mascot/idle.png` and `waiting.png`, already used by
   `MpiGalleryGrid` and `MpiGroupHistoryBlock`.
3. **Knows:** installed models, what each operation does (`app:operations`), hardware fit
   (`js/data/modelConstants/footprint.js`), recipes and app docs (`services/agentCorpus.mjs`
   `listCorpus()`).
4. **Recommends** an installed model. None fits → names the one to install and says whether this
   GPU runs it, as the VRAM↔RAM trade ("not at your VRAM, but yes with 44 GB of RAM").
5. **Installs only after a yes, in both modes** (disk is spend), showing the size, then verifies it
   landed with a real state read.
6. **Generates into the current project through the connector:** model ops (t2i, t2v, i2v,
   edit/reference with attached images, MPI-765) and **Flows** (MPI-658). **Non-blocking:** the
   agent says it started and keeps talking; the result posts back into the chat.
7. **Modes, a setting:**
   - **Auto** asks nothing about settings. Image: turbo. Video: medium `qualityTier` + turbo. It
     asks only when it cannot tell what the user wants at all.
   - **Ask first** asks about every model setting before generating.
   - Installs always ask, in both.
8. **Eyes: a sub-agent, and it is the Image descriptions job (MPI-737)** (Fabio, 2026-09-15). The
   orchestrator **never receives an image**. It calls `look(image, question, crop?)`, which runs
   `imageDescribe` on whichever backend the user picked in Settings → Image descriptions, and gets
   back text — plus a box when it asks for one.
   - **Why:** far cheaper (estimate below), images are never resent in the orchestrator's context
     so it compacts less, and **where the work runs stays the user's choice** — MPI-737's own spec
     (describe locally while generating on a pod; describe in the cloud while generating locally).
   - **Downscale before sending, never trust the model to.** Cloud backends: `sharp` (already a
     dep), ~1 MP, JPEG — Qwen-style encoders spend tokens per pixel, so a 16K upload is a token
     bomb. The ComfyUI graph already scales to 1 MP (`image_descriptor.json` node 41) and takes a
     path.
   - **Zoom:** `crop` sends one region at the same cap, so "look at the hands" gets detail.
   - **Refusal:** a cloud describer that refuses or sanitises an adult image → the agent says so and
     suggests switching Image descriptions to ComfyUI (the abliterated local describer). **The
     dropdown is the fallback**; nothing switches silently.
   - **Later senses are the same shape:** `watch` (video — TextGenerate's `video` input, 1 FPS) and
     `listen` (audio), each its own describer.
   - *Supersedes the same brainstorm's earlier "option B, the chat model sees images natively" and
     its "option C" fallback.*
9. **Boxes for gizmo Flows.** Head Swap takes square boxes as injection params (`box1` →
   `Input_Box`, `box2` → `Input_Box_2`; `js/data/flowsRegistry.js:501,511`). The agent gets the
   square from `look` on the downscaled image; coordinates map back to original pixels (the same
   maths as zoom). Flows needing a **painted** mask are a v1 limit.
10. **Looks at each image result when it lands** (a `look` call). It may flag problems unprompted; it
    **never regenerates on its own judgement**.
11. **Fix advice:** regenerate, or step-by-step History tools (mask, paint, composite, transform).
    The agent cannot drive History tools in slice A — there is no connector endpoint.
12. **The prompt is not shown in the chat.** It is on the card (Reuse / metadata) and shown on
    request.
13. **Honest limits, in character** ("I'm still a baby, this is my first version"): no video
    watching, no audio, no mask painting, no History tools, no RunPod, no memory across restarts.
    It never pretends: it sees only what its describer reported, and never claims to have watched a
    clip. A short list always in its context.
14. **Chat memory lasts while the app is open**, gone on restart, and it says so. Durable project
    state is slice 2.
15. **Auto-compact at 50% of the orchestrator's context window; 30% for windows ≥ 1M** (resending
    that much every turn is the cost). The model writes a handoff — goal, decisions, cards
    generated, current model and settings, open question — and the new session starts from it plus
    the last few turns. Shown as the mascot animation + "compacting".

## Provider and settings (Fabio: plain calls, option A)

- **Plain `fetch` to OpenAI-compatible `/chat/completions`, no LLM library.** `services/llmEngines.mjs:292`
  already calls DeepInfra's OpenAI-compatible base URL; it becomes editable.
- **Settings are jobs × backend, and the section is already built for it.** `MpiLlmSettings` has an
  Enhancement row and an Image descriptions row, and its header says the Agent is *"shaped to take
  it as a third row without being rearranged"* (`MpiLlmSettings.js:42-43`). **Agent = the third
  row.** MPI-728 owns that section; coordinate, do not rebuild it.
- **Custom endpoints:** named profiles `{name, base URL, key, model, context window}` become backend
  options; keys in `main/secretsStore.js`. Presets: **DeepInfra (recommended, with its link —
  cheapest, and it carries the tested models)**, OpenRouter, OpenAI, local Ollama (`/v1`, untested,
  VRAM caveat).
- **Probe on connect:** the Agent row sends one tiny call with a tool; a model that cannot use tools
  → said plainly. The image probe belongs to the Image descriptions row (MPI-737). **Never silently
  strip a capability and retry** — prior art Calliope does (memory
  `reference_calliope_competitor_agent`), and it is the fake answer the honest-limits rule exists to
  prevent.
- Slice A tests DeepInfra only. The ComfyUI backend cannot chat.
- Outside agents (Claude Code, Codex) reach Vision through the HTTP API and skill, later the CLI
  (MPI-593, deferred). Not this card.

## Architecture (Fabio: 2a option A)

- **The agent loop runs server-side (Node)**, beside the keys, the corpus and `sharp`. **Its tools
  are the connector contract** — the same surface CLI agents will use. The renderer chat streams
  replies.
- **Never mix in a renderer-side dispatch path** (MPI-677 plan § Step 5: mixing makes the
  deliberately dumb SSE relay load-bearing, `routes/connector.js:34-40`).
- **Tools:** list models (installed + ops + hardware fit) · read knowledge · install model (ask →
  verify) · generate (model op or Flow; named params; media; boxes; non-blocking) · `look` (image,
  question, optional crop; routed through MPI-737) · open project.
- **Gaps to confirm at plan time:**
  - Box steps on a connector Flow submit: `js/shell/agentDispatch.js:252` resolves declared fields
    and media only; no path for a step's `param` (`box1`/`box2`) was found.
  - A read of installed models + hardware for the list-models tool.
  - Non-blocking generate: `POST /connector/generate` resolves at the terminal state.
  - `imageDescribe` today runs only from the gallery/history right-click (`js/utils/describeAction.js`)
    through the renderer's `commandExecutor.js:1076`; a server-side `look` needs a path to it.

## Depends on MPI-737

MPI-737 ("Image descriptions become backend-choosable, and grow past captioning") already names
itself *"the read half of the step-5 agent"*. `look` needs its scope 1–2 (an image-passing path in
the engines, `imageDescribe` routed through the chosen backend) **plus three growths the agent
needs**:

- a **question** in place of the fixed caption instruction (`image_descriptor.json` node 38);
- an optional **crop**;
- a **box** answer, for Head Swap.

Until MPI-737 lands, `look` can only use the ComfyUI describer. Whether slice A waits for it or ships
ComfyUI-only first is a plan-time sequencing call.

## Models (DeepInfra, read from `/v1/openai/models` 2026-09-15)

- **Orchestrator: `deepseek-ai/DeepSeek-V4-Flash-0731`** (Fabio). Text-only is fine now — it never
  sees an image. 1,048,576 context (so it compacts at 30%), $0.06 in / $0.18 out / $0.015 cached per
  M. If it fails the tool-call criterion, the next candidate is picked at plan time. `Qwen/Qwen3.8-27B`
  is the capable comparison but costs $2.50 per M output, ~14× more.
- **Eyes: MPI-737's pick, not this card's.** DeepInfra vision candidates, per M in / out:
  `google/gemma-3-12b-it` 0.05 / 0.15 (already a registry id); `Qwen/Qwen3.5-9B` 0.10 / 0.15 (Qwen VL
  models are trained to return boxes); `google/gemma-3-4b-it` 0.05 / 0.10. Local: the abliterated
  Qwen3-VL 4B describer.
- **Cost estimate** (40 turns, ~30k context per turn at 90% cached, 500 output tokens per turn, 20
  looks): **~$0.15 per session** for Qwen 3.8 27B seeing images natively, **~$0.03** for a
  DeepSeek-V4-Flash-0731 orchestrator plus a cheap describer.

**Orchestrator criteria (this card):**
1. Correct tool calls; never invents a tool.
2. Honours thinking off (a 4B Qwen was rejected as an enhancer for ignoring `think: false`).
3. Writes recipe-shaped prompts (see Testing).
4. A known cost per typical session (`fetchDeepInfraPrices()`).

**Describer criteria (evaluated with MPI-737):**
1. Answers a targeted question about a real Vision output correctly.
2. Boxes a head well enough for Head Swap.
3. Does not refuse or sanitise adult images — a cloud model that does is reported, and local stays
   the answer.
4. A known cost per look.

## Testing the agent (MPI-677 gap 6)

- **Scripted conversations against fake tools:** no GPU, no generation, cents of DeepInfra per run.
  The fake `look` returns canned descriptions, boxes and refusals.
- **Graded by exact assertions on the tool calls, never an LLM judge** (MPI-677 brief: the judge
  blind spot). Cases:
  - picks an installed model that supports the op;
  - says "install needed" when none fits;
  - Auto + video → `qualityTier` medium + turbo with zero questions;
  - Ask first asks before generating;
  - installs always ask;
  - calls `look` before commenting on any image;
  - a `look` refusal → says so and suggests the local describer;
  - "watch this video" → the honest limit;
  - landing page, no project → asks for a project before generating.
- **Each case runs 3 times; pass = 3/3.** A single green is a luck pass.
- **Prompt quality:** Fabio reads a sample, plus the recipe mechanical checks (word budget, no
  placeholders).
- **Last:** Fabio's user-ux pass in the app.

## Out of slice A

Video and audio understanding · driving History tools · painted-mask Flows · RunPod · project as
durable state (named assets, approved beats — slice 2) · memory across restarts · the orchestrator
seeing images natively · per-setting defaults · Ollama as a tested backend.

## Inherited from MPI-677

`resources/cubric/connector-manifest.json` still advertises four broker capabilities nothing
serves; the portable build reads and hashes it (`assertConnectorManifest`). MPI-677's checklist
said "step 5 owns its fate" — this card owns it now.
