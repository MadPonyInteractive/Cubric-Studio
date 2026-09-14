# MPI-754 research — flow `type` descriptor field (read-only investigation, 2026-09-14)

## 1. Key-name verdict: `type` is safe
- No descriptor carries a `type` key today (all 15 printed via `node -e import(...)`); no `flow.type` / `flow['type']` / `{type} = flow` anywhere in `js/`, `services/`, `routes/`.
- Neighbouring `type` meanings live on other objects: media items (`generationService.js:167,179`, `agentDispatch.js:173,278`), field controls (`declaredFields.js:113-932`), media groups (`MpiBaseFlow.js:852`), deps (`downloadManager.js:313`).
- A flow is never merged into a model/dep: run config builds a fresh `model: { id: null, mediaType }` (`flowService.js:144`); `flowDepUniverse` copies only `id`/`flowId`/`deps` (`flowsRegistry.js:2852-2861`).
- Agents never receive the descriptor: connector takes only `flowId` (`routes/connector.js:198-210`); `_submitFlow` reads `title`/`operation`/`fields` (`agentDispatch.js:218-270`); agent corpus skips flow ops (`agentCorpus.mjs:94`).
- No key validator; no test regex matches a top-level `type:`.
- Only cost is ambiguity: inside a flow, `type` already means field control (`flowsRegistry.js:183`) and media group (`:559`); on models it means family (`'sdxl'`, `models.js:7`; `.claude/rules/state.md:96` warns).

## 2. Where lines go
- Typedef `FlowDef` block `flowsRegistry.js:22-122`; `mediaType` entry `:104-109`, before `inputSchema` `:110`. Same format: `@property {'create'|'edit'|'enhance'} type - …`, continuation indented to column 40.
- Per-flow `mediaType:` lines (insert beside them by TEXT, line numbers drift): head-swap 458, ltx-extend 556, ltx-foley 653, ltx-upscale 724, scribble-object 897, scribble 1093, character-sheet 1259, outpaint 1443, voice-changer 1529, chatter-box 1655, drama-box 1812, stems 1942, object-stamp 2049, minimax-music 2274, sound-and-music 2712.
- `docs/flows.md` is a 17-line redirect; the real field list is the code block `docs/playbooks/add-flow/01-descriptor-and-ops.md:74-90`.

## 3. Test
- `package.json:23`: `node --test "tests/**/*.test.cjs"` → a new file is picked up.
- ESM-from-CJS pattern (`tests/flow-derived-fields.test.cjs:26-31`): `const esm = p => import('file://' + repo(p).replace(/\\/g, '/'));` then `mod.FLOWS || mod.flows || mod.default`.
- Closest all-flows loop: `tests/flow-frame.test.cjs:195-215`. Recommendation: new `tests/flow-type.test.cjs`, loops FLOWS, asserts `type ∈ {create, edit, enhance}`.

## 4. Playbook + skill
- `01-descriptor-and-ops.md` after `:86-87` (`mediaType, // 'image' | 'video' | 'audio' — the OUTPUT type (always required).` / `// Also picks the Flow Library section the flow lands under (MPI-634).`): add `type, // 'create' | 'edit' | 'enhance' — creates new / edits existing / enhances existing (always required).`
- `docs/playbooks/add-flow/README.md:137` checklist lists descriptor fields (`… inputSchema.media slot groups; mediaType`) → append `; type` (the skill follows the README checklist verbatim, `SKILL.md:55`).
- `.claude/skills/mpi-add-flow/SKILL.md` has no own checklist. Stale (out of scope): `:24` outputs `image | video` only; `:62` says no AUDIO, contradicted by `README.md:106`.

## 5. MPI-591 overlap + claims
- MPI-591's planned `flowsRegistry.js` edit (`plan.md:1168`) shipped (`flowsRegistry.js:551`; `8bf96308`, `1144f138`, 2026-09-01).
- Remaining: graph/bench verify, 8-step gate, docs (`checklist.md:104,132,139,256`); may change ltx-extend `fields` ~`:562-625` (turbo steps option `checklist.md:290`; context default 56 `plan.md:1858-1890`). A `type:` at `:556` is adjacent only.
- Claim record `0928f1f4` lists `flowsRegistry.js`, status `needs_verification`, heartbeat 2026-09-01, NOT in `index.json` `active_file_claims`; none of the 16 active claims cover the file. Last commit MPI-744 (`1a63a66a`, 2026-09-14); clean.

## 6. Gating
`listFlows` returns every flow (`flowsRegistry.js:2785-2787`); no dev-only flag on descriptors; library ungated since MPI-589 (`shell.js:480-483`) though comments `flowsRegistry.js:4,18` and `SKILL.md:8,82` still say dev-gated. `hidden: true` exists only on fields (`:2642-2644`).

## 7. ID check
15 flows, 15 mapped ids; none unmapped, unknown or duplicated.

## 8. Resolved
- Key stays `type`. Playbook: both `01` and `README.md:137`. Test checks validity only, not the mapping.
