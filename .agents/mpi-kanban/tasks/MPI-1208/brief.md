# MPI-1208 — Cosmo sees the pictures, and plans from what each tool can change

Fabio, 2026-10-19: "Cosmo needs to be intelligent enough to figure things out by himself. We can't
keep giving him straight, direct instructions. ... Cosmo's job is to know what tools he has at his
disposal and be intelligent enough to choose what needs to happen." And: "I think Cosmo gets very
confused sometimes because he's not seeing the images, only getting a description of the images."

Current release 2.1.1; this targets 2.1.2 or later (Fabio's call on the cut).

## The live case that started it

Project `C:\Users\Fabio\Documents\Cubric Studio\Projects\test_ce77a5fb` (sidecars in
`Media/.meta/`), log `%APPDATA%\Cubric Studio\logs\app-20261019-213018.log` from line 1981 (22:27-22:31
local). A 1:1 picture (edit_002) and the ask "9:16, solo, smiling, hands on hips, mini skirt and
fishnets". Five runs, all Klein 9B, each on ONE picture:

| Card | Op | Input |
|---|---|---|
| i2i_001 | klein-9b i2i 9:16, denoise 0.5 | edit_002 |
| i2i_002 | klein-9b i2i 9:16, denoise 0.6 | edit_002 |
| edit_004 | klein-9b kleinEdit | i2i_002 |
| i2i_003 | klein-9b i2i 9:16, denoise 0.55 | edit_002 |
| edit_005 | klein-9b kleinEdit | i2i_003 |

- The 9:16 sent a pose/outfit change to i2i: no editor takes a ratio, and OP_RULES `shape`
  (`services/agentLoop.mjs` ~429), which fires on i2i, reads "a generation from a picture crops it to
  the ratio", as if i2i were how you change shape. The pose never moved at 0.5-0.6.
- The edit task's rank 1 (Qwen-Image 2.1, MPI-1202) was passed over for "the native editor" (kleinEdit's note).
- Fabio asked for a TWO-picture edit ("pick up the original image ... replace the current girl with
  the woman in the original"). Cosmo restarted from the original alone. No run ever got two pictures.
- Cosmo said "built from the original's identity ... matches what you asked for" while face,
  proportions and clothes had drifted: a describer gives "purple-haired woman" for both, so a
  text-only model cannot judge identity.

Fabio's correct routes (for a bench case ONLY, never prompt text): crop to 9:16, then ONE edit that
pulls her back, changes the pose and adds skirt + fishnets; or outpaint the bottom to 9:16 with the
skirt and fishnets in the outpaint prompt (`positive`, "What goes in the new area?"), then edit the
pose and expression. Out of scope: Flux 3's coming box edit that reshapes in one pass.

## Half 1 — a chat model that sees the pictures

Today the agent model is `deepseek-ai/DeepSeek-V4-Flash-0731` (text-only, 33/34 on the agent suite,
$0.0035/chat; `RECOMMENDED_REMOTE_MODELS`). `look` goes to a separate describer and returns TEXT
(`docs/agent-chat.md` row 8). Pulled from MPI-1134 Phase 5b "Vision chat model", which also names
the MPI-1164 look leak (grain copied onto a light ask, 6/6 on DeepSeek; restore the "only that quality"
assertion removed in e5f4f9a00).

1. Wiring: when the agent profile's model has `vision` (`/llm/connection/models` already reports it),
   `look` hands the picture itself to the chat model as an image part of the tool result (fallback:
   the describer text, unchanged for text-only models). Mind the cost: an image every turn breaks
   nothing but the prompt cache's prefix stability (see `~/.claude/memory/tools/deepinfra.md` — the
   cache is a prefix cache), so images ride in tool results, never in the system prompt.
2. Candidates: DeepInfra models tagged vision + tools (list them from the keyless catalogue first;
   MPI-1134 lists Ling-3.0-flash-VL, Nemotron-3.5-Super-VL, MiMo-V2.6-Flash for video). Qwen3-VL-30B
   scored 7/22 on the suite in 2026-09 and lost its agent flag: the suite decides, not the label.
3. Bench: run `scripts/agent-test.mjs` per candidate. **It bills DeepInfra: state the price per run
   and the number of runs, and get Fabio's yes first.** Add cases a describer cannot pass: "is this
   the same woman as picture 1?", the grain-only case.

## Half 2 — tool facts at pick time (no recipes)

State each op's CAPABILITY where the agent picks it, as a fact, never a route:
- an edit op keeps its first picture's shape, changes content/pose/clothes, takes further pictures as sources;
- i2i repaints from words and keeps pose and layout at the denoise that keeps the person;
- crop (`js/shell/agentToolOps.js`) changes the shape only;
- Outpaint (`js/data/flowsRegistry.js`) changes the shape and fills the new area from its prompt.
Home: OP_NOTES for the edit task's ops in `js/data/modelConstants/modelPriority.js`, the crop note,
Outpaint's `does`; reword OP_RULES `shape` so it cannot read as "i2i changes shape". Plus ONE planning
line in the system prompt: before the first run of a multi-part ask, list what must change (shape,
content, pose, identity, style) and give each to the tool that changes it, in an order where no step
undoes an earlier one. Qwen-Image 2.1's edit note should say why it is rank 1 before the licence line.
Do NOT reorder EDIT (Fabio, MPI-1202).

**Peer:** MPI-1181 (FLUX.3 Klein) holds a live claim on `modelPriority.js` and is adding `flux3-klein`.
Coordinate before editing it.

## Done

- Half 2 in, `tests/model-priority`, `agent-prompt-budget` (raise only by the words' cost),
  `agent-loop`, `agent-tiles`, `agent-bench` green; a bench case for the 9:16 job (crop or outpaint
  before an edit, no i2i).
- Half 1: vision wiring behind the model's `vision` flag with tests; bench evidence per candidate in
  `research/`; a recommendation to Fabio with score and cost per chat. The default model changes only on his yes.
- A finding in `docs/agent-findings.md` (200-line cap).
- Code commits with the card in `doing`; done only on a green CI run (done-gate).
