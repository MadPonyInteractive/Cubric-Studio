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
| G11 | `list_cards` / `readCard` (`services/agentCards.mjs:106-131`, `:238-268`) never return a card's cached `look` or its notes, though both are on disk; `list_cards` cuts the prompt to 200 chars and caps at 30 rows | 5b |
| G12 | `POST /combine-videos` (`routes/videoConcat.js:102-121`, `:185-187`) records no source clips or in/out times — which clips went in is lost | 5b |
| G13 | Cosmo sees a clip as ONE 6-frame sheet through a one-image, 1 MP describer, and its chat model is text-only: imported long footage is effectively unwatchable | 5b |

### How it ships — master, behind `dev_mode`, no branch (Fabio, 2026-10-13)

- Every phase merges to **master**. No feature branch, no worktree: the shared checkout, the hot
  files (`agentLoop.mjs`, `agentDispatch.js`, `connector.js`, `routes/mcp.js`) and the
  one-release-per-change-from-master rule all argue against weeks of drift.
- **Standalone pieces ship UNGATED as ordinary releases:** model limits in the catalogue, last
  frame, land-on-card route, MPI-1136 card import, Elements additions.
- **Pieces that only make sense together stay behind `APP_CONFIG.dev_mode`** (the gate the Flow
  Library used until MPI-589): the Story card kind, the Storyboard page, the Infinite Video Flow,
  Cosmo's story tools. Bug-fix releases go out from master at any time.
- **Opening the gate is the release** that ships the umbrella (a 2nd-digit bump).
- **Gated data must not break an ungated build:** a project holding a Story card opens cleanly
  with the gate closed (Phase 2 verify).

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

**Member since 2026-10-18 (Fabio, board tidy):** MPI-815 Elements sits under this umbrella
(its description carries the `UMBRELLA: MPI-1134` line). The other Phase 0 cards keep their
own umbrellas and are tracked here only.

**Members since 2026-10-19 (Fabio, umbrella pass):** MPI-1191 (Keyframes to Video Flow -
starts after the Phase 3 keyframe-anchor bench below proves mid-shot and multi-anchor runs) and
MPI-1088 (Hairstyle picker from a Hairstyles element - blocked on MPI-815 Elements and its
"Flow slots consuming elements" follow-up). Both carry the `UMBRELLA: MPI-1134` line.

**Member since 2026-10-21 (Fabio):** MPI-1231 Storyboard Flow - ask for a storyboard, get a
stack of editable panels (not one sheet); the first step of long-form video, feeding MPI-1191 as
its keys or Story shots as anchors. Its name collides with Phase 6's Storyboard workspace: settle
at its brainstorm whether the panels ARE that page's shots. MPI-1191 widened the same day to
LTX 2.3 (`LTXVAddGuide`) as well as H3, so the Phase 3 keyframe bench gets an LTX arm.

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
  named errors; the card survives project reload; with `dev_mode` off, a project holding a
  Story card opens, the card shows as an inert card (no crash, no Storyboard entry), and the
  Story tools are absent from Cosmo and MCP.

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
- [ ] **Keyframe anchors on H3 (`MiniMaxH3AddGuide`, core, already shipped).** Chain one node per
  picture/clip/sound pinned at a pixel `frame_idx` (negative = from the end): storyboard frames as a
  shot's beats, a planned end frame at `-1`, a bridge between two takes, a Mix line pinned at its
  time. Mid-shot and multi-anchor runs are UNPROVEN: bench first, per
  `research/h3-addguide-keyframes.md`. **Verify:** the three bench arms there, SSIM per anchor; then
  a `keyframes` join mode added to `docs/story/continuity.md` only if they pass. A standalone
  Keyframes to Video Flow (drawings / 3D key poses) is member card MPI-1191 (joined 2026-10-19); it starts after this bench.
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

## Phase 5b: Video understanding for long work — `auto`, model tests cost money

Moved here from MPI-1170 "Cosmo understands video" (Fabio, 2026-10-17). Rule: **a generated clip's own
prompt is read first; watching is for imported footage.** For a Story, the shot prompts are enough for
Cosmo and MCP to place clips into a sensible scene. MPI-1170 keeps only MCP viewing (MPI-1168) and
Cosmo listening (MPI-1169); this phase builds on both.

- [ ] **Cosmo reads what is already known (G11).** `readCard` returns `look` and notes; `list_cards`
  can page past 30 rows and summarise per Story/scene rather than per card.
  **Verify:** agent-loop test reads a card's look + note; budget test passes.
- [ ] **Joined videos keep their recipe (G12).** Combine writes its source item ids + in/out
  (Mix `videoLane` shape, `js/data/mixRecipe.js`) to the output sidecar.
  **Verify:** route test — a combined clip's sidecar lists its inputs in order.
- [ ] **Video-input describer (G13).** Test DeepInfra models tagged `input-video` +`tools`
  (checked 2026-10-17, per 1M tokens in/out): `inclusionAI/Ling-3.0-flash-VL` $0.06/$0.18,
  `nvidia/NVIDIA-Nemotron-3.5-Super-VL` $0.10/$0.40, `XiaomiMiMo/MiMo-V2.6-Flash` $0.14/$0.28 (also
  `input-audio`, 1M context). Video format and length limits are UNDOCUMENTED — a real call settles
  them; ask Fabio before spending. If one works, the Remote describer sends the clip itself; ComfyUI
  keeps the sheet. **Verify:** bench evidence per model in research/, then one look on a real clip.
- [ ] **Vision chat model "recommended for video".** **Still pictures moved to MPI-1208 (Fabio,
  2026-10-19): pick the model there; this item keeps only the video half on top of it.** A DeepSeek-Flash-class agent model that can SEE
  images, so Cosmo runs the MPI-1168 MCP process itself (separate frames, scene pick, `from`/`to`)
  with no describer in between. Needs an agent-bench run per candidate before it is recommended.
  Also closes the MPI-1164 look leak: given a reference "for this grain / grading / light", Cosmo
  writes the named quality into the prompt every run, but also copies qualities nobody asked for (the
  photo's grain onto a light ask, 6/6 on DeepSeek V4 Flash), because it only sees the describer's
  whole-picture text. A model that sees the picture can take just the named quality. Bench cases
  look-grain/grade/light-into-prompt in `services/agentBench.mjs`; add the "only that quality"
  assertion back when re-testing (removed in e5f4f9a00).
  **Verify:** agent-bench pass + a camera-move clip read correctly.
- [ ] **Scene index for imported footage.** Split a long import into shots once (the MPI-1168 scene
  pick), describe each shot once into its sidecar, let Cosmo search the text and zoom with `from`/`to`.
  After the describer/model choice above. **Verify:** a 10-minute import indexes once; a second
  question answers from the index with no new vision call.

## Phase 6: Storyboard workspace — `user-ux`

- [ ] Fully editable page for the Story card (`/impeccable` + components rules). **Verify:**
  desktop spec edits a shot, reorders, swaps a take; Fabio's look-and-feel yes.

## Phase 7: Story → Mix — `auto` then `user-ux`

- [ ] Build a Mix recipe from approved shots (selected item ids), Ambience from location Elements,
  music via Stable Audio 3; reference-aware delete (MPI-920, G9). **Verify:** a Story assembles
  into a Mix card that renders; deleting a take used by a Story warns.
- [ ] (If the Phase 3 keyframe bench passes) Mix "fill the gap": regenerate the frames between two
  clips on the video lane with H3, previous clip's tail anchored at 0 and the next clip's head at
  `-N`; and "make picture to this sound": an audio segment anchored at its frame.
  **Verify:** one bridged pair renders without a visible jump at either seam; Fabio's yes.

## Plan Drift

- 2026-10-24 (Fabio, brainstorm in "LTX 2.5 model 10"): Keyframes (MPI-1191) and Storyboard
  (MPI-1231) ship FIRST, in the LTX 2.5 release (umbrella MPI-1267), ahead of this umbrella: Storyboard = a stack of panel
  cards (intent line = card note) + Create Sheet on any stack; Keyframes = one step, a stack or library
  pictures + section prompt + one length (max 15 s), LTX 2.5 or H3, enhancer writes one timed prompt.
  Their briefs hold the detail. Consequences here: the Story card (Phase 2) and Storyboard workspace
  (Phase 6) are ONE object that grows out of that stack (sections, a video per section, Generate for
  missing sections, regenerate one), not a second pair. Infinite Video (Phase 4) = it directs (cuts vs
  extends, continuity, makes its own keys from loose references) and runs MPI-1191's graph in 5-10 s
  clips. The Phase 3 keyframe bench moves into MPI-1191 (both models). Later the same day Fabio took
  Keyframes OUT of the LTX 2.5 release: only MPI-1231 (Storyboard) moved to umbrella MPI-1267;
  MPI-1191 stays here, design decided, not started.

- 2026-10-21: Fabio added the Storyboard Flow (MPI-1231) and widened Keyframes to Video
  (MPI-1191) to LTX 2.3. Bench the LTX arm alongside H3 in Phase 3.

- 2026-10-18: Fabio flagged core `MiniMaxH3AddGuide` (anchors at any frame, chainable) for Infinite
  Video / Story / Mix. Phase 3 keyframe bench + Phase 7 gap-fill added; notes in
  `research/h3-addguide-keyframes.md`.

- 2026-10-17: Phase 5b + gaps G11-G13 added from the MPI-1170 brainstorm (video understanding for long
  work, video-input models, vision chat model, scene index).

## Verification

**Verify mode:** user-ux (Phases 3-check, 4, 6, 7 have surfaces Fabio must judge; 1, 2, 5 auto).

The umbrella closes when a user can go from a chat idea to an exported Mix of an approved
multi-scene Story, and the Infinite Video Flow makes a Story card from one prompt.

## Preservation Notes

- When a phase ships, move its BUILT facts from `docs/story/` into a normal subsystem doc and
  leave a pointer (docs/story/README.md says so).
- `docs/story/data-model.md` must follow the "shot refs = group id" decision above.
- Ask Fabio before editing `.claude/rules/` for the new card kind / page (CLAUDE.md rule 5).
