# MPI-1134 Plan: Story and Infinite Video (umbrella)

## Current State

- **Design is in `docs/story/`** (README → data-model, shot-pipeline, continuity, elements,
  cosmo-and-flow, roadmap, decisions). This plan is the ORDER and the per-phase done-bar; the
  design lives there, not here. Brainstormed with Fabio 2026-10-13. **Post-2.1.**
- **Project mode: scalable-foundation.** One Story recipe, three writers (Storyboard UI, Cosmo,
  MCP) — no writer gets a field the others cannot reach.
- **Umbrella.** Each phase below becomes its own member card when Phase 0 clears; this card stays
  the index. Nothing here is implemented by this card directly.
- **Investigation:** `research/codebase-2026-10-13.md`. The gaps it found, each owned by a phase:

| # | Gap (today) | Phase |
|---|---|---|
| G1 | `/connector/generate` cannot run a draft or a stage-2 refine (previewOnly / isStage2 / loadLatentName not whitelisted); agent runs keep no latent | 3 |
| G2 | Finish / Continue lands a NEW card; no route appends a pass to an EXISTING card's history | 3 |
| G3 | Extend Video's H3 arm is always the pixel path; D4 latent path is design only | 3 |
| G4 | No last-frame extraction (first frame exists: `_frameZero`) | 3 |
| G5 | `describe_model` has no real maxSeconds / fps / extend / latentContinue; `duration` is 1-30 for every video op | 1 |
| G6 | `serializeGroup()` whitelist drops new group fields → recipe must live on the ITEM sidecar | 1 |
| G7 | Two tool lists (Cosmo `TOOL_DEFS`, MCP `TOOLS`) + 5 test/manifest touchpoints per new tool | 1, 5 |
| G8 | Card import copies only the selected item and is not agent-reachable; Story refs would dangle | 5 (MPI-1136) |
| G9 | Nothing tracks "card used by card" (MPI-920 idea only) | 7 |
| G10 | Routines are the wrong shape for shots (routines.md:157); Flow `passes` planner is the closest fit | 4 |

### Decisions taken in planning (agent picks — say if wrong)

- **Story recipe = a `story` block on an item sidecar** (the GIF pattern), kind detected via
  `ASSET_KINDS`, opened on its own page. Not a group field (G6).
- **A shot references its take by GROUP id**; the take is that card's selected history entry.
  Story → Mix resolves the selected ITEM id at assembly time (Mix stores item ids, MPI-917).
- **Importing a Story card copies its take cards with it** and remaps the ids (G8), rather than
  leaving dangling refs. MPI-1136's scope grows to cover that.
- **Shot passes land as history entries on the shot's take card** (Fabio, brainstorm) — needs a
  "land on this card" path the connector can reach (G2).

## Completed

- [x] Brainstorm, design docs `docs/story/`, cards MPI-1134 / 1135 / 1136 (2026-10-13).
- [x] Codebase investigation → `research/codebase-2026-10-13.md`.

## Remaining Work

## Phase 0: Blockers — other cards, tracked not done here

- [ ] MPI-1135 Singularity H3 research decides: character-shot base model, its upscalers, the
  draft canvas. **Verify:** its validation.md names the base model and draft resolution, and
  `docs/story/shot-pipeline.md` § "Draft resolution" is updated to match.
- [ ] MPI-688 / MPI-477 (H3 video upscale / refiner), MPI-557 (video detailer) shipped.
  **Verify:** each card in `done`.
- [ ] MPI-815 Elements, MPI-917 Mix shipped; MPI-1091, MPI-586 (+ vehicles), MPI-1039 shipped
  or consciously deferred. **Verify:** each card in `done` or its deferral recorded here under
  Plan Drift.

## Parallel Batch: Phase 1 — Story foundation (no UI) — `auto`

Run with `mpi-execute-parallel` once Phase 0's MPI-815 is done. Ownership is provisional; the
member card confirms it against the tree at that time.

- [ ] **1A Story recipe + validator.** `validateStory(recipe)` → `{ok, errors}` with named
  errors (shape per `docs/story/data-model.md`; dialogue covered exactly once; shot refs are
  group ids; element ids only for cast). Ownership: `js/data/storyRecipe.js` (new),
  `tests/story-recipe.test.cjs` (new). Briefings: Critical Rules Snapshot.
  **Verify:** `node --test tests/story-recipe.test.cjs` passes — valid recipe, each invalid shape
  rejected by name, a dialogue line covered twice rejected.
- [ ] **1B Model limits in the catalogue (G5).** Per video op: `maxSeconds`, `fps`,
  `latentContinue`, `extendFlow` from the ModelDef / sizing tables, surfaced in
  `GET /connector/models`. Ownership: `js/data/generationControls.js`,
  `js/shell/agentDispatch.js` (`_listModels` only), `tests/model-limits.test.cjs` (new).
  Briefings: `comfy`, Critical Rules Snapshot.
  **Verify:** the new test asserts H3 ref2v_ms and one cloud video op report their real limits,
  and `node --test tests/mcp.test.cjs` still passes.

## Phase 2: Story card kind + routes — `auto`

Sequential after 1A (it consumes the validator).

- [ ] Story card: `story` sidecar block, `ASSET_KINDS` entry, `POST /story/entry`-style write
  route, `GET/POST /connector/story/*` read/write, renderer relay in `agentDispatch.js`.
  **Verify:** a route test writes a recipe, reads it back identical, rejects an invalid one with
  named errors; the card survives project reload.

## Phase 3: Shot runner + Continue step — `auto`, one `user-ux` check

- [ ] Land-on-card path (G2): a connector-reachable way to append a result to a given card's
  history. **Verify:** route test — a pass lands as entry N+1 on the named card, selectedIndex
  moves, no new card created.
- [ ] Draft + refine over the connector (G1): run a shot as a preview, keep its latent, refine it
  later onto the same card. **Verify:** on the bench, one H3 shot drafts, then refines, as two
  history entries on one card; the latent file exists between them.
- [ ] Last-frame extraction (G4) and the four join modes (`docs/story/continuity.md`).
  **Verify:** unit test on the last-frame helper; a `lastFrame` join starts the next shot from it.
- [ ] Extend latent path (G3, MPI-591 D4) — only if `extend` joins are needed after Phase 4 use.
  **Verify:** an H3 extend from our own output skips the pixel encode (graph diff + one run).
- [ ] `user-ux`: Fabio judges a 3-shot chained scene. **Verify:** his yes in validation.md.

## Phase 4: Infinite Video Flow — `user-ux`

- [ ] Flow via `/mpi-add-flow`: inputs scene + Elements + length; `enhance` step splits beats;
  `passes` planner runs shots through the Phase 3 runner; output = joined clip + a Story card.
  **Verify:** a 20 s run on H3 produces both, and the Story card opens with its shots.

## Phase 5: Cosmo director + MCP parity — `auto`

- [ ] Cosmo `TOOL_DEFS` + MCP `TOOLS` for story read/write/run (G7 touchpoints all updated).
  **Verify:** `node --test tests/agent-no-delete.test.cjs tests/agent-prompt-budget.test.cjs
  tests/mcp.test.cjs` pass; agent-harness case drafts a 3-scene story.
- [ ] MPI-1136 card import for agents, Story cards carry their takes (G8). **Verify:** importing a
  Story card into another project leaves zero dangling refs (validator passes there).

## Phase 6: Storyboard workspace — `user-ux`

- [ ] Fully editable page for the Story card (`/impeccable` + components rules). **Verify:**
  desktop spec edits a shot, reorders, swaps a take; Fabio's look-and-feel yes.

## Phase 7: Story → Mix — `auto` then `user-ux`

- [ ] Build a Mix recipe from approved shots (selected item ids), Ambience from location Elements,
  music via Stable Audio 3; reference-aware delete (MPI-920, G9). **Verify:** a Story assembles
  into a Mix card that renders; deleting a take used by a Story warns.

## Plan Drift

- None yet.

## Verification

**Verify mode:** user-ux (Phases 3-check, 4, 6, 7 have surfaces Fabio must judge; 1, 2, 5 auto).

The umbrella closes when a user can go from a chat idea to an exported Mix of an approved
multi-scene Story, and the Infinite Video Flow makes a Story card from one prompt.

## Preservation Notes

- When a phase ships, move its BUILT facts from `docs/story/` into a normal subsystem doc and
  leave a pointer (docs/story/README.md says so).
- `docs/story/data-model.md` must follow the "shot refs = group id" decision above.
- Ask Fabio before editing `.claude/rules/` for the new card kind / page (CLAUDE.md rule 5).
