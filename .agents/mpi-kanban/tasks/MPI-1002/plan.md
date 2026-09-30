# MPI-1002 Plan - Flow enhancement follows the Remote pick, on agent runs too

Umbrella: MPI-1000 (phase 2). Brief: `brief.md` (Fabio's rule, Decision = option A, the
agentFieldSpecs fold-in). Drafted 2026-09-30 from a read of the code (session 43678b37); nothing
was run live. Line numbers drift (a peer is editing `agentDispatch.js`): grep the symbols.

## Findings

- **Hand run (already right).** `MpiBaseFlow._run` -> `_autoEnhance` (auto declarations only) ->
  `_runEnhance` -> `llmService.enhanceFlow`, which branches on `runnableBackend(backendPreference())`
  (localStorage `cubric.llm.backend`, default comfy): comfy -> `runComfyEnhance` (queued
  `promptEnhance` job, local and Pod both, the split is below the queue); ollama / endpoint ->
  `/llm/enhance` with the declaration's system prompt unwrapped. `/llm/enhance` logs no success line,
  so nothing names the backend that ran today.
- Only Song declares `flow.enhance` (auto). Character Sheet's Enhance is a BUTTON: a hand run never
  enhances at Generate, so the agent running none there is already parity.
- **Gap 1.** The agent path `_submitFlow` -> `buildFlow` (`js/shell/agentDispatch.js`) ->
  `submitFlowGeneration` has no enhance step. `buildFlow` also builds routine Flow steps
  (`routineDispatch.js`), so one fix covers agent + routines. The connector / MCP only relay
  flowId + fields to the renderer job. `agentFieldSpecs` lists Song's `hidden: true` blocks as plain
  text fields (why Cosmo filled them); `Input_Voices` shows as a bare `voices` type. The graph strips
  `<Name>` markers and sings every `[bracket]` run, so `[Prince]` is sung; who sings where goes in
  `Input_Voice_Notes` by roster position. Latent bug: `serialiseVoices` returns `''` for a string.
- **Gap 2 is already closed in every in-app path; it needs a GUARD, not a fix.** `TextGenerate`
  behind `Input_enhance_prompt` exists only in `klein_t2i`, `klein_9b_t2i`, `krea2_t2i_sfw`,
  `krea2_t2i_nsfw` (model ops, no Flow). The flag bakes `false` (pinned by
  `tests/output-prompt-capture.test.cjs`), the toggle was deleted in MPI-677, `MpiIfElse` is lazy, and
  Reuse does not re-inject it. The one door left: raw `injectionParams` on `POST /connector/generate`.
  `docs/models/krea2/injection.md` still says "the app toggle drives it" (stale). Server-backend
  recipes for these models already exist (`enhance()` resolves `krea-2`, `flux-2`).
- **Gap 3.** An agent-opened Song seeds its fields without `enhanceWrote`, so at Cue the frame
  treats Cosmo's text as the user's: with some blocks filled (Fabio's run: Mood + Arrangement, Vocal
  empty) the pass fills only the empty one, a mixed caption. A run snapshot from `buildFlow` also
  carries no `enhanceWrote`, so a Reuse would treat enhancer text as hand-typed (the MPI-664 bug).

## Design

1. **`js/services/flowEnhance.js` (new), the shared primitive** for MpiBaseFlow (component) and
   agentDispatch (shell). Moves the pure helpers out of MpiBaseFlow verbatim (`autoEnhanceDecl`,
   `enhanceTargets`, `enhanceSources`, `enhanceSourceText`, `splitEnhanced`), plus
   `runEnhanceDecl` (the only Flow-path caller of `enhanceFlow`; logs
   `[flow-enhance] <flow> on <backend> (<model>), N ms`) and `enhanceFlowRun(flow, resolved)` for
   agent + routines: runs each auto declaration, writes only blank targets, returns
   `{ ok, injectionParams, inputs: { enhanceWrote } }` or `{ ok:false, code:'ENHANCE_FAILED' }`.
2. **MpiBaseFlow keeps UI state only** (`_enhanceWrote`, `_mayEnhanceWrite`, painting); hand-run
   behaviour byte-identical (golden test).
3. **`buildFlow` wiring**: ~8 lines calling `enhanceFlowRun` after `resolveFlowFieldValues`, merging
   the patch; `enhanceWrote` rides `flowInputs` for Reuse.
4. **Agent field contract in `declaredFields.js`**: `agentFieldSpecs` omits `hidden: true` fields
   (nothing left to misread, saves bytes); `resolveFlowFieldValues` ignores caller values for hidden
   ids (warn, no error); `voices` accepts a serialised string.
5. **Cosmo guidance in `docs/agent/flows.md`** (not the system prompt, budget at cap): lyrics use only
   the section tags, never a name in brackets; one `Input_Voices` row per singer; who sings where in
   `Input_Voice_Notes`; the Flow writes mood, vocal and arrangement itself on the picked enhancer.
6. **Gap 2 guard** `settleInGraphEnhance` in llmService, called once in `commandExecutor.execute`
   before `_buildParams` (covers local and Pod): flag true + comfy pick -> leave on; flag true +
   server pick -> `enhance()` with the model's recipe, write the prompt, flag off, log the backend;
   exempt op -> flag off. Never `runComfyEnhance` there (it would queue behind the running job).
7. **Gap 3**: `adoptHiddenTargets` at the seed marks non-empty hidden targets as machine-written, so
   Review lyrics then Cue runs exactly one pass and a Reuse re-enhances when the brief changes.

## Steps

- [ ] 1. Shared module + frame reuse. Files: `js/services/flowEnhance.js` (new),
  `js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js`, `tests/enhance-control.test.cjs`,
  `tests/flow-enhance-ownership.test.cjs`, `tests/flow-enhance.test.cjs` (new).
  **Verify:** those tests; a golden Song enhancer prompt captured BEFORE the refactor is
  byte-identical after; `tests/desktop/flow-enhance-writes-textarea.spec.js` green.
- [ ] 2. Agent field contract. Files: `js/utils/declaredFields.js`,
  `tests/connector-flow-dispatch.test.cjs`. **Verify:** Song specs omit the three blocks, keep
  Voices + Voice Notes; hidden caller values ignored with no `unknown`; a voices string round-trips.
- [ ] 3. In-graph guard. Files: `js/services/llmService.js`, `js/services/commandExecutor.js`,
  `tests/llm-service.test.cjs`, `tests/in-graph-enhance.test.cjs` (new), docs
  `docs/models/krea2/injection.md`, `docs/playbooks/add-model/05-prompt-and-styles.md`,
  `docs/playbooks/add-flow/ui/prompt-enhance.md`. **Verify:** flag x pick {comfy, endpoint,
  ollama} x op {t2i, kleinEdit} matrix; no flag = zero I/O; a scan proves no `js/` file sets the flag.
- [ ] 4. Gap 3 seed adoption (after 1, same files). **Verify:** `adoptHiddenTargets` unit cases;
  ownership tests green.
- [ ] 5. Cosmo docs. Files: `docs/agent/flows.md`, one row in
  `docs/playbooks/add-flow/07-agent-knowledge.md`, a line in `existing-flows/song.md`.
  **Verify:** `tests/agent-prompt-budget.test.cjs` still passes.
- [ ] 6. **WAITS on the MPI-950 claim on `js/shell/agentDispatch.js`:** `buildFlow` wiring +
  `tests/flow-enhance-agent.test.cjs` (new). **Verify:** a pin that `buildFlow` calls
  `enhanceFlowRun` after `resolveFlowFieldValues`; `agent-flow-handover`, `routine-runner`,
  `connector-flow-dispatch` tests green.
  Same file, same wait: the typo refusals in `buildFlow` / `openFlow` list `flowDeclaredFields(flow)`,
  so a wrong id on Song names the hidden blocks; list `agentFieldSpecs(flow).map(f => f.id)` instead.
- [ ] 7. Live matrix (after 6).

## Parallel Batch - steps 1-5

- [ ] **A: steps 1 then 4** - Ownership: `js/services/flowEnhance.js`, `MpiBaseFlow.js`,
  `tests/enhance-control.test.cjs`, `tests/flow-enhance-ownership.test.cjs`, `tests/flow-enhance.test.cjs`
- [ ] **B: step 2** - Ownership: `js/utils/declaredFields.js`, `tests/connector-flow-dispatch.test.cjs`
- [ ] **C: step 3** - Ownership: `js/services/llmService.js`, `js/services/commandExecutor.js`,
  `tests/llm-service.test.cjs`, `tests/in-graph-enhance.test.cjs`, the three docs in step 3
- [ ] **D: step 5** - Ownership: `docs/agent/flows.md`, `docs/playbooks/add-flow/07-agent-knowledge.md`,
  `docs/playbooks/add-flow/existing-flows/song.md`

Each task's **Verify:** is its step's line above.

## Verification

**Verify mode:** user-ux

- Unit, no GPU: backend routing with a stubbed fetch (a server pick makes exactly one `/llm/enhance`
  call and no `/comfy` or `promptEnhance`); `enhanceFlowRun` cases; the guard matrix; voices and
  adoption cases.
- Live (announce each local ComfyUI run to Fabio first): Song by Cosmo on ComfyUI, Ollama and
  DeepInfra picks (the log names the backend, the sidecar has the three blocks + `enhanceWrote`, a
  two-row cast; with a non-ComfyUI pick no `promptEnhance` job); Song by hand on DeepInfra and
  Ollama; Character Sheet Enhance on DeepInfra; the raw connector door on krea2 t2i; Review lyrics then
  Cue on DeepInfra runs one pass. About 4 DeepInfra enhancer calls, cents.

## Risks

- MpiBaseFlow.js is 3.8k lines and hot: small hunks, hand behaviour pinned by the golden test.
- Agent path waits for a ComfyUI-pick enhancer job before the Flow job; a cancel in that leg gets
  `NOT_IN_FLIGHT`.
- Server backends lack the graph's sampler settings (temperature 0.5, repetition 1.15): Song on
  DeepInfra / Ollama may loop; the live Song runs watch for it.
- Routines start enhancing per run (they go through `buildFlow`): intended.

## Open questions (Fabio)

1. The picked enhancer fails on an agent run (no key, Ollama down): stop, or run un-enhanced?
   Pick: stop with the enhancer's message and a Remote > Language Models hint; generate nothing.
2. Cosmo's Character Sheet run: enhance automatically? Pick: no, parity with a hand run (Enhance is
   a button there; Cosmo writes the description itself).

## Current State

2026-09-30: planned. Not started. Steps 1-5 are a parallel batch with no peer-held file; step 6
waits on MPI-950's claim on `agentDispatch.js`.
