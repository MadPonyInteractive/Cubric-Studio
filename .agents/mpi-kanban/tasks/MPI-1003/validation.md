# MPI-1003 Validation

Phase 1 of MPI-1000, 2026-09-30. Docs and skills only; no app code touched.

## 1. The audit: what the in-app agent reads, from the code

Method: traced each tool's answer from the tool definition back to the registry field that feeds
it (`services/agentLoop.mjs` TOOL_DEFS and `_executeTool` -> `routes/connector.js` `/connector/models`
-> `js/shell/agentDispatch.js` `_listModels` -> the registries), then RAN the answer for one model
and two Flows to see it as the agent does. Line numbers drift under peers (services/agentLoop.mjs
moved ~15 lines during this job), so symbols are named.

### Flows

| # | What the agent reads | Comes from | What a Flow author must do |
|---|---|---|---|
| F1 | `list_models` Flow entry: `id`, `title`, **`does`**, `installed`, `opensForUser` | `_listModels` (`agentDispatch.js`), `flowDoes(description)` = first sentence of the `FlowDef` `description`, cut at the first dash or colon; `compactCatalogue` (`agentLoop.mjs`) | Write that first sentence as the ask ("Describe a song and hear it sung"), not the brand. A package Flow gets it from its manifest `description` |
| F2 | `installed`; `install_model` on a Flow id answers `IS_A_FLOW` | `flowAvailability`; `install_model` case in `_executeTool` | Nothing to declare. A package/paid Flow is named in `flows.md` § Picking one, and the not-installed wording there says "add it from the Flow Library" |
| F3 | `describe_model <flow>`: `fields` = `{id,label,type,default,options{v,label},min,max}` for flow AND step fields, not `button`; `media` roles; `boxParams`; `frame`; `opens` | `agentFieldSpecs` (`js/utils/declaredFields.js`, a whitelist); `mediaRolesFor` (`routes/connector.js`) | Dropped on purpose (tests/connector-flow-dispatch.test.cjs asserts the prose/widget keys never leak): `info`, `note`, `placeholder`, `rows`, `tags`, `hiddenWhen`, `hidden`, a step's `hint`. The `label` is the only meaning a field carries |
| F4 | A `hidden: true` field (Song's `Input_Mood`, `Input_Vocal`, `Input_Arrangement`) arrives as an ordinary empty `text` field; `Input_Voices` as `type:'voices'` with `default:[{type:'Any'}]` and options, not what a row means. Object Stamp's prompt is labelled "Anything to add?" | RAN `agentFieldSpecs(getFlowById('minimax-music'))` and `('object-stamp')` | Explain in `docs/agent/flows.md` every hidden field, structured type and note-carried meaning, or move the meaning into the `label` |
| F5 | Media slots are the op's `mediaInputs` KEYS: `role,type,required,tag`, plus `use` for `startFrame`/`endFrame` only. No slot label (Outpaint's slot is `image1`, and the agent once guessed `inputImage`) | `mediaRolesFor`, `ROLE_USE` (`routes/connector.js`) | Name a new key for what it holds |
| F6 | Run, open or ask first. `agentOpens` -> `opens` -> `opensForUser`; loop routes via `_flowOpens` / `_openFlow`; `open: true` works on any Flow; ask-first is prose only | `FlowDef.agentOpens`; `agentDispatch.js` `_listModels`; `docs/agent/flows.md` § Flows the user finishes | Decide per Flow. Ask-first has no declarative hook: it is a `flows.md` paragraph |
| F7 | No gate forces any Flow briefing. The guide gate is `if (!args.flowId && args.modelId)`; "Flow rule" (prompt) says read `app:flows`; only box Flows have a gate (`BOX_NOT_MEASURED`). `flows.md` is the only per-Flow prose, read on a prompt rule alone | `_executeTool` generate case; system prompt | Everything the agent needs is in F1, F3, or `flows.md`. `flows.md`: info only, no dates/names/stories/`$` price, <= 200 lines (82 today), no new `docs/agent/*.md` (each is an index line in the prompt) |
| F8 | Budgets: system prompt 10,460 B and tool schemas 18,460 B. MEASURED at the end of this job by building the prompt: 10,419 B (41 B of slack) and 18,460 B (0 B) | `tests/agent-prompt-budget.test.cjs` | Never add a per-Flow rule to the prompt or a tool description; raising a budget is a decision in its own diff |
| F9 | Places that NAME the opening Flows in words and go stale silently: `flows.md` § Flows the user finishes; the Docs site agent page (`pages/agent.html`, "Open a Flow for you to finish", sibling repo, never pushed); `tests/agent-flow-handover.test.cjs` (`want` map for opening Flows, `runs` list, both hand-picked) | grep | Name the Flow in all three when it opens; pin run-vs-open in the test. Outside agents read `.claude/skills/cubric-vision-flows/SKILL.md` (a recipe per Flow that needs a calling convention): add one only for that kind |

### Models

| # | What the agent reads | Comes from | What a model author must do |
|---|---|---|---|
| M1 | `list_models` model entry: `id`, `name`, `type` (= `mediaType`), `installed`, ops. **`description` is not sent.** Tier siblings share one `name` (Boogu Image Edit x2, LTX 2.3 x2), `sizeTier` is not sent | `_listModels`; RAN `MODELS` names | `name` is what a user types; say what the model is FOR and which tier in the rank note and the guide |
| M2 | `rank`, `task`, `best`, `note`, `paid` per op. A cloud model (`provider` + `cloud.endpointId`; tasks t2i, edit, t2v, i2v) ranks itself after every local one, price in the note; an id ending `-nsfw` gets the adult-request note | `modelConstants/modelPriority.js` (the brief's `js/data/modelPriority.js` is not the path); `best` from `compactCatalogue` | Rank + note (exists in 03); do not hand-rank a cloud or `-nsfw` model |
| M3 | per-op `ratios`, `qualityTiers`, `tierSizes`, `turbo`, `styles`, `duration`, `denoise` | `namedParamsFor` (`js/data/generationControls.js`) | Nothing extra beyond a correct ModelDef; read it back. `formats.md` § Styles names racks by model in prose: add a rack only if it changes what is offered |
| M4 | Model op media roles: `role,type,required,tag` | `mediaRolesFor` from the op's `mediaInputs` keys, gated by `capabilities` | Same as F5 |
| M5 | Guide ids, and the `GUIDE_NOT_READ` gate on `guides[0]` | `guideIdsByModel` (`services/agentCorpus.mjs`): `resolveRecipe(enhanceRecipe ?? type)` -> `docs/agent/models/<recipe id>.md`. No recipe = no guide = no gate. `tests/agent-corpus.test.cjs` passes once the recipe's guide exists, so a REUSED recipe is a shared guide that may never name the new model | Make sure a recipe resolves; edit the shared guide to name the model (as `wan-2.2.md` does for two cards) or add a recipe first (`/create-enhancer-recipe`). Guide rules enforced: 30-200 lines, `# ` heading, no TODO/TBD, no em dash, no `$` price, no dates/names |
| M6 | Code that knows an op by NAME: `MASKED_OPS` (`agentLoop.mjs`, gates `app:masking`), `ONE_AREA_OPS` (`agentDispatch.js`, `MASK_SEVERAL_AREAS`), op tables in `docs/agent/masking.md`, the `_rank` task lists; the Model rule names four edit ops | grep | A new masked / one-area op is added to those; a new task gets a `_rank` list. `app:operations` is rendered from the registries (nothing) |
| M7 | Batch: the agent batches a `t2i` op or any cloud op that `modelShowsBatch` allows | `agentCanBatch` | `capabilities.batch: false` (or `batchOps`) when images 2+ artefact |
| M8 | Cost: `paid` note from the price snapshot; `/connector/quote`; spend card | `modelPriority.js` `_cloudNote`; `docs/cloud-generation.md` § Money | `provider` + `cloud.endpointId`, then `node scripts/sync-deepinfra-prices.mjs --check` |
| M9 | Licence: NOT sent. A gated model (`licences.js`) shows the dialog when the install starts, which covers the download | `downloadService.start()` via `agent.install-model` | Nothing for the gate. A licence fact that changes the PICK goes in the rank note or guide |
| M10 | The benchmark's model list | `services/agentBench/connector-models.json`: a CAPTURED snapshot of the catalogue; ranks, media roles and guide ids are recomputed live over it; no test requires a model to be in it | Not a per-model step. Only when a new rank changes what an existing case should take |

### Shared

| # | What the agent reads | Comes from | What to do |
|---|---|---|---|
| S1 | Product scope, as text in several places: the opening line (now "image, video and sound tool"), the Docs rule ("Image and video advice is yours to give"), the `generate` description ("image or video generation"), Honest limits ("I hear no audio"), the chat result tile (`MpiAgentChat`: anything but `video`/`audio` is drawn as an `<img>`), the MCP header and `generate` description in `routes/mcp.js` ("images and video"), `MEDIA_KINDS` in the recipe registry | grep `image or video`, `image and video`, `images and video` | A new media KIND edits every site; bytes are budgeted (F8) |
| S2 | What makes an agent doc or guide legal: `tests/agent-prompt-budget.test.cjs` (200 lines, no `$`, no dates/names/stories outside 8 legacy guides), `tests/agent-corpus.test.cjs` (guide 30-200 lines, no em dash) | tests | State in the playbooks |
| S3 | Seeing what the agent sees, and proving the ask | RAN a read-back for `wan22-5b` (rank, note, params, `guide:wan-2.2`) and Flows (`does`, `agentFieldSpecs`); RAN the agent tests | Read-back snippet, the agent tests, the user's live ask in words |

### Candidates the audit dropped or reshaped

- **"The bench list" as a per-model step: dropped.** The fixture is a one-time capture (its Flow entries still carry
  bare-string `fields`, from before MPI-816), ranks/roles/guides are recomputed live, no test ties it to `MODELS`.
  Kept as a conditional verify line (M10).
- **"Cost and licence notes the agent must say": reshaped.** Cost is automatic for a cloud model; the licence never
  reaches the agent (the download gate covers it). Left: note a licence fact only when it changes the pick.
- **"A line in flows.md for every Flow": reshaped.** Only where fields or the ask-first shape need words; a Flow whose
  labels explain it gets nothing.
- **Added by the audit:** `does` (F1), hidden/structured fields as bare names (F4), the reused-recipe-is-a-shared-guide
  trap (M5), op-keyed code (M6), the byte budgets (F8), places that name opening Flows (F9), tier siblings sharing a
  name (M1), batch (M7).

## 2. Audit item -> README checklist line

Flow lines are in `docs/playbooks/add-flow/README.md` § Checklist; model lines in `docs/playbooks/add-model/README.md`.

| Audit item | README checklist line (opening words) |
|---|---|
| F1 | add-flow: "**Agent catalogue line:** the FIRST sentence of the `FlowDef` `description`..." |
| F2 | add-flow: "**Agent doc:** `docs/agent/flows.md` says when to reach for it..." (07 § 4 carries the package/`IS_A_FLOW` note) |
| F3, F4, F5 | add-flow: "**Agent field meaning:** every `hidden: true` field, `voices` roster..." |
| F6 | add-flow: "**Agent role:** does Cosmo RUN it..." |
| F7, F8 | add-flow: "**Agent doc:** ... NOTHING in the system prompt or a new `docs/agent/*.md` (byte budgets)" |
| F9 | add-flow: "**Agent role:** ... Pin the id in `tests/agent-flow-handover.test.cjs` ... and name an opening Flow in `flows.md`" |
| S1 | add-flow and add-model: "**New media KIND?**" |
| S2 | add-flow: "**Agent doc:**"; add-model: "**Agent guide:**" |
| S3 | add-flow: "**Agent verify:**"; add-model: "**Agent verify:**" |
| M1, M4 | add-model: "**Agent name + note:** `name` is what a user would type..." |
| M2 | add-model: the existing "Rank its ops in `modelConstants/modelPriority.js`" and "**Agent name + note:**" |
| M3, M10 | add-model: "**Agent verify:** read back what Cosmo reads..." (bench only when a rank changes a case) |
| M5 | add-model: "**Agent guide:** `enhanceRecipe ?? type` resolves to a recipe..." |
| M6 | add-model: "**New OP or TASK?**" |
| M7, M8, M9 | add-model: "**Agent must-say:** batch..., cloud price..., a licence fact only when..." |

Both skills carry these lines in their Definition of Done:
`.claude/skills/mpi-add-flow/SKILL.md` § STEP 3 ("The in-app agent is part of Definition of Done", six bullets) and
`.claude/skills/mpi-add-model/SKILL.md` § Definition of Done (one checkbox naming the six README lines); both also
gained a fourth Step 0 question and a trap-table row.

## 3. Checks run

- Read-back snippets in 07 (both) RUN and print what the audit table says: Flow (`minimax-music`: `does` "Describe a song and hear
  it sung", `Input_Mood`/`Input_Vocal`/`Input_Arrangement` as plain `text`, `Input_Voices` `type:'voices'`), model (`wan22-5b`:
  ranks 3 and 4, note on i2v, `["guide:wan-2.2"]`).
- `node --test tests/agent-corpus.test.cjs tests/model-priority.test.cjs tests/agent-prompt-budget.test.cjs
  tests/agent-flow-handover.test.cjs`: 31 pass, 0 fail (run before the edits; docs and skills do not feed them).
- Not run: the live ask and the bench (real model calls, the user's key and GPU: their yes).

## Last two lines (2026-09-30, after MPI-950 closed and released its claim)

- Scope strings name audio: `services/agentLoop.mjs` generate now "Start a generation (model op or
  Flow)" and the Docs rule "Image, video and audio advice"; `routes/mcp.js` header "images, video and
  audio" and generate "an image, video or audio". System prompt 10,426 of 10,460 bytes; tool schemas
  shrank to 18,396, so `TOOLS_BUDGET` lowered to the measured size as the test asks.
- `docs/agent-chat.md` § Model ranking points at both 07 playbook steps. The 07 scope table quotes the
  new wording. Messages 863b228e and aeef17aa resolved.
- `node --test tests/agent-prompt-budget.test.cjs tests/agent-loop.test.cjs tests/mcp-server.test.cjs`:
  165 pass, 0 fail. `npm test`: 2572 pass, 0 fail.
