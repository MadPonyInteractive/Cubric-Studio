# MPI-817 — In-app agent reliability (umbrella)

*Created 2026-09-19 on Fabio's instruction, folding MPI-774 and MPI-816 into one job.*

One question runs through both cards: **does the in-app agent do what it is asked, and say so
truthfully when it does not?** Fabio's two review rounds, the global-memory gap and the flow
dispatch bug are all that same question at different layers.

> **Order, Fabio 2026-09-26: FINISH this umbrella next, then pick up MPI-941** (in-app agent
> umbrella 2: `look` sees clips, MPI-904, MPI-913, MPI-905). This goes session to session by
> handoff: when MPI-817 closes, its close-out hands off to MPI-941. The Current State below
> dates from 2026-09-20, and several members may have closed since then, so check the board
> before trusting it.

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

## Current State (2026-09-26, session 43718bac, from handoff b12a5213)

Reconciled against the board and the code; the dated updates below are history. **Every member
but MPI-774 is `done`** (816, 820, 839, 840 closed 09-21; the wake is MPI-870, closed 09-21).
Phases A, E, F and the Phase C first piece are finished. What is actually left:

1. **MPI-774 closure, Fabio's to give.** (a) The pinned settings panel's five steps
   (`tasks/MPI-774/validation.md` § "Fabio's check in the app") were never verdicted.
   (b) Yes or no: raw `injectionParams` still merge over the resolved params while pinned
   (`js/shell/agentDispatch.js:536-538`). One line. Its `attention` (Phase 5 pass, 09-17) is stale.
2. **Phase B, global memory (MPI-774 Phase 6).** Not built. The v1 spec is written (four items),
   `user-ux`. Build here, or defer to its own card: his call.
3. **Phase D, model skill packs: the sanitised version EXISTS.** Every shipped model (36/36,
   `guideIdsByModel()`) has a guide in `docs/agent/models/<recipe>.md`, written from the vendor
   pack, gated before a first prompt, with the two-hop split already built (`guide:<id>/<topic>`,
   Seedance 2.0 uses it) and H3's arc/roll gap closed. `isVisionSkill` filters the HTTP skills only,
   so it is not the gap. Left, if anything: re-pull BFL's pack (moved to FLUX 3) and re-judge
   Krea's for the agent. Fabio 2026-09-26: this is needed; re-scoped here, not rebuilt.
**Round 2, same session (suite 1973 / 0 fail):** Fabio PASSED the pinned panel; its follow-up ("close
the settings panel and I'll pick") is built. **No clock on a job** (his call): the route's
30 minutes is gone, a closing window settles its own jobs `WINDOW_CLOSED`, MCP's job record
lives an hour past its END. **Global memory (Phase B) is BUILT**, owes his three live checks
(`validation.md` last section). The big-batch report shape (his 350-photo case) is MPI-941 Phase 1, his call.

**Built 2026-09-26, suite 1964 / 0 fail (`validation.md` § Session 43718bac):** items 1b (raw
`injectionParams` dropped while pinned, Fabio's yes), 4 (all but the clock) and 5 (proven live on
DeepInfra). **Next:** Fabio's pinned-panel check (1a); his call on the 30-minute clock (a design
change, below); Phase B's shape; then `mpi-end-session`, whose handoff points at MPI-941.

4. **Five small defects, each confirmed in today's code:** `settleThrow` never logs `err.cause`
   (`agentLoop.mjs:1734`); a refused `generate` still reads "Starting generation" (`:2502`); Ollama chat
   is `stream:false` over Node `fetch`, so its 600 s budget dies at the 300 s headers limit
   (`llmEngines.mjs:139-144`, `:223`); a held dispatch's 30-minute clock starts at dispatch
   (`agentTools.mjs:108`, derived, never measured); a stored look does not record WHICH describer
   wrote it (asked for by Fabio 09-21; `storeLook` writes text only).
5. **One unproven path:** the tools-off `OUT_OF_ROUNDS` closing call has never run against a real
   provider (no live turn has reached 16 rounds).

Watch-only, no build: the agent ending an Auto-mode turn on a question; a note generalising from two
runs; the `__ARG__` project (Fabio's to delete); Ollama's free cloud models (unconfirmed research).

## Plan Drift

- **2026-09-26 (session 43718bac):** members closed since 09-20: MPI-816, 820, 839, 840 (all 09-21),
  and the wake/batch design became MPI-870 (closed 09-21). Items owned elsewhere now, dropped here:
  hand the Flow back -> **MPI-892** (todo, under MPI-889); model knowledge in a skill vs the prompt ->
  **MPI-903** (done); the Ollama picker telling the user nothing -> **MPI-912** (done); the NSFW flag on
  Qwen3-VL-30B -> moot, MPI-912 removed its agent flag at 7/22 and `describe` moved to gemma-4-26B;
  the deliberation leak -> MPI-891's `reasoningEffort: 'low'` on the default model. Found already
  fixed: `NO_PROJECT` now tells the agent to call `create_project` (`agentLoop.mjs:1518`), and
  create-project matches a name case-insensitively (`routes/connector.js:657`). The i2v centre-crop
  item was built 09-19 (Shape rule + `imageSize`) and simply never ticked.

## Current State history (2026-09-20, session 5d913141)

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

**Denoise, read before building (2026-09-21 00:10Z).** Three facts, all from code:
1. 0.3 on the krea2 i2i sidecars is the op's own DEFAULT (`commandRegistry.js` `i2i.defaults`;
   upscale 0.20, detail 0.30, PiD 0.0), not his slider.
2. **An agent run injects NO denoise.** The PromptBox control returns `{ Denoise: v }`
   (`PromptBoxControls.js`); `resolveNamedParams` never sets it, so the graph runs its BAKED
   value, and `_snapshotControlState` then records `defaults + the project's op bucket` in the
   sidecar. Same defect as duration before MPI-820: the record and the run can disagree.
3. No edit to `js/shell/agentDispatch.js` is needed: `_listModels` passes
   `namedParamsFor(model, op)` through whole and `_submit` merges `named.injectionParams`.
   Footprint: `js/data/generationControls.js` (advertise + validate + inject `Denoise`, explicit
   > project's op bucket > op default, exactly the duration ladder), `routes/connector.js`
   (`NAMED_PARAM_KEYS`), `services/agentLoop.mjs` (tool schema + body), the generate skill doc.

**Update 00:35Z: denoise is BUILT**, suite-green (1670 / 0 fail), NOT live-seen
(`validation.md`, last section). Two things now wait on ONE restart of his app: the kept look and
denoise. Single next action: the vision-model test on the cowgirl PNG. It needs his yes first
(it spends on his DeepInfra key), and the key is not in the agent shell (see
`~/.claude/memory/general.md` for where it lives). After that, the `:i2i` NOTE in
`modelPriority.js` (data only, inside his rule, not yet approved by name). Candidates, looked up
keyless 2026-09-21 (`api.deepinfra.com/models/<id>`, $ per 1M in/out): the CURRENT describer
`meta-llama/Llama-4-Scout-17B-16E-Instruct` 0.10/0.30 (`llmEngines.mjs`
`RECOMMENDED_REMOTE_MODELS`, picked on ONE call that "returned a named subject");
`Qwen/Qwen3-VL-30B-A3B-Instruct` 0.15/0.60; `Qwen/Qwen3-VL-235B-A22B-Instruct` 0.20/0.88;
`google/gemma-4-26B-A4B-it` 0.07/0.34 (vision input unconfirmed). Qwen3-VL-8B and
Qwen2.5-VL-32B are DEPRECATED there, so the 4B he rates on the ComfyUI side has no hosted twin.
A describe is ~1.5k in + ~300 out, so 4 models x 5 runs is under one cent. Score on the known
truth: upright, both revolvers raised, pointing UP. Worth a sweep once:
which other controls does the PromptBox inject that `resolveNamedParams` does not? Duration
and denoise were both that; `upscaleFactor` and `useGrid` are the obvious suspects.

**Update 2026-09-21 08:30Z.** Fabio closed MPI-816 and MPI-840/839/820; the project-switch fix
has its `UNRELEASED.md` line. **The describer is replaced on evidence** - `gemma-4-26B-A4B-it`,
10/10 and half the price of Scout's 6/10 (`validation.md`, the table). **His 07:45Z app test ran
a build from BEFORE the kept look and denoise** (boot 22:22Z, fixes 23:52Z / 00:30Z), so both
still owe a live check after ONE restart. That run did prove two things that are not mine: the
agent promised to report back although the rule forbids it (fourth time a prompt line has lost),
and a finished generation is SILENT until he types - the wake-on-drain gap, which is what he
actually hit. Next: (1) the wake, now the top-ranked unbuilt piece and the thing he feels;
(2) record WHICH describer wrote a stored look - he asked for it, it needs `agent.describe` to
report its model, and that is in MPI-797's `agentDispatch.js`; (3) a second, harder bench image
(two characters, unusual poses) through `research/vision-bench.mjs`; (4) the `:i2i` NOTE.

**Update 2026-09-21 08:55Z, session f756c6e3 (resumed from handoff 247bcfc4).** The push the
handoff asked for was already done — a peer's push published the shared branch, so 520a2099,
7e762e8b and d112cbb7 all reached origin. Fabio restarted at 08:28:39Z and ran both owed checks.
**The kept look's WRITE half passed** (one `agent.describe`, `look` on the sidecar, and the new
gemma describer read the frame correctly). **Its READ half failed** and **denoise never ran** —
both recorded in `validation.md` § LIVE 2026-09-21 with the log lines.

Built and committed as `314355ec` (suite 1673 / 0 fail, composition test proven red backed out):
the `look` `question` param now says to omit it for the plain description; the Model rule's
flat "changing an existing picture is the edit task, not i2i" is **narrowed** to a local
instruction, with a restyle routed to i2i; and `modelPriority.js` gains `OP_NOTES` — a note
keyed by op, **appended** to the model note — carrying the i2i restyle route, plus klein-9b's
observed habit of covering a bare subject.

**Fabio's ladder for a restyle** (his words, 2026-09-21): i2i first, a style-matching model if
one exists, else i2i on whatever they have prompted from the description plus the style, and
edit only on escalation when the user says it strayed too far. It does not reverse his
"edit is more truthful" from 2026-09-20 — that held while the describer misread pictures, and a
correct kept description is what changed.

Single next action: `314355ec` is committed and **NOT pushed** — the pre-push gate blocks on a
PEER's unjudged commit (MPI-797's close e0fc0eec, run 35579221191). Not ours, not a red master,
and `--no-verify` is wrong here. Push when that run reads `conclusion: success`. Then ONE live
run in Fabio's app: "make this anime" on an imported photo should reach i2i on `ill-anime` at a
low denoise, prompt visibly built from the kept description, no clothing added — which is also
the first real exercise of the denoise named param.

After that, the WAKE is still the top unbuilt piece and still has **no card**; it lives only in
§ "Phase C, first piece" below. Fabio has not yet answered its one open question (a confirm card
above N fanned-out cards; vote 5).

**Update 2026-09-21 09:35Z, same session — B+C PASSED LIVE, and the wake is now MPI-870.**
Fabio restarted at 09:14:19Z and ran it. `describe` -> **two** `list-models` (it reconsidered,
which it did not do before) -> `submit`: `i2i_001`, op **i2i**, model **ill-anime**,
`injectionParams.Denoise: 0.3` — the first agent run where denoise actually reaches the graph.
Prompt was Danbooru tags built from a description of his photo. **B passed too**: "Can you
describe it for me please?" made **zero** `agent.describe` calls (two all boot: the source at
09:14:50, the result's auto-look at 09:15:32) and the agent quoted the stored text.
Commits `314355ec` (code, CI green) and `8c6864b5` (evidence) are on origin.

**What the round then found, and it is NOT the nudity.** The pose drifted: bent-forward
full-body selfie came back as a standing upper-body figure. The tags carried no nudity word and
`i2i_001` still came back bare below the waist — an uncensored model does not add clothes that
were not asked for, so modesty was never the cause. The cause is that the tags said `upper body`
for a full-body bent-forward frame and carried **no pose tag at all**. At denoise 0.3 the room
held perfectly and the pose was rewritten, because the pose was never in the words. Fabio's bar
for a describer feeding a restyle: **pose and framing fidelity, not explicit vocabulary** — which
is also what keeps the describer swappable when a hosted model refuses explicit content.

**Cannot be attributed, and that is the gap:** whether the describer misread his photo or the
description->tags step dropped the pose. A staged attachment has no `itemId`
(`agentLoop.mjs:1607`), so `_lookOnce` never writes it a sidecar and the source description
exists nowhere on disk.

**MPI-870 created** (top of `todo`, `planned`, `plan.md` written): the wake on drain, the batch
ask with Fabio's confirm threshold of **5**, plus three small honesty fixes folded in on his
instruction — the `Looking at image` label lying on a cache read (his wording: *"Fetching saved
image description"*, and his reason: a visible saving tells the user their credits are not being
spent, which is a product goal), one truncated log line per look so an attachment's description
is auditable, and a record of whether a named param was **asked** or **defaulted** (the agent
said "low denoise"; 0.3 is also the i2i default and disk cannot tell them apart).

Single next action: **build MPI-870.** Nothing on MPI-817 is owed — both live checks are paid.

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
