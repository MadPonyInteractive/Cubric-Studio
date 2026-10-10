# MPI-1056 - Child-safety gate: plan

## Goal

No prompt that sexualises a minor, or puts a minor in nudity, underwear or out-of-scene
swimwear, is generated or written by the app. A word-and-age SCRIPT decides, at no token
cost; a language model is asked only on a borderline flag, and may only CLEAR it.

## Decisions (Fabio 2026-10-10, this session)

- No picture check, no recipe changes. A script on the TEXT; the judge is its own fixed
  instruction (the "recipe" for the check), run on the user's Language Models enhance pick.
- The user's own prompt box IS checked (reverses the brief's "out of scope"): a toast when it fails.
- Age rule (brief table): under 18 never nude / underwear / sexual or suggestive / an NSFW
  model; 16-17 swimwear only in a pool / beach / swim scene and never on a character sheet;
  under 16 fully dressed. A bare "teen" counts as 16-17.
- NSFW model = a model id containing `nsfw` (SDXL NSFW, Krea 2 NSFW). Chroma / Pony are not.
  Klein 9B's NSFW LoRA word list (`klein_9b_t2i.json` node 43) is a subset of the script's terms.
- Languages: English + Portuguese, Spanish, French, German, Italian in the script; a prompt
  in a non-Latin script goes to the judge. Other Latin-script languages: known gap.

## Design

Two tiers:

| script finds | verdict |
|---|---|
| a known abuse term (loli, shota, jailbait...) | refuse, never judged |
| minor + nudity / underwear / sexual-suggestive words | refuse, never judged |
| minor + NSFW model | refuse, never judged |
| minor + swimwear (under 16, or 16-17 with no scene / on a sheet) | JUDGE: the model may clear it (whose swimwear?) |
| a non-Latin-script prompt | JUDGE with the full rule |
| nothing | ok |

The judge answers exactly ALLOW or REFUSE; anything else, an error or no backend = refuse
(fail closed). The prompt goes in as quoted data, so the hard tier never depends on it.

## Where it sits

1. `js/data/childSafety.js` (NEW, pure): `checkChildSafety(texts, { modelId, flowId })`,
   `configTexts(config)` (positive + Flow text params, never a negative or system prompt),
   `JUDGE_SYSTEM`, `parseJudgeAnswer`, `childSafetyGate(texts, ctx, judge)`.
2. `js/services/generationService.js` `enqueueGeneration` - THE funnel (prompt box, Flows,
   routines, Cosmo and MCP via agentDispatch). Hard refuse: sync, like the missing-slot
   guard (toast unless `byAgent`, `onError({ code: 'CHILD_SAFETY', userMessage })`, null).
   Judge: return the queueJobId now, enqueue on ALLOW. Text ops (promptEnhance,
   imageDescribe) skip it: the enhancer checks itself, and the judge IS a promptEnhance job.
3. `js/services/llmService.js` - `judgeChildSafety(text, backend)`; `enhance()` and
   `enhanceFlow()` check the request in and the text out. The judge runs on the SAME backend
   the enhance ran on, so `settleInGraphEnhance` (inside a running job) never queues a ComfyUI
   judge behind itself.
4. `js/services/flowEnhance.js` - a CHILD_SAFETY refusal keeps its code and drops the
   "Check Remote > Language Models" hint.
5. Cosmo's system prompt (`services/agentLoop.mjs`, held by MPI-1053's open handoff): its
   "Never a minor" line contradicts the agreed rule. Sent as an mpi-message, not edited here.
6. Docs: `docs/child-safety.md` (NEW) + its line in `docs/README.md`; one rule line in `docs/llm.md`.

## Verification

**Verify mode:** auto

- `node --test tests/child-safety.test.cjs`: hard refusals, judge flags, false positives
  that must pass (adult "girl", "young woman", "baby blue", negative prompt, "not a child"),
  the five languages, the NSFW model rule, the Klein node-43 words, judge answer parsing.
- Existing suites touching the edited files stay green.
- Live, own isolated instance (no GPU): a hard-refused prompt in the prompt box toasts and
  queues nothing.
- Judge quality on real models: needs the GPU lease or a few cents of DeepInfra; ask first.

## Phase 2 - the picture check (Fabio 2026-10-10, card reopened)

Fabio: "remove clothes" on an imported photo needs a visual check first; the words cannot know
the age of someone in a picture from the internet.

- Trigger: the run sends a picture (any image mediaItem: edit, i2i, inpaint, i2v start, reference)
  AND its words ask for nudity, underwear or sexual content (SEXUAL / UNCLOTHED lists + undress
  verbs, six languages), or the words are in a script the lists cannot read.
- Every picture, imported or made in the app (a dressed child made for a film is one too).
- `llmService.describeImage` (the ONE describe switch, the user's describe pick) asks
  "Does this picture show anyone who is, or could be, under 18? YES or NO"; refused unless every
  answer is a bare NO; no describer = refused. Perception, not age: a young-looking adult is
  refused too (accepted by Fabio for this case).
- Where: `enqueueGeneration`, before the text judge; pure helpers in `childSafety.js`.
- Not in v1: a clip's frames (video inputs). Recorded gap.
- Verify: unit + live-module tests (stubbed describer); describer bench on clothed adult vs child
  sheets on the ComfyUI describer under the GPU lease.

## Current State

2026-10-10: the gate is in and verified (validation.md): script + judge, every generation via
`enqueueGeneration`, the Enhancer in and out. Judge benched (`research/judge-bench.mjs`): DeepInfra
gemma-4-26B 20/20 on the first prompt wording; ComfyUI 4B 18/20 alone, gate 20/20 after the script
took over "whose swimwear" (validation.md). Uncommitted. One item left, not ours to start: Cosmo's
content rule (MPI-1053 holds `agentLoop.mjs`; message `61a35d44` carries the text). Gotcha: the
judge on ComfyUI is a promptEnhance job, so text ops are exempt from the gate or it would wait on itself.

## Remaining Work

- [ ] Cosmo's content rule in `services/agentLoop.mjs` (after MPI-1053 releases it, or its session applies the message)
- [ ] optional: the same bench on the ComfyUI judge (qwen3vl 4B, GPU lease) and Ollama gemma-4-abliterated 12b

## Completed

- childSafety.js + 2 test files (21 tests), enqueueGeneration gate, Enhancer in/out + judge,
  flowEnhance refusal code, docs (child-safety.md, map, llm.md rule), message to MPI-1053.

## Plan Drift

- 2026-10-10: the connector routes (`/connector/generate`, open-prompt, open-flow, routines) are
  NOT gated themselves: `enqueueGeneration` is the one funnel every generation reaches, so one
  gate there covers MCP, Cosmo, routines and the prompt box. An agent-written prompt that is
  only OPENED (open-prompt / open-flow) is checked when the user presses Generate.
- 2026-10-10: no live prompt-box run on an isolated instance (shared engine: a failing gate
  would generate the refused prompt). The real module is driven in `child-safety-gate.test.cjs`.
