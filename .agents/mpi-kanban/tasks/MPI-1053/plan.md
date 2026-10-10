# MPI-1053 plan - Cosmo's detail and upscale routes

## Goal

Cosmo (and MCP) pick or offer the right detail/upscale route per brief.md § "The decisions",
with the agent's per-request text the same size or smaller than today.

## Current State

2026-10-09: card created from MPI-1038; nothing built here yet. First pass ALREADY ON MASTER
(MPI-1038, `019d0e507`), to be REWORKED by this card, not kept as-is:
- `services/agentLoop.mjs` Model rule: added "More detail or sharpness on the whole picture is
  the upscale task, never an edit." (+82 bytes; `SYSTEM_BUDGET` raised 10,740 -> 10,814). Too
  blunt for decision 1 (small picture -> offer i2i | tiles) - rewrite it.
- `js/data/modelConstants/modelPriority.js`: `TILES_NOTE` on every tile-capable model's
  `upscale` op ("at any size ... tiles: true and upscaleFactor 1") and `OP_NOTES.detail`
  ("only the area the user masked ..."). TILES_NOTE contradicts decision 1 for a small picture.
- `tiles` + `upscaleFactor` named params (MPI-1038, `01524eb07`) exist and work; keep them.

2026-10-09 (session 76b0afe0): card in doing, Phase 1 DONE - inventory + bytes + size-signal
table in validation.md. Phase 2 DONE (uncommitted, claimed by 76b0afe0) - routes in the
imageUpscale tool note, op notes shrunk, App state carries WxH, SYSTEM 10,805 / TOOLS 18,966,
npm test green. Phase 3 live rounds 1-2 FAILED (validation.md): routes moved to a gated app doc,
app:upscaling (docs/agent/upscaling.md + KNOWLEDGE_NOT_READ gate on upscale/imageUpscale). Round 3 PASSED 2026-10-10 (tiles=true, factor 2,
after reading app:upscaling unprompted). DONE - close-out.

## Where the agent's routing text lives today (read these first)

- System prompt rules: `services/agentLoop.mjs` ~line 1990-2000 - Model rule, Route rule
  (whole-picture vs one area -> mask), Masking rule. Budget: `tests/agent-prompt-budget.test.cjs`
  (SYSTEM 10,814 / TOOLS 19,006 bytes, each raise annotated there).
- Op notes shown by `list_models` at choice time (NOT budgeted, a tool result):
  `js/data/modelConstants/modelPriority.js` `OP_NOTES` (upscale, detail, i2i), `TILES_NOTE`,
  per-model `NOTES` (`krea2:upscale` etc.); the `imageUpscale` tool ranks first for `upscale`.
  `-nsfw` models get only `NSFW_NOTE` (their upscale op loses the tiles note).
- Tool schema arg text: `services/agentLoop.mjs` generate `denoise` / `tiles` / `upscaleFactor`;
  `routes/mcp.js` the same three for MCP.
- Agent tools: `js/shell/agentToolOps.js` `imageUpscale` ALWAYS uses an upscale model
  (`Upscale_Using_Model: true`); the workspace's model-less basic upscale is not an agent tool.
  Whether to expose it is a question for Fabio (decision 4 names both).
- Gated app docs: `docs/agent/masking.md` (mask flow, "keeps source size"),
  `docs/agent/prompt-enhancement.md` (detail/upscale row), per-model guides
  `docs/agent/models/*.md` (upscale lines in krea-2, flux-2 ...). Corpus: `services/agentCorpus.mjs`.
- Grid vs Tiles behaviour: `docs/models/krea2/upscaling.md`. Tile count: `js/utils/tileCount.js`.
- Picture size is known to the agent how? Check the App state line / `list_cards`
  (`pixelDimensions`) - decisions 1 and 3 hinge on it.

## Phases

1. **Inventory + size signal.** List every agent-facing line about detail/upscale/i2i (rules,
   OP_NOTES, tool args, app docs). Confirm the agent can see a card's pixel size before it
   picks. Verify: a table in validation.md, current bytes.
2. **Rewrite, not append.** One compact routing text for the decisions (likely the Model or
   Route rule, rewritten shorter), the per-route facts in the op notes (unbudgeted) and/or one
   gated app doc (e.g. `app:upscaling`) read when the task is detail/upscale. Remove the
   019d0e507 additions they replace. Verify: budget test with SYSTEM/TOOLS at or below today;
   `tests/agent-tiles.test.cjs` updated; `npm test`.
3. **Live check with Fabio (user-ux).** Four asks on his app: 1 MP "add detail" -> two buttons;
   "detail on her face" -> mask; 4K "detail this" -> Tiles 1x straight away; "upscale this to
   8K" -> names the kinds, prefers normal/Tiles. Verify: his "1".

## Verification

**Verify mode:** user-ux

## Completed

- Phase 1 (2026-10-09): inventory + size signal, validation.md.
- Phase 2 (2026-10-09): rewrite; details in validation.md.
- Phase 3 (2026-10-10): live check passed on round 3.

## Remaining Work

None.

## Plan Drift

- 2026-10-09, Phase 1 findings that set Phase 2's shape:
  - Op notes are NOT free: `list_models` repeats an op's note on every model (12 upscale ops),
    so 019d0e507's TILES_NOTE + detail note cost ~5 KB per list_models. The routing text goes
    ONCE: the `imageUpscale` tool note (`js/shell/agentToolOps.js`), which list_models shows
    once (rank 1 / best for upscale) and MCP gets through the same connector route.
  - Model rule clause (82 B) becomes a pointer of the same size or less that also covers
    detail on ONE thing ("never an edit; imageUpscale's note routes it"). TILES_NOTE and
    `OP_NOTES.detail` deleted; `OP_NOTES.upscale` shortened, keeps the word imageUpscale
    (`tests/model-priority.test.cjs:58`).
  - Size gap: the App state line names the open entry's path but not its size - add `WxH`
    there in code (`_imageSize`), per-turn context only.
  - Grid stays panel-only and basic no-model upscale stays a workspace tool: the note NAMES
    them for the user, the agent runs normal / tiles / imageUpscale. (Your-call line for Fabio.)
  - `js/shell/agentToolOps.js` added to files.json.
- 2026-10-09, live rounds 1-2: the tool note was the wrong home. Round 1 (my wording) ran tiles OFF;
  round 2 (fixed wording) still ran the plain tool, because it is `best: true` for upscale and the
  Model rule says take best. Routes now live in `app:upscaling` behind a generate gate, the
  app:masking pattern. Edit-tool trap: it trims a trailing space in new_string - check joins.
