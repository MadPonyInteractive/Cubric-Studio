# 07 — Make it known to the in-app agent (Cosmo)

> Part of the [add-model playbook](README.md). Do this for EVERY model, before the live run in
> [06](06-verify.md). The Flow half is [../add-flow/07-agent-knowledge.md](../add-flow/07-agent-knowledge.md);
> a NEW MEDIA KIND (its § 5) and the prompt and doc byte budgets (its § 4) are canonical there. The audit
> behind both (what the agent reads, traced to the code) is MPI-1003.

A model the agent was not told about installs, runs from the Prompt Box, and is never used by Cosmo:
unranked it is never the pick, and with no guide it is picked and prompted blind. **Nothing fails**;
it reads as "Cosmo ignores the model I just installed". The in-app agent (`services/agentLoop.mjs`,
contract [../../agent-chat.md](../../agent-chat.md)) knows a model through `list_models` (the short
catalogue), `describe_model <id>` (the whole entry) and `read_knowledge` (its guide).

## 1. What it reads, and your step

| It sees | Comes from | Your step |
|---|---|---|
| `id`, `name`, `type` (= `mediaType`), `installed`, each op | `_listModels` (`js/shell/agentDispatch.js`) from the `ModelDef` | `name` is how a user says it ("with Krea 2"). **`description` is never sent**, and tier siblings share one `name` (Boogu Image Edit twice, LTX 2.3 twice; `sizeTier` is not sent either). What the model is FOR, and which tier this is, go in the rank note and the guide |
| `rank`, `task`, `best`, `note`, `paid` per op | `modelConstants/modelPriority.js`; `best` = the lowest-ranked free op installed here, per task (`compactCatalogue`) | [03](03-model-registry.md) § Rank it for the in-app agent. Unranked = never `best`, never picked unless named. A **cloud** model (`provider` + `cloud.endpointId`) ranks itself after every local one with its price in the note, for `t2i`, `edit`, `t2v` and `i2v` only (`CLOUD_TASKS`), and an id ending **`-nsfw`** gets the adult-request note: rank neither by hand |
| per op: `ratios`, `qualityTiers`, `tierSizes`, `turbo`, `styles`, `duration`, `denoise` | `namedParamsFor` (`js/data/generationControls.js`) from `type`, `capabilities`, `styleLoraLabels` and the op's component list | Nothing extra: a correct `ModelDef` and op is a correct answer. Read it back (§ 5). `docs/agent/formats.md` § Styles names racks by model in prose: add yours there only if it changes what the agent should offer for a look ("anime") |
| media `role`, `type`, `required`, `tag` | `mediaRolesFor` (`routes/connector.js`) from the op's `mediaInputs` keys, gated by `capabilities` | The slot KEY is all it gets (no label): name a new key for what it holds. A key that reads wrong needs a `ROLE_USE` line in that file (`startFrame` and `endFrame` have one) |
| guide ids, and `GUIDE_NOT_READ` | `guideIdsByModel` (`services/agentCorpus.mjs`) | § 2 |
| batch | `agentCanBatch`: `modelShowsBatch`, and (a cloud model or a `t2i` op) | A t2i model whose images 2+ artefact needs `capabilities.batch: false` (or `batchOps`, [04](04-ops-and-controls.md)); otherwise the agent batches it |
| size, fit, `missingDownloadGb` | computed from dep `size` | Nothing ([02](02-dependencies-r2.md)); never restate them in a note |

## 2. The prompting guide: the one briefing a gate forces

`generate` on a model op answers `GUIDE_NOT_READ` until this chat has read `guides[0]`. A model has a
guide only through its **enhancer recipe**: `guideIdsByModel` resolves `enhanceRecipe ?? type` to a
recipe and takes `docs/agent/models/<recipe id>.md`. No recipe, no guide ids, no gate: the agent
writes for the model blind.

- **Reusing a recipe is sharing a guide** (`enhanceRecipe: 'wan'`). `tests/agent-corpus.test.cjs`
  passes once the recipe HAS a guide, so it cannot tell that the guide is silent about YOU. Edit the
  shared guide so it names this model: which ops and ratios differ, and a `Pick it when` for it
  (`wan-2.2.md` covers `wan-22` and `wan22-5b` together).
- **A genuinely new prompting grammar is a new recipe first** (`/create-enhancer-recipe`: the recipe
  file, a line in `RECIPE_REGISTRY`, an alias when `type` is not the recipe id), then its guide.
- **The guide** is `docs/agent/models/<recipe id>.md`: 30 to 200 lines (more = a router there plus
  topics in `<id>/<topic>.md`, only the router is gated), opens with `# `, no TODO/TBD, **no em dash,
  no `$` price, no dates or names** (the tests enforce all of it). Copy the closest guide's sections:
  Pick it when, Settings, The prompt shape, Adapting what the user asked for, When a result disappoints.

## 3. A new OP or a new TASK

Code outside the registries knows an op by NAME, and a new op matches none of it by itself:

| If the op | Add it to |
|---|---|
| runs on a painted mask (`edit` family, `inpaint`, `detail`, `i2i`) | `MASKED_OPS` (`services/agentLoop.mjs`), or `app:masking` is never required before it; and the op tables in `docs/agent/masking.md` |
| crops ONE box around the mask | `ONE_AREA_OPS` (`js/shell/agentDispatch.js`), or a mask of two areas is not refused |
| is a task no list ranks | a `_rank(list, '<task>')` in `modelPriority.js` ([03](03-model-registry.md)); a rank compares ops within one task only |

The system prompt's Model rule names four edit ops; leave it alone, the `task` field routes.
`app:operations` is rendered from the registries, so it needs nothing.

## 4. What it must say before it spends

- **Cost.** A cloud model's price comes from the price snapshot and is never typed: declare
  `provider: 'deepinfra'` and `cloud.endpointId`, then run `node scripts/sync-deepinfra-prices.mjs --check`.
  The agent quotes it through `/connector/quote` and asks before a billed run
  ([../../cloud-generation.md](../../cloud-generation.md) § Money). A local model costs nothing to say.
- **Licence.** The agent is told none. A gated model (`js/data/modelConstants/licences.js`, keyed by
  model id) shows the licence dialog on the user's screen when the install starts, which covers the
  download. A licence fact that changes the PICK (a territory limit, non-commercial output) goes in
  the rank note or the guide's Pick it when, and only then.

## 5. Verify

1. **Read back what Cosmo reads.** The answer, not the registry. From the repo root:
   ```bash
   node --input-type=module -e "import {MODELS} from './js/data/modelConstants/models.js';import {opPriority} from './js/data/modelConstants/modelPriority.js';import {guideIdsByModel} from './services/agentCorpus.mjs';import {namedParamsFor} from './js/data/generationControls.js';const m=MODELS.find(x=>x.id==='<id>');console.log(m.name,m.mediaType,JSON.stringify(guideIdsByModel()[m.id]));for(const op of m.supportedOps)console.log(op,JSON.stringify(opPriority(m.id,op)),JSON.stringify(namedParamsFor(m,op)))"
   ```
   An op printing `null` is unranked, an empty `[]` is no guide. Read the note as a stranger would.
2. **Run the agent tests:** `node --test tests/agent-corpus.test.cjs tests/model-priority.test.cjs tests/agent-prompt-budget.test.cjs`.
3. **The live ask, in words.** The user's to run (it spends their LLM key, and a run spends the GPU),
   in an isolated app (`npm run app:isolated`), never their live one on `:3000`. Ask twice: once for
   the OUTCOME the rank says it is best at, once naming the model ("with <name>"). Pass = the step
   lines show its settings and `Reading: guide:<recipe id>` before the generate, and the op that runs
   is the one you ranked, not a neighbour.
4. **The bench, only when a rank or note you wrote changes which op an existing case should take**
   (`ranked-editor`, `rerun-on-named-model`). `services/agentBench/connector-models.json` is a captured
   snapshot of the catalogue (ranks, media roles and guide ids are recomputed live over it), no test
   requires every model to be in it, and a model joins it only by adding its entry. Then
   `npm run agent:test -- --case <id>`: real model calls on the user's DeepInfra key, so it is their yes.
