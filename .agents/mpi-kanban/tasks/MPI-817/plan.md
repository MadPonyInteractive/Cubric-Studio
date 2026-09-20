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
