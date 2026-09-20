# MPI-817 — In-app agent reliability (umbrella)

*Created 2026-09-19 on Fabio's instruction, folding MPI-774 and MPI-816 into one job.*

One question runs through both cards: **does the in-app agent do what it is asked, and say so
truthfully when it does not?** Fabio's two review rounds, the global-memory gap and the flow
dispatch bug are all that same question at different layers.

## Members

| Card | Column | State | What it carries |
|---|---|---|---|
| **MPI-774** | `doing` | `validating` | Fabio's round 1 and round 2 findings. Phase 5 is closed (ten fixes; fix 8 closed unreproduced 2026-09-19). **Phases 6 and 7 are open.** |
| **MPI-816** | `todo` | `planned` | Agent-dispatched Flow runs die on `prompt_outputs_failed_validation`. Diagnosed to the line, not built. |
| **MPI-839** | `doing` | `validating` | A generation that finishes after a project switch saves into whichever project is OPEN. Not agent-only — the same path serves a human press. Found live 2026-09-20. **Both halves built** (ae42ebcf; then the project-scoped placeholder + the freeze moved to ENQUEUE). Placeholder PASSED live 2026-09-20. The card-landing check then FAILED and found the real end of the bug: the closed-project write sent item OBJECTS where disk holds item IDS, so the reconciler dropped the card on the next open. One serialiser now, and the route refuses the wrong shape. Owes ONE more live landing. |
| **MPI-840** | `doing` | `validating` | A message typed while the agent is answering is refused (`BUSY`) and lost. Found live 2026-09-20. **Built 2026-09-20: it queues on `agentSessions` and runs next.** Also carries the `write_memory` guard on `unfinished-generations.md` and the agent's new `cancel_generation` tool (`POST /connector/cancel`). **Queue + cancel PASSED live 2026-09-20 10:45Z**, read off app.log. Closable at end-session. |

Member cards stay where they are — this umbrella does not close, move or merge them. Which of the
two the board keeps long-term is Fabio's call, asked once below.

**MPI-830 is NOT a member** — it shipped the connector's GIF routes and closes on its own. Its in-app half is Phase D below, because the agent's files belong to this umbrella's session.

## Phases

### Phase A — MPI-816: the agent cannot fill a field it was never described (open)

Plan: `.agents/mpi-kanban/tasks/MPI-816/plan.md` · checklist and validation beside it.

Two independent defects, both located:

- `js/utils/declaredFields.js:500` — a `null` caller value overwrites a declared default.
- `js/shell/agentDispatch.js:488` — `agent.list-models` advertises flow fields as `{id, label}`
  only, so the agent cannot know a field's type, default or legal options.

Closes only on the end-to-end verify: ask the agent, in Fabio's own words, for four character
sheets of four sisters, and **four cards land**.

**PASSED 2026-09-19 09:45–09:48Z** in Fabio's own app, on his GPU, after he handed the run over.
Four named cards, real sheets, no error line; evidence in `MPI-816/validation.md`. Card is at
`validating` — his sign-off closes it.

### Phase B — MPI-774 Phase 6: global memory (open, needs Fabio)

A global agent store beside the per-project one (`<APP_USER_DATA>/agent/`). Design conversation
first; nothing is decided. See `.agents/mpi-kanban/tasks/MPI-774/plan.md` § Phase 6.

### Phase C — MPI-774 Phase 7: agent reliability (open, needs Fabio)

See `.agents/mpi-kanban/tasks/MPI-774/plan.md` § Phase 7. **Phase A is evidence for this phase**,
not a detour from it: a dispatch that fails four times while the agent reports success is exactly
the reliability question Phase 7 exists to answer. The narration bug parked at the end of MPI-816's
plan belongs to whichever of the two Fabio wants it in.

### Phase D — model skill packs (open, in the checklist)

Carried in full in `checklist.md` rather than here: vendor prompt packs for the shipped
models, the two-hop progressive-disclosure shape Fabio set, and the re-judge of the
2026-08-17 survey for the AGENT rather than the enhancer. Not repeated here.

### Phase E — the agent's four GIF tools (open, ready to build)

*Added 2026-09-19 on Fabio's instruction: the in-app agent's half of MPI-830 belongs to
whoever is working in the agent's own files, not to the card that built the routes.*

**Nothing to design and nothing to measure — the surface exists and is tested.** MPI-830
shipped `POST /connector/gif/{make,edit,cutout,to-video}` (`routes/connectorGif.js`,
`08053cbb`), landing real gallery cards through the renderer job channel. This phase is the
tool table over it, in `services/agentTools.mjs` + `services/agentLoop.mjs`, plus the system
prompt lines.

| Tool | Body |
|---|---|
| `make_gif` | `{ itemIds: [>=2] }` or `{ videoItemId, fps, sizePreset?, loop?, trimIn?, trimOut? }` |
| `edit_gif` | `{ itemId, fps?, loop?, trim?{in,out}, output?{colours,edgeColour,maxEdge}, resize?{width,height}, crop?{...} }` |
| `cutout_gif` | `{ itemId, method: 'background'\|'name', prompt?, adjust?, invert? }` |
| `gif_to_video` | `{ itemId, background? }` |

Full contract, every error code and the traps: `.claude/skills/cubric-vision-gif/SKILL.md`.

Four things the route half already learned, so this phase does not have to:

1. **Item ids, not group ids, and only in the OPEN project.** The `_images` allowlist idiom
   fits: a conversation reaches cards it made or was shown, nothing else.
2. **They are AWAITED, unlike `generate`.** The ffmpeg verbs are seconds; `cutout` is a GPU
   run (BiRefNet ~16 s for 30 frames, SAM3 longer). If that fights the one-turn-at-a-time
   rule, fire-and-queue it the way `generate` is — the route answers in the connector
   envelope either way.
3. **The agent cannot judge a GIF.** `look` reads ONE still, so motion, flicker and pacing
   are the user's eyes. That belongs in the honest-limits list, not left for the model to
   discover.
4. **The knowledge index already has it.** `services/agentCorpus.mjs` picks up
   `.claude/skills/cubric-vision*` by prefix, so the model can already READ about GIFs it has
   no tool to make. That asymmetry is the reason this phase should not sit long.

Out of scope, exactly as for the routes (Fabio, 2026-09-19): By colour, SAM3 object chips,
the Mask Brush, per-frame scope.

**Verify:** ask the agent, in Fabio's own words, to turn a video card into a GIF and remove
its background — and the cards land.

**BUILT 2026-09-20, owes the live check above.** `make_gif` / `edit_gif` / `cutout_gif` /
`gif_to_video` in `services/agentLoop.mjs` (defs + `_gif()` + four branches), four thin
wrappers in `services/agentTools.mjs`, four routes allowlisted on purpose in
`tests/agent-no-delete.test.cjs`. The one design point this plan left open — routes take ITEM
ids, the model only knows `ref` — was settled without a second id: `services/agentCards.mjs`
puts the SHOWING version's `itemId` in its `files` map, `generate`'s `output.itemId` rides into
`_registerResult`, and the GIF tools look the item id up from the same `_images` entry `look`
resolves. A ref with none is `NOT_A_CARD` and reaches no route. All four are AWAITED (MPI-840's
queue catches anything typed during a cut-out). The motion limit went into the tool
descriptions, no prompt line added. Test: `tests/agent-cards.test.cjs`, last test. Not built, on
purpose: fire-and-queue for `cutout` — add it only if a live cut-out blocks a turn badly.

### Phase F — the agent's view of cards: marks and the visible set (open, specified)

*Asked for by Fabio 2026-09-20. Full spec, traps included, in handoff `889a2340` § plan.pending
items 3 and 4 — read it there, it is not repeated here.* Two halves that ship together:
(1) card MARKS — `markOf(group)` on each `list_cards` row, a `mark_card` tool copying the
`rename_card` path, a `mark` filter on `list_cards`; (2) THE VISIBLE SET — a relay capability in
`js/shell/agentDispatch.js` over `state.gallerySort`, never a `list_cards` argument, reusing
`matchesGallerySort` + `byGalleryOrder`. No card of its own: it lives here.

**BUILT 2026-09-20, owes Fabio's live check (validation.md § Phase F).** Shape that was not in
the spec: the renderer answers with GROUP IDS only (`gallery.visible`), and the ROUTE builds
the rows off disk with `agentCards.cardsByIds` — one row builder, one filter predicate, no
second copy of either. `cardsByIds` skips `_groups()` on purpose so the archived scope works.
`markGroup(groupId, mark)` is new in `js/services/projectService.js`, beside `renameGroup` and
for its reason (lookup inside the mutation queue); the spec's `updateGroup(group)` would have
written back a captured copy. Decision taken, his to reverse: `mark_card` has NO own-cards gate
(rename_card has one) because marking the user's cards is the ask. Both routes are public, so
the external `cubric-vision` skill documents them (`projects.md` § Marks and what the user can
see). 1588 tests, 0 fail. **Nothing is committed yet.**

## Current State (2026-09-20, session 5d913141)

Phase E and the video hand-off PASSED LIVE 19:02Z (`validation.md` § LIVE PASS): one message
with a video chip, `gif.make` then `gif.cutout`, no `list_cards` first. The video fix was not in
the handoff — Fabio hit "I can't send videos to the agent" again mid-session and it was built
then: the box takes a video in agent mode once a project is open, and it goes BY REFERENCE
(url + item id), never bytes. Phase F PASSED LIVE 19:07-19:12Z on all four checks. That round
found `rename_card` refusing Fabio's own listed cards (a gate older than `list_cards`): fixed —
a card the app LISTED is nameable, a made-up id is still `UNKNOWN_CARD` — and that fix is the
one thing NOT live-seen. Everything is UNCOMMITTED. Next action: restart, repeat "give names to
the unnamed square and triangle cards", then `mpi-end-session`
(MPI-840 closable; MPI-839 once its reopen-the-origin-project landing passes). Message
`be606244` (MPI-842) was answered: reply `a7dc92be`.

**Update 2026-09-20 21:55Z, session 75e1e043 (resumed from handoff d8d9bda5).** Phases E, F and
the video hand-off are COMMITTED and pushed as `f70b4c84`. The `rename_card` fix PASSED LIVE
21:47:21Z after a restart: four `card.rename` jobs in app.log, all 11 marked cards named on
disk (`validation.md`, last section). Nothing built by this umbrella is un-seen any more.
Single next action: MPI-839's landing check (dispatch, switch project, let it land, reopen the
origin project, the card survives) - Fabio is running it now. Then `mpi-end-session` for
MPI-840 / MPI-839 / MPI-820. What is left here after that is Phases B, C and D, and each
starts with a conversation with Fabio, not code.

**Update 22:10Z.** MPI-839 landing PASSED LIVE (its `validation.md`). The same run found the
step cap lying: fixed and suite-green (`validation.md`, last section), UNCOMMITTED, not
live-seen - it needs a restart and one chained ask ("make this an anime still, then animate
it"). Pass = the turn ends in a sentence from the agent, no red error line. This is Phase C
evidence, folded in here rather than carded.

**Update 2026-09-20 23:59Z, session 3ed1701d (resumed from handoff 7bcaeeb8).** MPI-840,
MPI-839 and MPI-820 are CLOSED (`done` / `complete`) on their recorded live evidence; the
Members table above is history for those two rows. His findings ask is done:
`docs/agent-findings.md`, routed from `docs/README.md`. `docs/agent-chat.md` was NOT touched:
MPI-797 holds it (claim 996bfd29, with `js/shell/agentDispatch.js`); message `e7c38539` asks them
for the pointer line and flags the 378-line budget. This umbrella stays in `doing`. Single next
action: the sidecar-stored look (`services/agentLoop.mjs` + `agentTools.mjs`), test RED first:
a second look at the same card makes zero vision calls. Then denoise as a named param, whose
`describe_model` half lives in MPI-797's `agentDispatch.js`: message before touching it.

**Update 23:58Z, same session.** The sidecar-stored look is BUILT, suite-green and proven
against the real `update-meta` route (`validation.md`, last section). NOT live-seen: it needs a
restart and one "make a still, then tell me what you see". Open question put to Fabio: a kept
description outlives the describer that wrote it, so a better vision model will not re-read
cards the old one already described. Single next action: denoise as a named param. START by
reading where `controlState.op.denoise` comes from (default vs his last slider: still NOT
checked), then message MPI-797 before any edit to `js/shell/agentDispatch.js`. After that: the
vision-model test on the cowgirl PNG, which spends cents on his DeepInfra key and needs his yes.

## Phase C, first piece: batch ask + wake on drain (DESIGN NOTE 2026-09-20, not built, not approved)

Raised by Fabio after the step-cap find. Two halves of one job.

**Batch (the ask).** `generate` takes ONE card per call, so "upscale all 50 visible" is 50 tool
calls, 50 chat lines, 50 auto-look vision calls and ~100 notes in the next turn. Shape: a
`cards: [ref...]` list on `generate` = same op once per card, fanned out in the loop over the
existing single-dispatch path. One call, one chat line, one `{started, refused}` result, no
auto-look on batch items. Open, his call: a yes/no confirm card above N cards (vote: 5).

**Wake (the ending).** `settle()` already knows when a conversation's `_inflight` hits zero, and
the finished notes then sit in `_notes` until he types. Wake = run a turn at that moment, through
`agentSessions.queue` (MPI-840, live-passed). `wait: true` stays for mid-chain steps.

Rules that came out of his three scenarios (keep talking + add to the batch; go talk to
project B's agent; come back and work in a workspace):

1. Wake only an IDLE conversation. A turn running or queued for it reads the notes anyway.
2. Additions join `_inflight`, so the drain is the true end and the wake fires once. Free.
3. NEVER wake a conversation whose project is not the open one: the connector's generate route
   has no project targeting, a dispatch lands in whatever is OPEN (checked 2026-09-20), so
   project A's wake would render into B. The server does not track the open project. Lazy shape:
   the loop broadcasts `agent:drained {session}` (events are already session-tagged); the
   RENDERER posts the wake only if that project is open, and posts it again on project open,
   where the server no-ops without pending notes. That second post is the "while you were away"
   report. This is Fabio's toast-event instinct: the renderer is the side that knows what is open.
4. A wake turn must not move him: no `open_project` / `create_project` in its tool list. He may
   be mid-edit in a workspace.
5. Runaway bound: max 3 wakes in a row with no message from him (a knob, not a constant).
6. Unknown, check before building: what `gallery.visible` answers while a workspace, not the
   gallery, is mounted.
7. `_inflight` is memory only. A restart mid-batch loses the wake; `unfinished-generations.md`
   already covers what was asked for.

Separate defect, same area: a held dispatch's 30-minute clock (`agentTools.mjs` `_post`) starts at
DISPATCH, so the tail of a deep queue is recorded `RUNTIME_ERROR` while still queued, and lands
anyway. Derived from code, not measured.

## Phase C evidence: the restyle round (live 2026-09-20 22:24-22:32Z, nothing built)

Fabio asked for an anime version of a photo, then its video. Sidecars in Cowgirl on a Bull:
`i2i_003` and `i2i_004` (krea2 `i2i`), then `edit_001` (`krea2Edit`) only after HE said to use
edit, then `i2v_ms` from it. Earlier the same night: `ill-anime` `i2i`. Four findings:

1. **The task rule exists and lost three times.** `agentLoop.mjs` Model rule: "changing an
   existing picture is the edit task ... not i2i". "Anime" matched ill-anime's NOTE, the rule lets
   a note outrank a rank, and ill-anime has no edit op, so i2i was its only door; on krea2 the
   style rack's Retro Anime pulled the same way. A prompt rule lost to a plausible deduction.
   Home for the fix is data, not prompt: `modelPriority.js` NOTES has no `:i2i` entry. One line
   on the op saying i2i repaints from the WORDS and an edit op keeps the picture.
2. **The agent does not know denoise exists.** Zero hits for `denoise` in agentLoop, agentTools,
   agentDispatch, connector. Both krea2 i2i runs carry `controlState.op.denoise: 0.3`, a value
   from the app, not the agent. Default or his last slider: NOT checked. Without it a model with
   no edit op (ill-anime) cannot be asked for a faithful restyle at all.
3. **The agent's eyes were wrong and there is no record of what they said.** Source: rider
   upright, both revolvers raised, pointing UP. Its prompts: "leaning forward", "pointing
   outward at her sides". No ComfyUI activity during `agent.describe` (8 s each), so the
   describer was the remote vision model. Whether IT misread or the chat model paraphrased is
   unprovable: look text lives in server memory only. One truncated log line per look fixes that.
   Edit came out right anyway because an edit op keeps the pixels whatever the words say. That is
   why Fabio finds edit "more truthful": it is robust to a wrong description, i2i is not.
4. **Every waited still is looked at twice**: `settle()` auto-looks, then the model calls `look`
   on the same file (two `agent.describe` 8 s apart after each submit). Two vision calls, one picture.

### Fabio's decisions on that round (2026-09-20 ~22:45Z) - these ARE approved directions

- **A look is written down, once, in the card's SIDECAR.** "If an image is described, it's
  described forever." `look` reads the sidecar first and calls the vision model only on a miss;
  the description dies with the card, which is the point. This replaces finding 3's "log line"
  AND finding 4's double look in one move. He also named the wider idea: the sidecar is the home
  for card-scoped derived information in general. Open: a look with a QUESTION or a box is not
  the same answer as the plain description - key the stored text by question, or store only the
  unprompted one. Decide when building; do not store a box answer as "the" description.
- **The agent must know denoise**, for i2i, upscale and detail. His words: the higher it is, the
  more the generation changes the image. A named param with that meaning on every op that has
  the slider, advertised by `describe_model`, never a prompt line.
- **Find a vision model that actually works and recommend it.** The recommended describer
  misread a plain pose. He rates the Qwen vision 4B used on the ComfyUI side; check what Qwen-VL
  DeepInfra serves (keyless `api.deepinfra.com/models/<id>`, see `~/.claude/memory/tools/deepinfra.md`)
  and TEST candidates on the real source picture
  (`Cowgirl on a Bull/Media/.preview-assets/0fd0e19d...png`: upright rider, both revolvers
  raised, pointing up) before recommending anything. A pick with no test is a guess.
- **Masks, detailing, workspace tools: agent v2, through skills.** Not now. Do not start it.
- **Findings must live in documentation, not only on this card.** The agent is permanent.
  `docs/agent-chat.md` is ~365 lines against a 200 budget, so it cannot take them: split out a
  findings doc (what works, what failed, why) at close-out and route it from `docs/README.md`.

## Parallel Batch — Phase A and Phase B

Disjoint footprints, so these two can run at once. Phases B and C both need Fabio in the room, so
in practice this batch is only worth arming if he is working B while a worker takes A.

**Task A — MPI-816 flow-field dispatch**
Owns:
- `js/utils/declaredFields.js`
- `js/shell/agentDispatch.js`
- `.claude/skills/cubric-vision-flows/SKILL.md`
- `.agents/mpi-kanban/tasks/MPI-816/`
- tests it adds for the above

**Task B — MPI-774 Phase 6 global memory**
Owns:
- the agent store paths under `js/services/` and `routes/` that Phase 6 settles on (NOT yet
  named — the design conversation has not happened, so this footprint is provisional and must be
  fixed before the batch is armed)
- `.agents/mpi-kanban/tasks/MPI-774/`

🔴 **Do not arm this batch while Task B's footprint is still provisional.** A batch whose
ownership is guessed is how two workers land on the same file. Phase C is NOT in the batch: it
overlaps Phase A's files by design.

## Settled: the member cards stay

Fabio, 2026-09-19: **keep MPI-774 and MPI-816 as separate cards.** The condition he attached is the
whole point of this umbrella — *"as long as they get picked up later or are part of the umbrella."*
So this card carries one obligation: **neither member is allowed to go quiet.** If a session closes
without touching them, they are still Phases A-C here, and this plan is where that is visible.

Do not fold, close or merge them without asking him again.
