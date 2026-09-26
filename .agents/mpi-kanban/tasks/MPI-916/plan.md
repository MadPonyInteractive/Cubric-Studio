# MPI-916 Plan: agent tool contracts so cheaper models pass

Source: MPI-912 `validation.md` section 5 (DeepInfra survey, 2026-09-25) and handoff `f7c901b9`.

## Goal

Four cases in `scripts/agent-test.mjs` fail on nearly every model but the pick. Fix them on
OUR side, as general rules a doc would state, so models within 2x of the pick's off-promo
price pass more of the suite. The pick (`deepseek-ai/DeepSeek-V4-Flash-0731`) must end at
22/22 x3 (it was 21/22 on 2026-09-25, failing `rerun-on-named-model`).

## Diagnosis (from the MPI-912 survey logs)

| case | cause | fix |
|---|---|---|
| ranked-editor | ranks exist (kleinEdit 3, krea2Edit 5) but 1-2 are not installed; cheap models do not compute "lowest INSTALLED rank" | `list_models` marks `best: true` on the top installed, runnable, unpaid op per task; `opPriority` carries the `task` |
| sheet-goes-to-reference | `minimax-h3` i2v_ms is rank 1, `ref2v_ms` has no rank and no note, so i2v reads as the default | op notes: ref2v is the identity route for a sheet or several views of one subject; i2v animates THIS picture from its first frame |
| over-boxed-head | cheap models ask the mask/whole-picture question before any tool call: the Route rule tells them to | Route rule covers edit ops; a job a Flow does whole (Head Swap) goes to that Flow, no route question. Box gate already in the loop |
| rerun-on-named-model | even the pick sends i2i; ILL Anime's i2i note calls itself "the restyle route" | the i2i technique note states what i2i is NOT (the same picture on another model is that model's t2i, no media) |

## Phases

### Phase 1: Baseline
Four cases x3 on the pick, Qwen/Qwen3.6-35B-A3B, openai/gpt-oss-120b. Logs to `research/`.

### Phase 2: Best installed op per task
Ownership: `js/data/modelConstants/modelPriority.js`, `services/agentLoop.mjs` (`compactCatalogue`, Model rule), `tests/model-priority.test.cjs`, `tests/agent-loop.test.cjs`.

### Phase 3: Reference-to-video and i2i notes
Ownership: `js/data/modelConstants/modelPriority.js`, `tests/model-priority.test.cjs`.

### Phase 4: Route rule yields to a Flow built for the job
Ownership: `services/agentLoop.mjs` (system prompt).

### Phase 5: Verify
Pick full suite x3; the five targets full suite x1; record in `validation.md`. Docs: `docs/agent-chat.md`, `docs/playbooks/add-model/03-model-registry.md` if the `task` field changes the step.

## Verification

**Verify mode:** auto

- `node --test tests/model-priority.test.cjs tests/agent-loop.test.cjs tests/connector-agent-tools.test.cjs tests/agent-prompt-budget.test.cjs`
- `node scripts/agent-test.mjs --model deepseek-ai/DeepSeek-V4-Flash-0731 --runs 3` -> 22/22
- Targets re-screened `--runs 1`, compared with the survey table.

## Current State

2026-09-25: MPI-916 DONE and verified (pick 23/23 x3 on final code, Qwen3.6 23/23 x1, unit 500
pass / 0 fail); validation.md sections 1-3 carry every number. Ready for mpi-end-session. MPI-912
still waits on Fabio's close call (recommended: close both together).

2026-09-26 (session 5c27e3c8): Fabio: close MPI-916 and MPI-912 together (one mpi-end-session,
after the dropdown lands on MPI-912); run Qwen3.6 x3 (research/final3-*.log); price = measured
cost per chat. NEXT 1 built on MPI-912 (its validation.md § 6).

NEXT (Fabio, 2026-09-25, after the results):
1. **Agent model dropdown shows scores and prices** instead of a "recommended" flag: the three
   tested models at the top (DeepSeek-V4-Flash-0731, Qwen3.6-35B-A3B, gpt-oss-120b), each with
   its suite score and price, and the user chooses ("some users might want gpt-oss-120b and eat
   the fails"). Belongs with MPI-912 (the per-job recommended flags); not started.
   Open question for Fabio: Qwen3.6 x3 (~$0.45) before it is listed with a score.
   Code map (read-only survey at handoff):
   - One picker: `MpiLlmSettings` organism, `_renderAgentModel` (`MpiLlmSettings.js:767-791`),
     a plain `MpiDropdown` (options `{value,label,meta,info,icon}`); list from
     `_remoteModelOptions('agent', ...)` (`:541-556`), filled by `GET /llm/connection/models`
     (`routes/llm.js:111-150`) -> `listRemoteModels` (`services/llmEngines.mjs:523-554`).
   - Flag: `RECOMMENDED_REMOTE_MODELS` (`llmEngines.mjs:481-509`) -> `recommendedFor`/
     `recommendedNote` per model -> label `(recommended) <id>` (`MpiLlmSettings.js:550`).
     Sorted twice: server (recommended first, then alpha, `llmEngines.mjs:552`), client per job.
   - No price reaches the UI; `parseDeepInfraPrices` reads the SAME `/models` response
     `listRemoteModels` already fetches, so price attaches there with no second request.
   - `_remoteModelOptions` also serves enhance and describe: branch on `job === 'agent'`.
   - Pins: `tests/desktop/llm-settings-remote.spec.js:63-71`, `tests/llm-connection.test.cjs`
     (deepEqual on the route shape, a new field breaks it), `tests/llm-describe.test.cjs:501-527`,
     `tests/agent-loop.test.cjs:986-990`. Docs: `docs/llm.md:34-99,153-158`,
     `docs/agent-chat.md:281-286` (already omits `recommendedNote`).
2. **Live bug, video card handed to the agent as a still.** Chat "gecko climb": the agent got
   `att_bf4567dd.webp` (the video card's still), `look` described a picture, and it ran
   `minimax-h3:i2v_ms` with it as a first frame. Card MPI-867 (todo, planned) already covers the
   composer taking clips by reference; its `tests/agent-video-attachment.test.cjs:123` is the
   pending `todo`.
3. **RESOLVED 2026-09-26, not an app bug:** Fabio: another agent session stopped two of his
   generations then. Log reference kept. **Was: the clip was killed by a GLOBAL interrupt.** Log `%APPDATA%\Cubric Studio\logs\
   app-20260925-114624.log` lines 1328-1355: agent job submitted 14:02:56, a second prompt queued
   14:03:12, then `Global interrupt (no prompt_id specified)` at 14:03:23 -> CANCELLED.
   `js/services/comfyController.js:777` `interrupt()` POSTs `/interrupt` with no prompt_id, so a
   Stop stops WHATEVER is running. Hypothesis, unproven: a Stop meant for the second job killed
   the agent's. No card yet; ask Fabio whether he pressed Stop.
4. Doc drift: the live log is `%APPDATA%\Cubric Studio\logs\app.log`; CLAUDE.md's router still
   says `Cubric Vision` (that folder stopped on 2026-09-17). Rule file: ask before editing.

## Plan Drift

- 2026-09-25: phases 2-4 landed as one change and one measurement, not one run per fix.
- 2026-09-25: a fifth fix, same Route rule: "ask ONE question: does the change stay inside ONE
  area?" was read by small models as a question FOR THE USER (gpt-oss-20b, gemma asked "does
  the night change stay inside one area?"). Now "answer this yourself". Measured as `fix2`.
- 2026-09-25: not fixed: gpt-oss-120b sometimes reads the guide after a GUIDE_NOT_READ refusal
  and never re-sends generate. Only that model does it (2 turns in the survey).
- 2026-09-25: Fabio asked about Qwen3-VL-30B (the "less censorship" one): 7/22 and 3.1x the
  pick's suite cost, so outside the targets. Proposed an adult-content case so refusals get
  measured on every candidate; awaiting his answer.

## Completed

- Phase 1 baseline.
- Phase 2 `best` + `task` (modelPriority `task`/`paid`, compactCatalogue).
- Phase 3 notes: ref2v ranked with its note, i2v and i2i say what they are not.
- Phase 4 Head Swap in the Model rule, Route rule scoped to edits and answered by the agent.
- Beyond plan (same system): `guide:krea-2` stopped steering a named Krea 2 edit to i2i; box
  gate refuses a box Flow with no boxes; GUIDE_NOT_READ names the retry and the unlocking read
  carries `next`; harness `adult-request` case; harness head check counts runs, not refusals.
- Content rule + `-nsfw` notes (Fabio); `install_model` "the card IS the question"; an install
  No says the model is not installed and nothing needing it can run.

## Plan Drift (cont.)

- 2026-09-25: the fixes grew from four to nine as each measurement moved the failure somewhere
  new; every one is a general contract fix (a doc, a gate, a note), none a per-case hint.
