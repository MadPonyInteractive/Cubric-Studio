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
NEXT: Phase 1.

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

## Remaining Work

Phases 1-3.

## Plan Drift
