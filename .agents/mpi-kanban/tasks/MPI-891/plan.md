# MPI-891 — The agent moves the view to where its work will render

Phase 2 of the MPI-889 umbrella (after MPI-890, before MPI-892).

## Current State

Project mode: scalable-foundation. Planned 2026-09-22, no code yet.

What already exists (read, not assumed):

- **Routing is done, viewing is not.** `js/shell/agentDispatch.js` sends an agent submit to a
  card's history (`{ existingGroup, scope: 'groupHistory', groupId }`) in two cases:
  `maskedGenerationOpts` (a mask is painted on that card) and `workspaceGenerationOpts`
  (MPI-890: the edited picture is an entry of the card the user is STANDING in). Everything
  else goes to the gallery with a placeholder card. Nothing ever navigates.
- **So three cases render where the user may not be looking:**
  1. masked edit, user has since left that card's history → latents draw in a hidden workspace;
  2. edit of an entry of a card that is NOT open (reached via `list_cards` / `visible_cards`) →
     today lands as a NEW gallery card, while Fabio's ask is that an edit happens in that
     card's history;
  3. gallery-landing work (t2i, a Flow, anything new) while the user is in some card's
     history → the placeholder draws in the gallery they are not on. Fabio 2026-09-22: the
     user must SEE an agent-run Flow in action.
- **Result card click** (`js/shell/agentPanel.js:77`, `gallery:open-card`) opens that card's
  history. Fabio 2026-09-22: pressing the card the agent hands back "should bring them back to
  the gallery" — see Decision D3.
- **Wake turns exist** (MPI-870, `services/agentLoop.mjs` `WAKE_TOOL_DEFS`): a turn the user did
  not type already loses `open_project`/`create_project` because "they may be mid-edit". Same
  principle applies here: a wake never moves the view.
- **No gesture signal exists.** Canvas mode (mask/paint/composite/crop/compare) lives on the
  `MpiCanvas` instance (`MpiCanvas.js:245` setter), not in `state`. Stroke flags
  (`isDrawingMask`, `paint.isDrawing`, `comp.isDrawing`) are manager-internal.
- `/connector/generate` builds the renderer `input` field by field (`routes/connector.js:495-521`),
  so any new flag must be added there explicitly.

Coordination: `agentDispatch.js`, `agentLoop.mjs`, `routes/connector.js`, `tests/agent-loop.test.cjs`
are **claimed with uncommitted edits by MPI-876 phase 2** (session a49d49d5, heartbeat
2026-09-22T19:55Z). Implementation waits for that commit or a handover via `mpi-message`.

## Decisions (recommended — Fabio to confirm before code)

- **D1. Navigation is an APP behaviour at dispatch, not a tool.** The app knows where the job
  renders; the model only has to call `generate`. "The app computes, the prompt persuades" —
  a `show`/`navigate` tool costs context every turn and the model forgets to call it. The loop
  sends `follow: true` on `generate` only from a turn the user TYPED (not a wake, not a carried
  request); a CLI agent never sends it, so an outside agent never takes the user's screen.
  The limits list (`agentLoop.mjs:1387`) gets one true line: it cannot move the view on its own,
  the app opens where its work renders when the user asked for it.
- **D2. The guard (the whole job).** Move only when ALL hold: `follow` is set; the target differs
  from where the user is; no mouse button is held (one app-lifetime pointer tracker); the user is
  not in a canvas edit tool (mask / paint / composite / crop) and no Flow overlay is open. The
  canvas mode gets published as one `state` key written by the `MpiCanvas` mode setter
  (new wiring → `.claude/rules/` update asked at session end). Guard refused → no move, and the
  `generate` answer says so (`view: 'stayed'` + where it renders) so the agent tells the user
  where to click. Never mid-gesture, never after the fact (a job that finishes later never moves
  anything).
- **D3. Where the result card takes you.** Recommended: to where the result LIVES — a new card
  (every Flow, every t2i) → the gallery; an edit that landed as a card's next entry → that
  card's history. Needs Fabio: is "bring them back to the gallery" about Flows only, or every
  result card? (Today every click opens history.)
- **D4. An edit of a card that is not open lands IN that card** (case 2): route it to that card's
  history as its next entry and, guard permitting, open that history first so the latents are
  seen. Guard refused → it still lands in that card, and the agent says which. This widens
  `workspaceGenerationOpts` from "the open card" to "the card that owns the edited entry".

- **D1-D4 confirmed by Fabio 2026-09-22.**

## Folded in: "this image, but with model X" ran as a restyle (Fabio, 2026-09-22)

Live, during MPI-876's batch test: *"Can you generate this image but with an ILL anime model and
please do a batch of four?"* with a dragged card (`t2i_001`, Nano Banana 2). The agent ran ILL
Anime **i2i** at moderate denoise and called it "a whole-picture restyle into the anime look".
Fabio expected a **re-prompt on the named model**: the same picture made again by ILL Anime.

Root cause, two halves:

1. **The Model rule has no task for it.** `agentLoop.mjs:1346` knows two picture tasks: a LOCAL
   change is edit, a whole-picture RESTYLE ("make this anime") is i2i. "This image with model X"
   is neither, so the model took the nearest example, and a model NAMED "anime" read as
   "make this anime". Fix: a third task, RE-RUN on another model: text-to-image on the named
   model from the source's prompt, rewritten to that model's guide; no media. Naming a model is
   never a style instruction; i2i only when the user asks to change how THIS picture looks.
2. **From a drag it has no prompt to reuse.** A dragged card arrives as a copied attachment with
   no card id (MPI-886, `todo`), so the source prompt is unreachable. With a card (the App
   state's `activeEntry`, `list_cards`) the rule reads the prompt from `list_cards`. With only an
   attachment it writes one from a `look` and says it worked from the picture. MPI-886 closes
   that gap properly; not folded, it has its own card.

**Verify:** a harness case in `npm run agent:test` ("this image, but with <model>", a card and an
attachment variant) asserting `generate` on the named model with a text-to-image op and no
media, `--bite` to prove it bites.

## Implementation

- [ ] Re-run task in the Model rule (above). **Verify:** the harness case, `--bite`.
- [ ] Wire `follow` loop → connector → dispatch; the guard + canvas-mode state key; navigate
  BEFORE enqueue so the target workspace is mounted when the first frame arrives; widen the
  history routing to the entry's owning card (D4); result-card destination (D3); one limits
  line; docs. **Verify:** unit tests for the guard's decision table (each refusal reason, wake,
  carried, CLI) and for D4 routing; a desktop spec on an isolated instance: gallery → agent edit
  of a card's entry opens that history and a frame draws there; history → agent Flow opens the
  gallery with the placeholder; mask mode active → no move, `view: 'stayed'`; `npm test` 0 fail.

## Completed

- [x] Re-run task in the Model rule: harness 0/3 on HEAD → 11/12, bites. (2026-09-22)
- [x] View follow, D1-D4, limits line, docs; `npm test` 1821/0, eslint 0. Uncommitted. (2026-09-22)
- [x] Full harness after reasoning_effort: 18/20, both FAILs a STALE assertion (fixed). (2026-09-24)
- [x] MPI-900's agent half: `frame.grow` + passes on the agent path. Uncommitted. (2026-09-24)

## Current State (2026-09-24, after live read 1)

Live read 1 (validation.md § 3): check 1 FAILED (a dragged card was a copy, MPI-886), check 2
PASSED, and check 3 hit two other bugs. Since then, all committed with this handoff:
- **MPI-886 folded in** (Fabio: yes). With a project open, a dragged card goes BY REFERENCE:
  `MpiAgentChat._addCardMedia` → `routes/agent.js` (image branch) → the loop registers it as
  the card (kind `result`, itemId, `_groups`), with `url` in history for the bubble.
  `tests/agent-card-reference.test.cjs` 3/3, mutation-proved.
- **Reasoning leak root cause:** DeepSeek-V4-Flash with no `reasoning_effort` has no reasoning
  channel and deliberates in `content`. `reasoningEffort: 'low'` on its RECOMMENDED entry →
  `reasoning_effort` in the DeepInfra body. Probe (2026-09-24): with it, the reasoning went to
  `reasoning_content` and the reply came back clean. Qwen3-VL-30B-Instruct has NO channel: if
  Fabio runs the agent on Qwen, that needs its own answer (ask which model he used).
- **Text rule** in the system prompt (never refuse words in a picture, quote them exactly).
  Harness case `text-in-picture` 1/1.
- **Portrait crop in chat** fixed (MpiAgentChat.css).
- **Outpaint** failure carded as MPI-900 (not this card).

**2026-09-24, session 51097130:**
- The "5 conversations, no cases" run was the `--samples` branch (agent-test.mjs `main`), not a
  silent failure. Full `--runs 1`: 18/20. Both FAILs were the harness demanding a separate
  `open_project` after `create_project`, which opens what it makes since a2b243de. Fixed
  (`openedAt`). reasoning_effort broke nothing.
- **MPI-900's agent half, at Fabio's ask** (its checklist item; peer 84899fa3 told, message
  23d2130d). `frame.grow` (up/down/left/right) in `frameRectForRatio` + `validateBoxParams`;
  `_submitFlow` plans passes with `planOutpaintPasses` and chains them through flowService's
  `runNextPass` (`_nextPassFor`, MpiBaseFlow `_planPasses`'s twin). Tool description + list_models
  `frame.grow`. Built on `composeNextPass(result, prev, next)`, committed in 9c8c5841.
  MPI-900 moved to session c3d96049 (Outpaint Fix 3); told via message 795acf67 (to task MPI-900).

**Live read 2 (2026-09-24, DeepSeek-V4-Flash - Fabio's model):** 1, 4, 5, text-in-picture and
expand-up PASS (validation.md § 5). Check 3: view held, but the agent never knew a mask was painted
-> FIXED (`masked` on the workspace: agentService -> routes/agent.js -> App state line), NOT yet
live-checked. Outpaint is now one pass by MPI-900 e7228875 (no `maxGrow`); the agent path follows.
Check 5 decision (Fabio): a source with no prompt of its own (composite, IMPORTED image) is read
with the describer (`look`) and the prompt written from what it sees - already what the agent does.

Next: Fabio re-runs check 3 after a full restart (mask a corner, "put people in the chairs": the
agent must say it uses the mask and prompt only that crop). Then mpi-end-session: close MPI-891 +
MPI-886; ask about .claude/rules/ for `state.canvasMode` and the `masked` workspace field.

## Remaining Work

- Fabio's live check; then close-out.

## Plan Drift

- 2026-09-22: MPI-876 committed (`fcd50ffd`) before code started, so no wait on the three files.
- 2026-09-22: **no `view: 'moved'|'stayed'` answer to the model.** `/connector/generate` holds
  its reply for the whole render, so the loop has no early channel; a refused move is logged,
  and the result card in the chat is the click. Add a relay ack if the agent must SAY it stayed.
- 2026-09-22: **no desktop spec.** What unit tests cannot reach (navigate-then-mount, latents in
  the opened workspace) needs a real generation on the engine; Fabio's live check is that test.
  The decisions are covered in `tests/agent-view-follow.test.cjs` (mutation-proved).
- 2026-09-24: MPI-900's agent half folded in here (Fabio: "all we have to do is make sure our
  in-app agent can position the box"); its flow half stays MPI-900's.
- 2026-09-22: D4 got a media-type rule (a clip from a still is a new card) for cards that are not
  open; the open card keeps MPI-890's rule. Released `js/events.js` to MPI-899 (never needed).

## Verification

**Verify mode:** user-ux

Automated: the guard table tests, the D4 routing test, the desktop spec above, `npm test` 0 fail.
Then Fabio in his own app (a reload picks up the renderer edits): (1) in the gallery, ask the
agent to edit a card's image — the view opens that card's history and the latents draw there;
(2) in a card's history, ask for a Flow — the view goes to the gallery and he sees it run;
(3) with the mask tool active, ask for anything — the view does NOT move and the agent says
where it landed; (4) press the handed-back result card — it goes where D3 decided.

## Preservation Notes

- `docs/agent-chat.md`: a "Moving the view (MPI-891)" section — `follow`, the guard, D3/D4.
- New state key + canvas mode wiring → ask Fabio "Should I update `.claude/rules/`?" (state map).
- Not this card, carried for MPI-892: the Duration rule (`agentLoop.mjs:1354`, "you never speak
  first... reaches you only when the user writes again") is STALE since MPI-870 shipped wake
  turns. Fix it before MPI-892 builds on either belief.
