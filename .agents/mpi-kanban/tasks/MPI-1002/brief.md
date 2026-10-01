# MPI-1002 Brief

Every Flow enhancement uses the enhancer picked in Remote, on the agent's runs too.

Umbrella: MPI-1000.

## Fabio's rule (2026-09-30, "I asked before, and it did not come across")

Any prompt enhancement a Flow does, as its own pass or inside its own graph, runs on the
enhancer selected in Remote > Language Models. ComfyUI selected: the workflow's own enhancer.
Anything else (Ollama, DeepInfra, another endpoint): that one, never the ComfyUI graph's.

## What is already true (read 2026-09-30, verify before building)

- The Flow's separate enhance pass follows the pick since 2026-09-13:
  `MpiBaseFlow._runEnhance` -> `llmService.enhanceFlow`, which branches on
  `runnableBackend(backendPreference())` (ComfyUI -> `runComfyEnhance`, else the server backend
  with the declaration's system prompt unwrapped). Covers Song's automatic pass (the only Flow with
  `flow.enhance`) and Character Sheet's Enhance button. Prove it live on each backend.

## The gaps

1. **The agent's Flow runs skip enhancement entirely.** `agentDispatch` builds and submits a Flow
   with no enhance step. Evidence, Fabio's Song run by Cosmo on 2026-09-30 (My Agent Tests,
   sidecar `d212bf17...json`): `Input_Mood` and `Input_Arrangement` written by Cosmo itself,
   `Input_Vocal` EMPTY, `Input_Voices` "Voice 1 (Duet)" for a prince-and-princess duet, lyrics
   tagged `[Prince]`/`[Princess]` instead of the Flow's singer markers. Decide with Fabio: the agent
   run calls the same `enhanceFlow` (the selected enhancer), or Cosmo writes the three blocks
   itself from the enhancer's recipe (`MINIMAX_MUSIC_ENHANCE_PARAMS` in `js/data/flowsRegistry.js`:
   texture only, never a running order, a section list or a timing). Either way it must know how
   Song casts voices and marks singers.
2. **Enhancers inside a graph.** `klein_9b_t2i.json` and `krea2_t2i_*.json` carry a `TextGenerate`
   node behind `Input_enhance_prompt`, which always runs on ComfyUI whatever Remote says. Find
   every graph with one (model ops and any Flow that runs those graphs) and route it by the pick:
   ComfyUI -> leave the node on; else run the selected enhancer first and switch the node off.
3. **"Review lyrics" then Cue** (an agent-opened Song): the frame's automatic pass probably re-runs
   and overwrites what Cosmo filled. Once gap 1 is settled, skip the pass when the blocks are
   current for the same brief (`_enhanceWrote` bookkeeping in MpiBaseFlow).

## Where

`js/services/llmService.js` (`enhanceFlow`, `backendPreference`), `js/components/Blocks/MpiBaseFlow/MpiBaseFlow.js`
(`_runEnhance`, `_autoEnhance`), `js/shell/agentDispatch.js` (the agent's Flow submit),
`js/services/commandExecutor.js` (`Input_enhance_prompt`), `comfy_workflows/*` with a
`TextGenerate` node, `docs/agent/flows.md` if Cosmo writes the blocks.

## Verify

Each backend (ComfyUI, Ollama, DeepInfra) x each site (Song by hand, Song by Cosmo, Character
Sheet Enhance, a model op with the in-graph enhancer): the log names the backend that ran, and
with a non-ComfyUI pick no ComfyUI `TextGenerate` executes.

## Decision (Fabio, 2026-09-30)

Gap 1: option A. The agent's Flow run calls the same `enhanceFlow` as a hand run, so it uses the enhancer picked in Remote. Fabio: "that is the whole point": a Flow on DeepInfra enhances fast without stopping the generation for a ComfyUI pass, and with a non-ComfyUI enhancer picked in Remote, ComfyUI must never do the enhancing (gap 2 is the same rule inside the graphs).

## Folded in from MPI-1003's audit (2026-09-30)

- `agentFieldSpecs` (`js/utils/declaredFields.js`) emits no `hidden` flag and no agent-facing description,
  so Song's hidden caption blocks (`Input_Mood`, `Input_Vocal`, `Input_Arrangement`) reach Cosmo as plain
  empty text fields and `Input_Voices` as a bare `type: 'voices'`. With option A the enhancer fills the
  blocks, so the agent must be told NOT to fill them itself (a `hidden` flag is the cheap signal;
  `tests/connector-flow-dispatch.test.cjs` pins the dropped keys and needs updating with it).

## Noticed

- `_deleteSavedItems` (generationService) reads `state.currentProject`, so a dropped output in a CLOSED project is never deleted (from the MPI-997 brief, 2026-09-30).
- Agent `generate` with a `flowId` silently drops top-level `prompt` / `duration` (`_generateFields`, `services/agentLoop.mjs`): a weak model (ornith:9b) ran Song on an EMPTY brief. A tool refuses such a named param; a Flow should too (2026-10-01 live matrix).
- `VIEW_BUSY` reads "Nothing was opened: Nothing was opened: ..." (prefix doubled between `agentDispatch.openFlow` and its caller).
- A krea2 run sent with `Input_enhance_prompt: true` keeps `true` in its sidecar though the graph ran `false` (Reuse does not replay it, so the record is only wrong, not harmful).
- Fabio's Ollama lists `deepseek-v4-flash:0731-cloud`, which now answers `410 Gone`; Cosmo on it fails with only "Ollama chat failed: 410 Gone".
