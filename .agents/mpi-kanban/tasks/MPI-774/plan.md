# MPI-774 - In-app agent, slice A

## Current State

**SESSION a018e069 (2026-09-19 evening, from handoff 3839bdd9). FABIO'S THIRD PASS. 74be51fd
RAN LIVE AND PASSED (outpaint to 9:16, chained into an H3 clip, his verdict 🎉), MPI-820's
clip check has his eyes on BOTH halves, and three new faults came out of the same hour: two
fixed, `list_cards` built on his go. 1462 unit tests, 0 fail, lint clean. NOTHING BUILT THIS
SESSION HAS RUN IN HIS APP: `routes/` + `services/` changed, so it needs a RESTART.
Evidence: `tasks/MPI-817/validation.md` § Session a018e069, `tasks/MPI-820/validation.md`.**

- **THE ROUTE DROPPED THE AGENT'S `duration`** (chat "about 6 seconds", card 3S).
  `POST /connector/generate` had it in `NAMED_PARAM_KEYS` and in none of the hand-written
  lines under them. `named` and the job `input` are now BUILT FROM the key list. Verified
  live after his restart: asked 6 → `Input_Duration: 6` → 141 frames → 5.875 s.
- **THE DURATION RULE WAS PUSHING LONG**, and the dropped key had been hiding it. Rewritten
  with his two anchors (reins + rear + shout = 3 s; add the gallop with a following camera
  = 6 s) and "until the answer is back, say I ASKED for N". Live: 6 s for the gallop, 2 s
  for a head turn, both his verdict "enough".
- **`fetch failed` = NODE `fetch`'S 300 s HEADERS LIMIT**, measured (fetch dies 304.9 s,
  `node:http` answers 310.0 s). A 337 s render came back "failed" with the file on disk and
  the agent RE-RAN it. `agentTools._post` is `node:http` now.
- **THAT FIX MADE `npm test` HIT HIS LIVE APP** and create a project called `__ARG__` (a
  `globalThis.fetch` stub stopped covering the POSTs; the table defaults to :3000). Test
  rebuilt on its own server; the table refuses the default port under `NODE_TEST_CONTEXT`.
  **The `__ARG__` project is his to delete.**
- **`list_cards`** (`services/agentCards.mjs`, `GET /connector/cards[/:groupId]`): the agent
  could not see the project it sat in ("I can't see the duck image", eighteen cards). Two
  hops, off `project.json` + sidecars, refs join the allowlist, a video included. A sidecar
  path outside the project's `Media/` gets no ref.

**THE SINGLE NEXT ACTION:** he restarts, then asks for something that points at an EXISTING
card without attaching it ("extend that last video", "redo the duck clip but…"). Pass = the
step log shows "Looking through the project" and it never says it cannot see the file. The
same restart proves `_post`: any clip over five minutes landing with no red line.

**Raised, not built** (all on `tasks/MPI-817/checklist.md`): a video cannot be ATTACHED to
the agent (the gate is in `MpiPromptBox.js`, held by MPI-736); the agent offered a 768x1024
video H3 cannot make (the ratio-snap message does not say the set is closed);
`llmEngines.mjs`'s Ollama 600 s budget is really 300 s; a refused generate still shows
"Starting generation"; loopback failures never reach `app.log`. Still owed by him from
before: the five Phase 7 steps, the deliberation leak, MODEL_PINNED, injectionParams, the
Prompt rule + showing the agent's real prompt.

**SESSION c6414b8c (2026-09-19, from handoff 78b588ba). FABIO'S SECOND APP PASS: THE AGENT
CANNOT OUTPAINT, AND COULD NOT CHAIN. The five Phase 7 steps and MPI-820's clip check are
STILL unverdicted — he reported new faults instead, again. 1430 unit tests (1429 pass, 1
live-skip), lint clean, `focus-mode.spec.js` 2/2 and `agent-chat.spec.js` 29/29 whole-file,
three mutation guards red-then-restored. Evidence: `tasks/MPI-817/validation.md`.**

- **THE OUTPAINT FRAME NEVER REACHED THE AGENT.** Outpaint's frame is `{ kind: 'crop' }`
  with **no `param`** — its value becomes a PADDED PICTURE, not a widget — so `_listModels`
  (which filtered `kind === 'box'`) never advertised it and `_submitFlow` had no crop branch
  at all. The agent ran the flow on the unpadded original, Krea 2 had no black to paint, and
  70 s of GPU reported success on a no-op. Now: `params: { frame: { ratio: "9:16" } }`, a
  RATIO not a rect, with `FRAME_REQUIRED` / `FRAME_UNCHANGED` refusals — the refusal is the
  more important half. Proven at the pixel on his own `i2i_001.png`: 896x1088 → 896x1593,
  black top and bottom bars, picture whole between them, no GPU.
- **A FLOW'S MEDIA ROLES WERE NEVER ADVERTISED.** `BAD_REQUEST "flowOutpaint" has no media
  role "inputImage". Roles: image1.` Model ops carry `media:`; flows carried none, so it
  reused a role it had been told about (`inputImage` is real, on `minimax-h3-ref2va`). One
  map through the `mediaRolesFor` that already takes a null model.
- **`wait: true` — THE AGENT CAN CHAIN NOW.** `{ started: true }` put the result in
  `_notes`, read at the START of the next turn, so "grow it to 9:16, then animate it" could
  not be finished and the model said so in the chat. Fabio's call. One `settle`, attached
  two ways, never both. A **Chaining rule** carries his shape: do both halves, and for a step
  the user will judge, wait, look, redo it rather than animating a bad picture — or ask, and
  say what happens next so a yes is the whole answer.
- **`A` toggles agent mode**, asked for in the same message. Bound in `agentPanel.js`, not on
  the PromptBox button (remounted per workspace); `allowWhileTyping: false` is the whole
  risk and the new desktop case asserts it by typing a prompt.
- **NOT FIXED, and not in scope:** the agent's deliberation reaching the chat verbatim. His
  shape to pick — a prompt rule, or a collapsed disclosure. Same argument as the two held
  agent-prompting items below.
- **Coming:** MPI-822 makes flows queueable. When it lands the agent should QUEUE the
  outpaint and the video back to back rather than waiting; `wait` is what makes the
  dependency expressible either way, and stays right for a step whose output gets judged.

---

**SESSION ea603cb9 (2026-09-19, from handoff 33659051). FABIO RAN HIS FIRST APP PASS. He
restarted, started the Phase 7 checklist, and reported four faults before finishing it — so
the five Phase 7 steps below still have NO verdict. All four are fixed and green: 1420 unit
tests, `lint:components` clean, `agent-chat.spec.js` + the new `focus-mode.spec.js` 30/30 on
whole-file runs. Evidence for all of it: `tasks/MPI-817/validation.md`, which is new.**

- **MPI-820 was only half wired**, found by reading before he tested. `duration` shipped
  through the route, the resolver and the injection, and the agent's own `generate` TOOL
  never declared or forwarded the key — `additionalProperties: false`, so the model could
  not legally emit it. The Duration rule told the agent to judge the length and gave it
  nowhere to put the answer. The new test asserts the CLASS (every `NAMED_PARAM_KEYS` entry
  declared and forwarded), proven red on `git show HEAD:`.
- **Focus mode left the agent panel behind.** Collapsed, not hidden: `:has()` matches a
  `display:none` element, so hiding it leaves a 420px gap. New `tests/desktop/focus-mode.spec.js`
  asserts the SIBLING'S MARGIN, which is the only thing that catches that mistake.
- **The cog moved left of the model button, and the caret now follows the cog.** Fabio asked
  for the swap twice; the root cause is `.mpi-popup::after` pinned to the popup's own centre
  while the clamp moves the popup. `--popup-arrow-x` on the primitive, defaulting to `50%`.
- **The agent writes negation into prompts, and both guides filed the rule under one op.**
  Diagnosed from two of his conversations (krea2 `t2i`, the holstered gun; H3 `i2v`, the
  orbit that rolled). Both guides now carry `### Say what is there, never what is not` with
  their measured case. H3's also ties the constraint line to it and defines `arc` vs `roll`.
- **The agent could not tell which model made an image.** He switched to Krea 2, and it
  called an `ill-anime` picture "the Krea 2 result" and then generated nothing. `modelId`
  now rides the result into the App state line, and the line says a bare ref is unknown.
- **Established for Phase D (skill packs, new on MPI-817):** the agent never touches the
  enhancer recipe — zero references — so the 2026-08-17 vendor-skill merges all landed in
  the one document the agent never reads.

---

**SESSION 35aabda4 (2026-09-19, from handoff 9ed687d7). THE PINNED SETTINGS PANEL IS BUILT
— every part of the design, plus both traps. 1398 unit tests pass, `lint:components` clean,
`tests/desktop/agent-chat.spec.js` 28/28 on a WHOLE-FILE run. It has NOT had Fabio's eyes:
Phase 7 is `user-ux`, so the panel is code-verified and not user-verified.**

1. **One boolean, `state.agentSettingsPinned`.** Written only by the PromptBox: `openPopup`
   sets it while `_agentMode`, `closePopup` clears it, `_applyAgentView` re-syncs it on a
   mode change, and `destroy()` clears it so a nav away with the cog open cannot leave the
   dispatch dropping params against a panel nobody can see.
2. **The cog and the model button are back in agent mode** — removed from the hide list,
   grid `1fr auto auto` -> five tracks. The popup drops its op strip through its OWN
   `.mpi-prompt-box__popup--agent` class: it is portaled to `document.body`, so the box's
   agent class can never reach it. Both the outside-click dismiss and the
   `ui:close-all-popups` pulse (which is what Escape arrives on) bail while `_agentMode` —
   the cog is the only way out.
3. **The gate is `resolveSettingsOwner`** (`js/shell/agentDispatch.js`, exported so it is
   testable without a DOM). Pinned: the user's model, the project's buckets, every named
   param dropped. Unpinned: the agent's model and params, and **`project: null`** — that
   null is the whole of the model-defaults half, not a detail.
4. **The trap the plan named was real and is now asserted.** `resolveEffectiveQualityTier`
   resolves an unset tier against the project's saved bucket first;
   `tests/agent-pinned-settings.test.cjs` builds a project contaminated with the expensive
   tier, asserts the OLD behaviour still returns it, then asserts the unpinned path returns
   the model default. Without that middle assertion the test would pass on a no-op.
5. **A mismatched `modelId` is REFUSED, not dropped — this is a deliberate deviation from
   the plan's wording, and it needs Fabio's word.** The plan said "drop the agent's
   modelId". Dropping it silently runs the user's model under the agent's narration
   ("making this with Krea2" while Klein ran) — the same class of lie as the
   `{ started: true }` this phase killed. `MODEL_PINNED` names the model to resend with, so
   the agent fixes it in-turn. The named params still drop silently, as settled.
6. **The agent is TOLD the pinned model** — `pinned` on `POST /agent/message`, through
   `agentSessions.send` (and onto a carried D5 turn) to `runTurn`, rendered by
   `AgentLoop._pinnedSettingsLine`, absent when the panel is shut so it costs nothing. It
   carries the model id, name, mediaType and its INSTALLED ops, so the agent can refuse in
   words — Fabio's own case: "that makes video, it doesn't make images".
7. **The cog's `[data-info]` swaps in agent mode** to "In agent mode, when you open this
   panel, you control the settings and the model, not the agent." `statusBar.js` reads
   `[data-info]` and observes the attribute, so the live swap re-renders. That IS the
   status-bar line; no second surface was invented.

**SHIPPED AS f124f535, and two more things landed with it.** (1) The SETTINGS POPUP opened
in the wrong place after a window resize and took a second click to settle - two faults,
both measured in a real window: `MpiPopup` transitioned `all`, so left/bottom slid over
200ms while every owner's post-layout viewport clamp measured it mid-slide and subtracted
an overflow belonging to the OLD position (the first reopen after a 1280->1100 resize
landed 128px too far left, overflowRight -188 against a correct -60); and nothing
repositioned an OPEN popup on resize (+120px off-screen), which pinning turned from
survivable into permanent. The primitive now transitions `opacity, transform` only - all
it ever animated - and MpiPromptBox listens for resize. Regression spec in
`tests/desktop/agent-chat.spec.js`.
(2) The NSFW FLAG shipped as `recommendedNote` on `RECOMMENDED_REMOTE_MODELS`:
Qwen3-VL-30B-A3B-Instruct, labelled "(recommended - less censorship)" - Fabio's own wording,
chosen over "did not refuse in our tests" - at the top beside DeepSeek V4 Flash, which
stays unflagged because nobody tested it that way. A test keeps the note COMPARATIVE: it
fails on uncensored/unrestricted/NSFW, because a promise about content is not ours to make
from one test on one model. It is also the cheaper of the two Qwen3-VL sizes ($0.15 in /
$0.60 out per 1M against the 235B's $0.20 / $0.88; the 235B only wins above ~60% cached
input, and at Fabio's own measured 70:1 input:output mix the 30B costs less).

**KNOWN GAP, not built, Fabio's call:** raw `injectionParams` is still merged over the
resolved params while pinned (`mergedInjection`). It is the documented escape hatch and the
agent rarely reaches for it, but it is a hole in "the user owns the settings". The plan
scoped the gate to `modelId` + named params, so it was left exactly there.

**The desktop spec's `textShare` has now gone red TWICE on a column change.** 0.8 with two
slots -> 0.797 once Stop's column stayed -> **0.6865 measured** with the model button and
the cog back; the bar is 0.65. The number was MEASURED by deliberately failing the
assertion to print it, never computed — and the whole file was run, not `-g`, because a
`-g` pass is what hid the second failure on 2026-09-18.

### THE PINNED SETTINGS PANEL — the design, BUILT 2026-09-19 (session 35aabda4)

*Kept verbatim below as the spec it was built from, including what Fabio REJECTED. What shipped and where it deviated is in Current State above.*

BUILT. `state.agentSettingsPinned` is in `js/state.js`; the gate is `resolveSettingsOwner` in
`js/shell/agentDispatch.js`; the surface is `MpiPromptBox`. Tests: `tests/agent-pinned-settings.test.cjs`
(the gate), `tests/agent-ui-surfaces.test.cjs` (the surface), `tests/desktop/agent-chat.spec.js`
(the pin, in a real window). Doc: `docs/agent-chat.md` § The pinned settings panel.

**The design, in his words: one boolean.**

| | Cog closed — agent drives | Cog open — the USER drives |
|---|---|---|
| prompt, media in/out, op, card name | agent | **agent, still — all of it** |
| model | agent picks by task + rank | **the user** |
| ratio / quality / turbo / style / stylization / LoRA | agent, **from model defaults** | **the user** |

- The cog and the model button already exist and are merely hidden in agent mode —
  `MpiPromptBox.css:131` hides `__col--cog` and `__col--settings` (the model button, mounted at
  `#settings-badge-slot`, MpiPromptBox.js:1648). Un-hiding those two is most of the UI.
- **Open means PINNED:** in agent mode the popup must survive the outside-click dismiss and
  Escape, and close only on the cog. That dismiss is `onPopupOutsideClick` (MpiPromptBox.js:1716).
- **No op strip in that popup in agent mode.** Fabio, explicitly: "if the user wants to go and
  change operations, then he just needs to close the agent mode. That's too much already." The
  popup header carries an op strip today — it has to go in this mode.
- Status-bar line AND the cog's own `info` tooltip: *"In agent mode, when you open this panel,
  you control the settings and the model, not the agent."* The tooltip matters — it is the only
  copy readable BEFORE the click.

**Two things the design needs that are not obvious, both verified in code this session:**

1. **The agent must still be TOLD the model while pinned.** It writes the prompt, and the Guide
   rule makes it read THAT model's guide and adapt to its structure and vocabulary — so a pinned
   Qwen with a Krea2-shaped prompt is a worse image than either party intended. One line in the
   App state line, only when pinned: the model, the op it resolved, and the settings. It does not
   get control back, it gets told what it is writing for. Fabio's own use for it: *"If the user
   asks for a video and there is only an image model selected, the agent can tell the user, look,
   that makes video, it doesn't make images, you need to select another model."* So the agent
   still resolves task -> op, and REFUSES with an explanation when the pinned model cannot do it.
   It never switches the model itself.

2. **"Agent uses defaults" is NOT what happens today, and this is the trap that would sink it
   quietly.** `resolveEffectiveQualityTier` (`js/data/generationControls.js:113`) resolves an
   unset param against the PROJECT'S SAVED BUCKET first, and the model's cheapest tier only when
   nothing was ever saved. So in cog-closed mode a project where 2k was once chosen keeps feeding
   2k to every agent generation forever — the same stale contamination the design exists to kill,
   arriving through the project record instead of the visible panel. **The agent-driven path must
   resolve against MODEL DEFAULTS, not the project bucket.** Without this the boolean looks right
   and behaves wrong.

**Enforcement is CODE, not the prompt** (`js/shell/agentDispatch.js`, `_submitGeneration`, which
already destructures `modelId, ratio, qualityTier, turbo, styleSelect, stylization`): while
pinned, drop the agent's `modelId` and every named param before `resolveNamedParams`. A prompt
rule can be ignored; a dropped field cannot. That is the whole gate.

**Rejected, and why — do not rebuild it.** This session first shipped a Settings rule saying
"every setting the user did not ask for is THEIRS, leave it out and the box wins". Fabio rejected
it: a beginner never opens the panel, so whatever is sitting there from a previous session
silently contaminates every generation, and neither they nor the agent knows. "The panel wins" is
only safe when somebody is TENDING the panel. It was also a prompt rule, and prompt rules lose.
The rule in the tree now is the surviving half: start at defaults, raise only when the user's own
words ask.

**MASTER WAS RED ON THIS CARD, and clearing it took TWO commits (2026-09-18, session 130cab18).** `tests/desktop/agent-chat.spec.js:654` still asserted the agent-mode face was
`['textarea-slot', 'mode-toggle-slot']` — the shape fix 6 deliberately changed when it kept
the run column so Stop stays reachable. The spec now expects `bottom-right-slot` and asserts
what fix 6 actually promises: of the run column's three children only the stop host is
displayed. 121 other desktop specs were already green; this was the only failure. Verified
locally, pushed with `--no-verify` (the gate's own documented case — you ARE the fix).

**That first fix was NOT sufficient, and was reported as done before CI came back.** The very
next assertion, `:658`, failed on the identical cause: Stop's column costs the text field
~46px, so `textShare` measured **0.7972** against a `> 0.8` written when agent mode had two
slots. Threshold moved to 0.75 in `c22dcbf3` — the assertion means "the field dominates the
face", not the old arithmetic. **The lesson, and it is the reason master stayed red an extra
hour: verify a spec fix by running the WHOLE spec file.** The `-g` run passed 3/3 with the
next assertion still broken. A `shellWindow` `waitForFunction` timeout in a full-file run is a
known local flake — it passed on re-run. **CONFIRM CI ON `edc27a15` before trusting green.**

**Fix 8 has a real lead, and it unloads NOTHING (Fabio refused unloading outright: it slows
every next generation).** `comfy_aimdo/host_buffer.py:74` exposes `cleanup_file_reader()` ->
`lib.hostbuf_file_reader_cleanup()`, a teardown of the FILE READER state alone, no models and
no host buffers touched. Grepped the whole engine: **it is defined and never called** — not by
ComfyUI core, not by anything. So an interrupted stream leaves the reader dirty with no
cleanup path, which is exactly the shape of the bug. Next session's job is to confirm that and
find where to call it from.

**Also settled with Fabio: 'only when the run was streaming' is NOT a narrow condition.** H3 is
'prepared for dynamic VRAM loading' — its weights are read from file on demand — so watching
the latents and pressing Stop IS mid-stream. He does that often. Any fix has to hold for the
common case, not an edge one.

**Fabio's round 2 came back (2026-09-18, session 130cab18; `validation.md` § Fabio's round 2).**
Cream: YES, and provably the mascot's own token. Spinner and the gallery panel: fine, his word.
Two UI notes BUILT and verified live — attachment chips now sit in their own row under the
text instead of wrapping into the sentence, and the landing composer is one line level with
Send (field 38.9 = button 38.9, still grows as you type). The project page needed nothing.
`tests/agent-ui-surfaces.test.cjs` 7/7, `lint:components` clean.

**HIS ROUND 2 FOUND A REAL DEFECT, and it belongs to fix 6 — see § Phase 5 fix 8 below.**
Stopping a generation of a model that streams its weights leaves the engine's reader broken,
and the next run that reuses that still-cached model dies on its first weight read. His log
shows the pairing at 39 seconds. Not built: where the fix goes is a design call plus an
upstream question.

**Fixes 3, 4, 6 and 7 are now proven in a LIVE app, not in the source (2026-09-18, session
130cab18; `validation.md` § Fixes 3, 4, 6, 7 proven in a live app).** A real `<video>` at
readyState 4 and the "Did not finish" tile on both element types; `--accent-heat` computing
to `--hub-accent` inside both agent subtrees; the Language Models spinner with every subgroup
hidden; and Stop armed at t=2s by an AGENT-started generation, clicked, the lane drained and
the submit answered `CANCELLED`. Two environment facts came out of it, both in
`~/.claude/memory/tools/mpi-kanban.md`: `gpu_lease.py run` exits 0 on an npm `.cmd` shim it
cannot find, and **the local engine is SHARED on 48188** — a Stop test fires a global
interrupt that can kill the user's own generation.

**What is left of Phase 5 is only what needs Fabio's eyes:** the cream and the spinner as
LOOKS, the panel resize feel, and one end-to-end pass in his own app.

**The two 2/3 cases are settled (2026-09-18, session 130cab18): TRANSIENT.** Full suite re-run
on the same tree with every run's output kept — **18/18 cases 3/3**, $0.1473, no `FAIL` line.
The runner folds an `ENDPOINT_ERROR` into a case's failures, so a provider hiccup and a blown
assertion read identically in the summary; capture the output, never grep the summary alone.
Evidence: `validation.md` § The two 2/3 cases, settled. **Phase 5 now waits only on Fabio's
round 2 in his own app** (checklist at the end of `validation.md`, after a FULL restart), then
the Phase 6 and Phase 7 DESIGN passes with him.

**Project mode:** scalable-foundation. **Spec:** `brief.md` (every product decision is Fabio's,
2026-09-15). **Parent:** MPI-677 (umbrella, `doing`, only Fabio's user-ux passes left).
**Evidence behind this plan:** `research/investigation.md` - verified facts with file:line, the
seven investigator claims that turned out wrong, and a live orchestrator probe.

**Phase 5 fixes 2-7 are BUILT (2026-09-18, session 627f63f6; evidence `validation.md` § Phase 5
fixes 2-7).** The box share guard (route reports `boxShare`/`squareShare`, the Box rule refuses over
0.6 — a measured threshold, the first draft at 0.5 failed on a real close portrait), the Memory rule
saving without the cue, the Studio cream rebind, the Language Models loading state, and the two
Fabio found on his second look: Stop reachable in Agent mode, and a video result that is a `<video>`
with a "Did not finish" fallback. Unit 18/18 + 5/5 new, lint clean, two new harness cases pass and
bite. **Fix 1 is built too**: `modelConstants/modelPriority.js` (Fabio's order, one image order
filtered by `supportedOps`, per-model edit/video lists), `rank` + `note` on every op in
`GET /connector/models`, a Model rule that reads rank AND `fit.runs`, `tests/model-priority.test.cjs`
5/5, the `ranked-editor` harness case, and an add-model playbook step. `npm test` 1342/1343, 0 fail
(1 skipped). **Uncommitted:** everything this session.

**Two rule edits came out of the harness, both real:** the Box rule now measures again ONCE then
stops (it was re-cropping 12 times a turn), and the Model rule now names the TASK first — asked to
redo an edit with Krea 2 the model ran `krea2 i2i` and cited "its best realism op, rank 1", crossing
a task boundary to reach a 1. Suite state and the two cases that came back 2/3 on the last full run
(3/3 alone, detail not captured): `validation.md` § Suite state at handoff.

**Next session** (Fabio, 2026-09-18): **§ Phase 6 global memory**, and **§ Phase 7** — his doubt
about the agent driving Flows at all ("a lot of issues ... because of the gizmos"): let it have a go
and ALWAYS hand the Flow back to the user with the media already staged, plus the open question of
whether per-model/per-task knowledge belongs in a `skill:` corpus entry rather than the system
prompt. Both are DESIGN passes with him, not build-from-the-plan.

**Phase 5 round 1 was recorded 2026-09-18 (session fa18265c).** Fabio drove the agent in his own app
and pasted the transcript; five fixes were folded in under Phase 5, and two more (6, 7) came from his
second look at the same screenshot. His memory test across a restart PASSED.

**Phase 4 DONE (2026-09-17 ~15:10Z, session fa18265c; evidence `validation.md` § Phase 4 close).**
Compaction live on Qwen2.5-72B (32k): handoff with the five fields, the SSE pair, the goal recalled
after its turn was dropped. Live defect fixed: the restart kept 4 turns whatever their size, so every
later turn compacted again; it now keeps the newest turns that fit in half the trigger (unit test +
bite; live re-run: plain turns at ~4.5k, no re-compaction). Honest limits live: "watch this video"
(no tool, says it), and a REAL Remote refusal (Llama-4-Scout, "Identify this person by name.") ->
says it refused and names the setting. **Next: Phase 5**, Fabio's pass, checklist at the end of
`validation.md` (he must fully restart his app first). **Uncommitted:** `services/agentLoop.mjs`,
`tests/agent-loop.test.cjs`, `docs/agent-chat.md`, this card's files. **Close-out still owes:** the
agent release note in `docs/releases/UNRELEASED.md`; root `events.jsonl` lines for Phases 3c/3d/4 (the
root file is under live MPI-532 / MPI-800 claims today); Fabio deletes `K:/mpi774-install-sandbox`
(29 GiB), the "MPI-774 agent test" project and the scratch profiles. My boot put MpiNodes `cff4c3b3`
into the shared engine early (MPI-800's pin; message `b800d1f7`).

**Handed off (2026-09-17 ~14:15Z, session 047d6088, committed at handoff a49e6ac9):** Fabio passed
the Studio-head toggle (Phase 3d closed but item 5, deferred) and KEEPS the Klein encoder borrow on
ComfyUI enhance. Phase 4 left: compaction live, honest limits live, final harness 3x + bite, then
Phase 5. Details below.

**Earlier (2026-09-17 12:25Z, session 047d6088):** item 6's second pass is BUILT
(Studio robot head, `assets/mascot/studio/logo.webp`, as tall as the Enhance button; `validation.md` §
"item 6, second pass"). **Phase 4 is running** on my own
`app:isolated` (port changes per restart; profile in the session scratchpad; a server-side edit needs
a restart of MY instance, kill the listener's PARENT): person images done, box measurement + parser
done, two live defects fixed (ComfyUI describe question never carried the image; an empty text-op
answer hung every caller). Head Swap: first try guessed boxes -> box gate + Box rule + `square` +
labelled flow fields; second try measured and swapped cleanly. Edit with a reference: first try used
an earlier turn's "picture 1" -> numbered attachment lines + Numbering rule; second try right. Enhance
VRAM DONE (nothing resident between prompts; the Klein encoder borrow and `Replace Text.replace` never
reached the graph -> `canonicalizeInjectionKeys` keeps dotted bare keys, fixed live). H3 t2v right
(medium + turbo); H3 i2v framed a portrait start frame at 16:9 -> attachment/result sizes + a ratio
sentence; the i2v rerun kept the head (9:16). Install DONE on a seeded K: sandbox (engine AND models
root; `CUBRIC_MODELS_ROOT` alone does NOT sandbox, the engine's `model_roots.json` wins): the Yes call
no longer holds the whole download, the re-read reads `installed`, the result says "the user pressed
Yes ... downloading". Harness after the rule edits: 15/15 bites, 3x 14/15 (`memory-read` flake, 6/6
alone). **Left in Phase 4:** compaction live (`model: Qwen/Qwen2.5-72B-Instruct`, 32k window, tools OK
but ~87 s a call; run it on my instance, `drive.mjs` in the scratchpad), honest limits live ("watch
this video"; a real Remote refusal if one comes cleanly, else the harness fake), then a final full
harness 3x + `--bite` (the prompt moved again: install result text, ratio sentence), `npm test`,
lint, the agent-chat desktop spec (private `--output`). **Uncommitted:** everything this session.
Leave for Fabio: `K:/mpi774-install-sandbox/` (29 GiB), the scratch profiles, the "MPI-774 agent
test" project.

**Where it stood (2026-09-17 ~13:00Z, session d56a1cbe, committed at handoff):** Phase 3c CLOSED;
Phase 3d items 1-4, 6, 7 built, bitten and **passed by Fabio in his app** (agent box, numbered chips,
full-height resizable panel; an agent edit's card now has the right shape). Item 5 waits for the
mascot animations. **Next, in order:** (1) **item 6 has the WRONG HEAD and is TOO SMALL** (Fabio): the
toggle must show `C:\AI\Mpi\Cubric Studio Brand Assets\Studio-Logo.png` (the robot face, 2000x2000, not
in the repo yet), not the Vision camera (`assets/mascot/logo.png`). Add a small web-sized copy under
`assets/mascot/` (a ~128px webp), point the toggle's `image` at it, and make it about the size of the
Enhance button beside it (today the image takes the `sm` 16px icon size). Update the src in
`tests/desktop/agent-chat.spec.js`, `docs/agent-chat.md` and `.claude/rules/component-mounts.md`. A
reload shows it. (2) Phase 4 (GPU, option A, lease), which now also carries MPI-677 step 1d (ComfyUI
enhance VRAM, message `f82e6bea`). Fabio: keep MPI-797 on the board; "yes to maps" (done); no gallery
entry for `MpiResizeHandle`.

**Before that (2026-09-17 09:48Z, session 6fd51047, handoff 89c36b80):** Phase 3b is DONE (Fabio's "1"
after the padding fix `3dd0301a`). **Phase 3c is BUILT, committed at this handoff** (D4-D6 as
recommended; evidence `validation.md` § Phase 3c): per-project conversations
(`services/agentSessions.mjs`), the landing agent's `list_projects` / `create_project`, `open_project`
allowlisted. Unit 15/15 + 13 bites, desktop 24/24 + 6 bites, `npm test` 1264/0, harness bite 15/15,
harness 3x **14/15**. **Next, in order:** (1) `new-project-brief` is 2/3: after the brief note the
agent generated a first shot unasked; tighten the Project rule's goal branch ("then ask what to make
first; generate only when asked") and rerun that case `--runs 3`, plus the full 3x if the rule text
moves. (2) Fabio's landing-page check (a FULL app restart: the change is server-side). (3) Ask Fabio
before updating `.claude/rules/` component maps (new `agent:session` event, `session` on every
`agent:*` payload, `MpiAgentChat` now listens to `project:changed`). (4) Phase 4 with **option A**
(details under Phase 4). **Before booting any app for Phase 4**, run `git status -- routes/ server.js
services/ main/`: an app instance loads peers' uncommitted server code against the REAL engine and
model roots. MPI-656 Phase 1 is committed (`620627d3`); on 2026-09-17 MPI-532 had an uncommitted
`routes/downloadManager.js` edit that only ADDS GC protection (installed Flow packages), judged safe.
Ask Fabio before touching `.claude/rules/` for the new `agent:session` event. The older note below is
kept for its detail.

**Earlier (2026-09-16, session 105b3570, handed off):** Phase 3b is BUILT, VERIFIED and
COMMITTED (evidence: `validation.md` § Phase 3b): items 1, 2, 4, 5 done; **item 3 (panel below the
topbar, 420px) waits only on Fabio's eyes** (reload his app, toggle Agent mode, look at the panel
under the "<- PROJECTS" row). Harness 13/13 x3, every flip bites; H3 samples 150/190 words with shot
structure and sound. **Next:** get Fabio's item-3 verdict (and let him read
`research/prompt-samples.md`), then Phase 4 (live on the GPU, lease). Server-side changes need an
app RESTART in Fabio's app, not a reload. Fabio's user-ux pass (Phase 5) must also cover the gallery
panel, the toggle position, the landing box, Settings > Remote > Language Models, and the new
"Noted:" line / `<project>/Agent/` notes.

**Harness design (settled, e0fe3905):** `scripts/agent-test.mjs` drives `AgentLoop` with the REAL
`DeepInfraEngine` and fake tools built from `tests/fixtures/agent/` (the real `/connector/models` and
`/connector/knowledge` payloads captured from an isolated instance). Assertions read the model's own
calls from `loop.getHistory()` (`kind: 'tool'` / `'confirm'` entries), never the fakes' internal
calls (the install card reads list_models itself). A `--bite` pass runs each case once with its flip
and expects FAIL. Cost = summed `usage` x the model's live DeepInfra price.

**Previous session (7ab56409):** Phase 0 and Parallel Batch 1 are done, verified
and **pushed** (`4cfc489e`; master CI green on `2d4c28d6`, which carries it). The three carried
integration items and the landing rearrange are **done and verified** (evidence in `validation.md`
§ Phase 3), and so is **the wiring run** — which found and fixed two real defects (an Electron-only
`NO_KEY`, and the agent inventing project folder paths) and re-probed the `/connector/*` routes.
**Next: the scripted harness** (`scripts/agent-test.mjs`, the nine brief cases 3× against fake
tools), then the prompt-quality sample. Nothing is committed yet this session. GPU stays off-limits
until Phase 4.

**The three integration items, as built (2026-09-16):**
1. **Trust boundary.** The loop keeps `_images`: attachment ids staged this session, and the output
   paths of its own generations. `look`/`generate` resolve only through it; anything else the model
   emits is `IMAGE_NOT_FOUND`. `agentTools.resolveImageRef` is gone.
2. **Attachments are placed**, only when a generate uses one, through `placeAsset` ->
   `POST /project-media/agent/place-preview-asset?folderPath=` (its `dataUrl` takes a plain absolute
   path), and the returned url becomes `media[].url`. A result goes back as `/project-file?path=`.
3. **The bounds branch is dropped**, not rebuilt: it read `pixelDimensions` that `resolveAgentMedia`
   never sets, and all three shipped box steps declare `overflow: 'allow'`. The ceiling and the
   upgrade path are a `ponytail:` comment on `validateBoxParams` and an assertion in its test.

**Batch 1 running notes (orchestrator re-verified each report on disk, never took one on trust):**
- **W3 done.** 8/8 + llm-service 18/18. Its in-test "mutation" was a simulation, so the binding check
  was broken in the REAL handler: red, then byte-identical restore green. **Defect fixed:** its writes
  turned `main/secretsStore.js` + `js/core/secretsClient.js` CRLF (HEAD is LF; `git diff --stat`
  hides it) - reverted to LF. Claim `complete`.
- **W2 done.** agent-loop 13/13 (+1 live test skipped without key; worker's live run: `list_models`
  called, 1,351 prompt tokens, 7.1 s). llmEngines consumers 13/13. Gate removed in the REAL loop ->
  2 red; restored -> green. Line endings clean. Claim `needs_integration` for two items W2 reported
  as "no deviation" but are:
  1. **Trust boundary:** `agentTools.resolveImageRef` treats any non-`att_` string the MODEL emits
     as an absolute path, so `look`/`generate` can be pointed at any file on disk (a key file) and
     ship it to the engine, which may be a remote Pod. Restrict to this session's attachments and
     result `filePath`s.
  2. **Contract:** attachments go to `generate` as a raw staged path in `media[].url`, not copied
     into the project via `place-preview-asset` (contract § Tools). Fix against W1's media shape.
  Also for the UX pass: an unanswered install card keeps the turn `working` (BUSY) until Yes/No or
  `/agent/reset`.
- **W1 done.** connector tools 14/14, eslint clean (one unused `eslint-disable` removed). CRLF churn
  on `routes/connector.js` + `scripts/build-portable.mjs` reverted to LF. Real mutations in
  `validateBoxParams`: UNKNOWN_PARAM, integers, square -> red; **bounds stayed GREEN** - its test
  only asserted the in-bounds case (name lied). Test now asserts the rejection + the `overflow:
  'allow'` pass; mutation re-run pending. **Phase 3 item:** `resolveAgentMedia` items carry no
  `pixelDimensions`, so the bounds check never runs on a real submit (no shipped flow needs it yet:
  both Head Swap steps allow overflow) - read dims where the path is known, or drop the branch.
  **Manifest:** W1 was right, and the release doc was wrong: MPI-677 step 2 (`3b8052d6`) removed the
  broker responder, so `system.memory.release` is unserved; `docs/releases/portable-distribution-contract.md`
  § Connector Manifest still described the responder - orchestrator fixes it.
- **W4 done.** lint:components clean. CRLF churn on `MpiPromptBox.js/.css` reverted. Raw
  `es.addEventListener` in `agentService.js` -> `on()` (dom.js takes any EventTarget). **Ownership
  breach:** W4 wrote the landing slot `<div>` into `index.html` (not owned; no live claim held it) -
  accepted as integrator, claimed. W4 did NOT run its desktop spec (it wrongly thought the runner
  would touch `:3000`); the orchestrator runs it with a private `--output`.

**Card tags:** RunPod **no** (slice A never touches a Pod). Linux box **no**. GPU **yes**, Phase 4
only (live generations and looks; `/connector/generate` is a `guard-gpu` pattern, so take the
lease).

### Decisions (settled - Fabio accepted all three as recommended, 2026-09-15)

Fabio, 2026-09-15: *"We are on the same page. I accept all your recommendations for D1, D2, and
D3."*

- **D1. `look` ships on the ComfyUI describer inside this card; it does not wait for MPI-737.**
  MPI-737 later adds the cloud backend behind the same route. Cost of the default: the agent has
  no eyes until the Image Describer plugin is installed, and it says so. It also needs one edit
  from Fabio in `comfy_workflows/raw/image_descriptor.json` (Phase 0), because the caption
  instruction (node 38) cannot be injected today.
- **D2. The install gate is a Yes / No card in the chat**, not a typed "yes" the model
  interprets. The loop never executes an install without the button. This makes "installs always
  ask" structural and testable, and avoids Calliope's regex-permission trap.
- **D3. Replies arrive whole per model turn, not typed out token by token.** Events stream
  (working, tool started, result, compacting); text does not. Measured turn time is 1.5-3.1 s.
  Token streaming gets added only if the UX pass says it feels slow.

### Settled here (resolve-then-act, not Fabio's forks)

- **Every agent tool is an HTTP route on the connector.** The loop's tool executor is a fetch
  table over loopback. The brief says the tools ARE the connector contract; this makes it literal,
  gives CLI agents (MPI-593) the same surface for free, and creates no second dispatch path
  (`connector.js:34-46` warns against mixing).
- **Non-blocking generate:** the loop does not await the generate call inside the turn. When it
  settles, the loop posts the result into the chat and runs `look` on an image result. No
  job-status route. Known ceiling: `JOB_TIMEOUT_MS` is 30 min, so a longer job reports `TIMEOUT`
  while it keeps running, and the agent says exactly that. Upgrade path: a job-status route.
- **Compaction trigger** = the provider's own `usage.prompt_tokens` from the last response
  against the profile's context window: 50%, or 30% when the window is 1M or more. No tokenizer.
- **Endpoint keys are bound to the base URL they were saved with.** The server takes base URL and
  key together from the secrets store by profile id; the renderer never supplies a URL that
  receives a key.
- **The chat session lives in server memory** (brief item 14). The renderer re-renders from
  `GET /agent/history` on mount, so Landing -> Gallery -> History keeps the conversation. Nothing
  on disk.
- **Auto defaults per model, never invented:** image -> `turbo: true` where the model offers it;
  video -> `qualityTier: 'medium'` plus turbo where offered. A param the model lacks is omitted
  (the connector already validates per model).
- **`connector-manifest.json` becomes truthful:** it lists what the connector serves, and
  `assertConnectorManifest` asserts `generation.submit` instead of the unserved
  `system.memory.release`. Only three files consume it (grepped).
- **Hardware fit** reads the active engine's capacity: `GET /system/gpu-info` locally, the Pod
  capacity handler (`remotePodLifecycle.js`) when remote is active, fed to `footprint.js`
  `tradeTable()` for the "not at your VRAM, yes with 44 GB of RAM" line.
- **Orchestrator stays `deepseek-ai/DeepSeek-V4-Flash-0731`.** The probe passed the smell test for
  criteria 1-2 (right tool, `reasoning_tokens: 0`, Auto settings with zero questions). The 3/3
  harness (Phase 3) is the real gate.

### What exists vs what is missing (detail in `research/investigation.md`)

| Tool | Exists | Missing |
|---|---|---|
| open project | `POST /connector/open-project` | nothing |
| generate, model op | `POST /connector/generate`, named params, media by reference | only the non-blocking use above |
| generate, Flow | same route with `flowId`, fields, media | box params: a step `param` is never read from input |
| look | `imageDescribe` universal text op; `agentDispatch` already reports `onText` | a no-model branch (`_submitGeneration` refuses without `modelId`), an injectable question, crop, box parse |
| list models | renderer install state, `footprint.js`, `/system/gpu-info` | a route; the install-state payload builder is renderer-only |
| read knowledge | `listCorpus()` | a route |
| install model | download start / status / models check | size before install, the ask gate |
| the loop | `DeepInfraEngine` (text only), fork-bridge key | tools + usage passthrough, sessions, compaction, SSE, profiles |
| the chat | `MpiPromptBox`, `MpiLlmSettings` Agent-row slot, mascot images, markdown util | toggle, transcript, confirm card, landing entry, agent row |

### Collisions (checked 2026-09-15; re-check before Batch 1)

- **MPI-677 (`doing`)** lists in `files.json`: `services/llmEngines.mjs`, `routes/llm.js`,
  `js/services/llmService.js`, `js/core/secretsClient.js`, `main/secretsStore.js`, `server.js`,
  `js/components/Organisms/MpiPromptBox/**`. No live claims; only user-ux passes remain. If it is
  still in `doing` at Batch 1, send one `mpi-message` naming these paths, then edit by content
  anchor (a UX-pass fix may land in the same file).
- **MPI-591 / MPI-623 (`doing`)** own `commandExecutor.js`, `generationService.js`,
  `flowsRegistry.js`, `universal_workflows.js`. **This plan edits none of them.** A worker that
  finds it must: stop and `mpi-message`.
- **MPI-766 (`todo`, blocked)** rebuilds the landing page. Slice A mounts its landing entry as one
  component in one slot, so MPI-766 moves a mount rather than a feature.
- **MPI-737 (`todo`)** owns the cloud describer and the Descriptions dropdown. This card builds
  the `look` route and its three growths (question, crop, box) against ComfyUI.

## Completed

- [x] Investigation and plan (2026-09-15): four read-only investigations, planning-session spot
  checks, a live DeepInfra probe. `research/investigation.md`.
- [x] D1-D3 settled by Fabio (2026-09-15), all as recommended.

## Remaining Work

## Phase 0: Decisions, contract, the describer question

*Verify mode: auto, except the D1-D3 answers.*

- [x] **Get D1-D3 from Fabio.** Record his words under § Decisions; revise the plan where he
  overrides. **Verify:** § Decisions carries his answer for each, dated. *Done 2026-09-15: all
  three accepted as recommended, no revision.*
- [x] **Write the contract, `docs/agent-chat.md`** (new subsystem doc, routed from
  `docs/README.md`, 200 lines max). It holds: the JSON schema of every tool; each new route's
  request/response and error codes (`/connector/models`, `/connector/knowledge[/:id]`,
  `/connector/install`, `/connector/describe`, Flow `params`, and `/agent/message`,
  `/agent/stream`, `/agent/history`, `/agent/confirm`, `/agent/reset`, `/agent/probe`); the SSE
  event vocabulary (`agent:working`, `agent:message`, `agent:tool`, `agent:confirm`,
  `agent:result`, `agent:compacting`, `agent:error`); the fork-bridge message for profile keys;
  `look`'s answer `{text, box?}` with the box in ORIGINAL image pixels; where images attached in
  chat are staged (an agent scratch dir; copied into the project only when a generate uses them).
  **Verify:** a table in the doc maps brief items 1-15 to a route, an event or a UI element with
  no gaps; every tool in brief § Architecture has a schema; `docs/README.md` routes to it.
- [x] **The describer question (D1).** Deliver the raw node list (file, node id, widget index) so
  a question can be injected while the right-click caption keeps its current instruction. Fabio
  edits `comfy_workflows/raw/image_descriptor.json`; the agent runs
  `node scripts/sync-raw-workflows.mjs`. Do not hand-edit workflow JSON. **Verify:** the synced
  runtime file has an `Input_*`-titled node feeding the prompt; `node --test
  tests/inject-params-titles.test.cjs` green; with no question injected the graph text is
  unchanged from today's instruction (diff the two).

## Parallel Batch 1: four foundations

Run with `mpi-execute-parallel`, only after Phase 0. Each worker builds against
`docs/agent-chat.md`, tests with fakes or stubs, and edits nothing outside its Ownership. Every
worker brief carries the CLAUDE.md Critical Rules Snapshot and `.claude/rules/root-cause.md`
§ Sub-Agent Briefing. *Verify mode: auto.*

**Why it is batch-safe:** ownership is disjoint; W1<->W2 meet only at the HTTP contract (W2 tests
with fake tools), W2<->W3 at the fork-bridge message and `/agent/probe` (W3 stubs fetch), W2<->W4
at the SSE contract (W4 stubs `fetch`/`EventSource`). `server.js` is touched by W2 alone, one
mount line.

- [x] **W1 - connector growth.** Ownership: `routes/connector.js`, `js/shell/agentDispatch.js`,
  `resources/cubric/connector-manifest.json`, `scripts/build-portable.mjs`
  (`assertConnectorManifest` only), `tests/connector-agent-tools.test.cjs` (new),
  `.claude/skills/cubric-vision/generating.md`. Briefings: `comfy_injection`, `comfy_engine`,
  `events`. Work:
  - `GET /connector/models`: a new relay capability returns install state per effective engine
    and each model's ops from the renderer; the route adds hardware fit (`tradeTable`) and the
    download size of missing deps.
  - `GET /connector/knowledge` (index) and `GET /connector/knowledge/:id` (the entry's `text()`).
  - `POST /connector/install {modelId}`: starts the download of missing deps, returns size and
    started state. No gate here: the gate belongs to the in-app loop; a CLI agent's user is its own.
  - `POST /connector/describe {image, question?, crop?}`: crop with `sharp` to a staged file when
    asked, then relay `imageDescribe` with the question in `injectionParams`; returns `{text}`.
    `agentDispatch` gets the no-model branch for universal text ops and a named
    `DESCRIBER_MISSING` error when the plugin is absent.
  - A pure mapping function: a point or box in the describer's input space (after crop and the
    graph's 1 MP scale) -> original pixels. **The box PARSER waits for Phase 4's measurement;**
    no format is guessed here.
  - Flow submit `params`, e.g. `{box1: {x, y, width, height}}`: validated against the flow's
    `kind: 'box'` steps (known param name, integers, inside the image, square when the step
    locks ratio 1), merged into `injectionParams`. `flowsRegistry.js` is read, not edited.
  - The manifest lists what is served; the assert checks `generation.submit`.
  - `generating.md` documents the new routes (keep each skill file within its 200-line budget).
  **Verify:** `node --test tests/connector-agent-tools.test.cjs` green, and one mutation per
  validator turns it red; the mapping function round-trips a crop + 1 MP scale case; `npm run
  lint`; an isolated `npm run server` on its own port answers every new route with its own
  `BAD_REQUEST` on an empty body (never `:3000`).

- [x] **W2 - the loop.** Ownership: `services/llmEngines.mjs` (`DeepInfraEngine.chat` only),
  `services/agentLoop.mjs` (new), `services/agentTools.mjs` (new), `routes/agent.js` (new),
  `server.js` (one mount line), `tests/agent-loop.test.cjs` (new). Briefings: `root-cause`
  (Snapshot only otherwise). Work:
  - `DeepInfraEngine.chat` forwards `tools` and returns `toolCalls` and `usage` beside `text`;
    every existing enhance caller is unchanged.
  - Session in memory; system prompt = role, mode rules (Auto / Ask first), the honest-limits list
    (brief item 13, in character), the knowledge index. A bounded step count per user turn.
  - Install tool calls never execute: they emit `agent:confirm` with the size, and
    `POST /agent/confirm {id, yes}` executes, then verifies with a real re-read of
    `/connector/models`.
  - Generate is fired without awaiting; on settle it emits `agent:result`, appends the tool result,
    and runs `look` on an image. It never regenerates on its own judgement.
  - Compaction at the trigger: the model writes a handoff (goal, decisions, cards generated,
    current model and settings, open question); the session restarts from system prompt +
    handoff + the last few turns; `agent:compacting` is emitted.
  - `POST /agent/probe {profileId}`: one tiny call carrying a tool; a model that cannot use tools
    is reported plainly. Never strip a capability and retry.
  - `agentTools.mjs` is a fetch table over loopback to W1's routes, per the contract.
  **Verify:** `node --test tests/agent-loop.test.cjs` with a fake engine and fake tools proves:
  install never runs without a confirm (remove the gate -> red); compaction fires at 50% and at
  30% for 1M windows from `usage`; a generate returns control before it settles; probe reports a
  no-tools model without retrying. Plus one live DeepInfra run of the loop against fake tools
  (key in the process env, same shell call).

- [x] **W3 - the Agent row and endpoint keys.** Ownership: `main/secretsStore.js`,
  `js/core/secretsClient.js`, `js/components/Organisms/MpiLlmSettings/**`,
  `tests/secrets-endpoint-profiles.test.cjs` (new). Briefings: `components`, `dos_and_donts`.
  Work:
  - Profiles `{id, name, baseURL, model, contextWindow}`. Presets: **DeepInfra (recommended, with
    its signup link, `deepseek-ai/DeepSeek-V4-Flash-0731`, 1,048,576)**, OpenRouter, OpenAI,
    Ollama `/v1` (labelled untested, with the VRAM caveat), and custom.
  - Keys stored per profile id, bound to base URL; IPC set/has/clear only; read by the server
    through the fork bridge. The DeepInfra preset reuses the existing DeepInfra slot, so a user
    never enters the same key twice.
  - The Agent row: profile, model, mode (Auto / Ask first), and Probe (calls `/agent/probe`,
    shows the answer). Copy follows the no-internal-identifiers rule.
  **Verify:** the test records the IPC channels and proves no renderer-readable get channel
  exists for endpoint keys; a key saved for URL A is refused for the same profile edited to
  URL B (flip the check -> red); `npm run lint:components`.

- [x] **W4 - the chat.** Ownership: `js/components/Organisms/MpiPromptBox/**`,
  `js/components/Compounds/MpiAgentChat/**` (new), `js/services/agentService.js` (new),
  `js/shell/preloadStyles.js` (its css line), `js/components/types.js` (its props),
  `js/shell/projectUI.js` and `styles/shell/landing.css` (the landing slot only),
  `tests/desktop/agent-chat.spec.js` (new). Briefings: `components`, `dos_and_donts`,
  `component-mounts`, `component-events`, `state`. Work:
  - Agent | Prompt toggle on the prompt box. Agent mode: Enter sends, Shift+Enter breaks the line
    (the @-reference picker keeps Enter while it is open), same expand behaviour, drag-and-drop
    images attach to the message.
  - Transcript (markdown via `js/utils/markdown.js`), result cards (thumbnail, opens the card),
    the install confirm card (Yes / No with the size), a "compacting" line. The prompt a generate
    used is not shown (brief item 12).
  - The mascot is always in the box: `assets/mascot/idle.png` when quiet, `waiting.png` with the
    float animation on any `agent:working`.
  - `agentService.js`: POST message, `EventSource` on `/agent/stream`, history on mount.
  - Landing entry with no project open, in one slot.
  **Verify:** the desktop spec with in-page `fetch`/`EventSource` stubs and a private `--output`
  dir: toggle -> chat; Enter sends exactly one POST; Shift+Enter adds a newline; stubbed events
  render; Yes posts `/agent/confirm`; the mascot `src` flips on working and back. `npm run
  lint:components`.

## Phase 3: Integration and the scripted harness

*Sequential: one app instance, and every task needs all four workers. Verify mode: auto, except
the landing rearrange (`user-ux`).*

- [x] **The three carried integration items** (trust boundary, place the attachment, the box-bounds
  branch). **Verify:** four new loop tests, one of which goes red when the gate is re-opened;
  `npm test` 1093 pass / 0 fail. *Done 2026-09-16.*
- [x] **Rearrange the landing entry** (Fabio, 2026-09-16): the chat shipped as a full-width band
  between headline and stats foot, so it lay across the crew stage and its `pointer-events: auto`
  ate every character's hover, with its own mascot on top of theirs. Now a corner panel on the
  right, lifted clear of the heads, mascot and label on the box. **Verify:** hit-test 180 points
  across the five characters — 0 land on the panel, 66 did with the old layout. *Done 2026-09-16.*
- [x] **Wire it end to end with no GPU spend.** `npm run app:isolated` (its own port and profile,
  never `:3000`): a real conversation lists models, reads knowledge, and on the landing page with
  no project asks for one before generating. **Verify:** `app.log` `[agent]` lines and the captured
  SSE events; `/agent/history` shows the tool calls in order. *Done 2026-09-16; it found two real
  defects (Electron `NO_KEY` with the env key, and invented project paths), both fixed and covered —
  see `validation.md`. The `/connector/*` empty-body re-probe rode along.*
- [x] **Shared LLM connection** (Fabio via coordinator message `b5952029`, 2026-09-16; reply
  `0fb6f49d` to MPI-737 carries the contract). A profile becomes a connection only
  (`{id, name, baseURL}` + URL-bound key); the per-job model leaves it (agent model -> agent prefs);
  one shared connection pref. Job-agnostic `POST /llm/connection/probe` and
  `GET /llm/connection/models?profileId=` (recommended first, `recommendedFor[]`) in
  `routes/llm.js`; `RECOMMENDED_REMOTE_MODELS` in `services/llmEngines.mjs` (exact ids per preset;
  MPI-774 fills `agent`). Settings: connection block at the top of Language Models; Agent row =
  "Remote" + model dropdown ("(recommended)" first) + mode. NOT touched: the DeepInfra-only key
  field, the `'deepinfra'` backend value, the Enhancement/Descriptions rows (MPI-737). Done
  BEFORE the harness, because the loop reads the profile. **Verify:** secrets + llm-service +
  agent-loop tests green; a route test for both new routes with a fake endpoint; the agent loop
  resolves its model from prefs, not the profile.
- [x] **Gallery agent panel** (Fabio, 2026-09-16). The toggle moves to the first slot of the bottom
  row (after the text field, before the expand button). The drawer over the prompt box goes. In
  Agent mode a shell-level panel on the LEFT fills from under the topbar down to the prompt box and
  pushes the workspace right; the image-chip strip still paints over it. It holds only user
  bubbles, agent replies and the images sent. The prompt box sends its image chips as attachments.
  Also: history replay read `entry.role`, the loop writes `entry.kind`, so a remount rendered an
  empty transcript - fixed here. `MpiGalleryBlock.js`/`MpiGalleryGrid.js` are MPI-770's (claimed):
  the panel lives in the shell, never in the block. **Verify:** agent-chat desktop spec extended
  (panel shown only in Agent mode, cards pushed right, history survives a remount);
  `lint:components` clean.
- [x] **Agent state on the event bus** (Fabio, 2026-09-16): the mascot animations are a later card,
  but they need triggers now. `agentService` owns ONE `/agent/stream` and re-emits every
  `agent:*` SSE event on `Events` (`MpiEventMap` entries), so any component subscribes without
  opening its own stream. The mascot art itself is out of scope. **Verify:** unit test on the
  forwarder; the chat consumes the bus, not its own EventSource.
- [x] **Landing: agent box beside the headline** (Fabio, 2026-09-16): out of the crew corner, into
  the empty space right of "Generate. Refine. Own it.", refined with the impeccable skill.
  **Verify:** screenshots on an isolated instance; the 180-point crew hit-test still 0.
- [x] **The harness.** Ownership: `scripts/agent-test.mjs` (new), `tests/fixtures/agent/**`
  (new), `package.json` (one `agent:test` line). The real loop against fake tools (canned models,
  descriptions, boxes, refusals); the nine cases in brief § Testing; each run 3 times; graded by
  exact assertions on tool calls, never a judge; cost per run from `usage`. **Verify:** 9 of 9
  cases pass 3/3 on the orchestrator; each case's assertion is proven to bite (flip its fake ->
  red); cost per typical session recorded in `validation.md` beside the command. A case that fails
  its 3/3 -> pick the next candidate with Fabio (Qwen 3.8 27B is ~14x the output cost, so it is
  his call).
- [x] **Prompt quality sample.** Five generate prompts from the harness into
  `research/prompt-samples.md`, each run through the recipe mechanical checks already in
  `scripts/recipe-test.mjs` (word budget, no placeholders). **Verify:** the file exists with
  pass/fail per sample; Fabio reads it.

## Phase 3b: Fabio's round (2026-09-16, before any GPU)

*Fabio, after reading the Phase 3 report. Verify mode: auto, except item 3 (`user-ux`).*

**Fabio's answers (2026-09-16, session 105b3570), they override the item text below:**
- **Item 1 covers the IN-APP agent only.** External CLI agents and the external skills KEEP the
  delete routes: "that's usually used by more powerful agents with a lot of tooling ... it's the
  user's responsibility, and the user might just want ... 'Save the media and delete the projects
  once you're finished'". So: no skill edits for deletion; the in-app tool table and the calls
  `agentTools.mjs` can make are pinned by a test; the system prompt and `docs/agent/*` carry the rule.
- **Item 2, the skill packs: option (a).** Vendor packs live ONLINE (locations per model in
  `docs/recipes/research/<id>/sources.md`; content deliberately not stored, Fabio 2026-08-17). We
  write our OWN refined guide per shipped model in `docs/agent/models/<model>.md` (ships, `docs/` is
  not excluded), distilled from the vendor pack + our recipe + `docs/models/<model>/` + field
  evidence, each citing its sources, no vendor text copied.
- **Item 5: build it in this card** (reverses brief item 14's "gone on restart" and the "memory
  across restarts" out-of-slice line). Design as proposed, not objected to: `<project>/Agent/`,
  `README.md` index (one line per note) + one `.md` per note; the index enters the first turn with
  that project (and after a switch); tools `read_memory` / `write_memory` over
  `GET/POST /connector/memory` (CLI agents get them too); slug file names resolved inside `Agent/`
  only; update allowed, no delete; caps 4 KB per note, 100 index lines, else `MEMORY_FULL`; a
  "Noted: <title>" status line on each write; no in-app viewer in this card.

**Progress (session 105b3570, committed at its handoff):**
- Item 1 built: deletion rule + honest limit in the prompt, `docs/agent/gallery.md` row,
  `tests/agent-no-delete.test.cjs` (tool names, invented tool refused, prompt rule, and an
  ALLOWLIST of every request `agentTools.mjs` can make); 5 mutations all red, bytes restored.
- Item 3 built: `#agent-panel-mount` margin-top 52px (was padding) and 420px; the real-panel
  spec asserts width 420 and top >= topbar bottom (both mutations red). Screenshots on an
  isolated instance (`:53030`, scratch project). Waiting on Fabio's eyes.
- Item 4 done: component-maps worker, HEAD-only reads, 4 files (+39/-2), LF verified by me.
  It found `gallery:open-card` had NO listener: fixed (shell listener in `agentPanel.js`,
  declared in `js/events.js`, spec with a recorded navigate), map line corrected.
- Item 5 built: `services/agentMemory.mjs` + `/connector/memory` routes, tools
  `read_memory`/`write_memory` (open project only), notes index opens the first turn per
  project, "Noted:" label; `tests/agent-memory.test.cjs` 9/9, loop block (h).
- Item 2 in progress: corpus kinds `guide` + `skill` (+ `copyAgentSkills` build step, since
  `.claude` is not in the portable build), `guides` + per-model `media` roles on
  `/connector/models`, the GUIDE_NOT_READ gate, `rename_card` + `cardName`, H3 guide written;
  8 guides by 4 workers, all reviewed and corrected by me (SDXL's labelled blocks, Klein t2i
  media, mask ops, neutral wording). Harness: live corpus, 4 new cases; the knowledge fixture is
  gone (unused). DONE: 13/13 x3, --bite 13/13, samples rerun after swapping two guide examples
  that WERE sample requests (the agent had pasted one verbatim). `list_models` ops also carry
  per-model `media` roles now.
- Found and fixed on the way: a finished generation pushed a user message into the context
  the moment it settled, which can land between a tool call and its result mid-turn (a
  provider 400). Now queued and sent at the start of the next turn, failures included.

- [x] **1. Agents never delete.** "Only the user can delete cards and projects." Today the loop's tool
  table has no delete, but prove it and make it structural: sweep `routes/connector.js`,
  `services/agentTools.mjs`, `js/shell/agentDispatch.js` capabilities and the CLI skills
  (`.claude/skills/cubric-vision*/`) for any delete/remove/trash path an agent can reach; add a test
  that fails if a delete-shaped tool or connector route appears; state the rule in the system prompt
  (refuse and tell the user to delete it themselves) and in `docs/agent-chat.md` + the skills.
  Note: a CLI agent can still call raw app routes (`DELETE /project-media/...`); say so honestly and
  decide with Fabio whether the connector surface is the enforced boundary.
- [x] **2. The agent uses skills, not only recipe briefs.** Fabio: "we have skills to work with
  Cubric-Vision, are we not giving that to the agent?", and "models bring their own skill packs;
  we could create refined skill sets per model". An agent should ADAPT prompts with its own knowledge
  and the model's guide; a recipe used verbatim will not reach what the user wants. Today the corpus
  (`services/agentCorpus.mjs`) serves recipe briefs (`kind:'model'`) + `docs/agent/*.md`
  (`kind:'app'`) + `app:operations`. Plan: add a `kind:'skill'` family from the Vision skills
  (`.claude/skills/cubric-vision*/SKILL.md` + their linked files) and per-model skill files;
  give each model in `list_models` its guide ids; require a read before the first prompt for a
  model (structural, like the install gate if a rule alone does not hold). **Open question for
  Fabio:** where do "models' own skill packs" live? `grep -i "skill.?pack"` finds only the kanban
  plugin; candidates are `docs/models/<model>/` (e.g. `h3/`, `ltx/prompt-contract.md`) and the
  create-enhancer-recipe output. Ask before designing. Re-run `--samples`: the H3 prompts (44/46
  words vs a 50-400 floor, no shot structure, no sound) are the measured baseline to beat.
- [x] **3. Panel layout (user-ux).** The left panel covers the workspace topbar (project name,
  "<- PROJECTS") because `#agent-panel-mount` starts at the top of `.workspace-content` and only pads
  52px. Start it BELOW the topbar and the nav chips so they keep their own area, and widen it by
  100px (320 -> 420, `styles/shell/workspace.css` `#agent-panel-mount.agent-panel-mount--open`).
  Verify: the real-panel desktop test (width assertion) + a screenshot for Fabio.
  **Fabio 2026-09-16:** position OK (his screenshots); "the chat window should have some padding so
  that the letters are not straight up touching the edges" -> fixed in `MpiAgentChat.css`
  (`#agent-panel-mount` transcript `padding-inline: var(--s-3)`, the header's gutter), awaiting his reload.
  **Closed 2026-09-16 ~14:30Z:** Fabio answered "1" (looks good) after that commit.
- [x] **4. Update `.claude/rules/`** (Fabio said yes, 2026-09-16): the component maps for the new
  wiring (events `agent:*` + `agent:send`, state `agentMode`, the `#agent-panel-mount` shell mount,
  `MpiAgentChat` bus subscription, `MpiLlmSettings` connection block). Use the
  `mpic-update-component-map` skill, not hand edits.
- [x] **5. Per-project agent memory.** Fabio: a folder in the project where the agent keeps Markdown
  memory; on opening a project it reads an index (`README.md`/`agents.md`) that points at note files,
  one per thing it learned working on that project. Design first (decide with Fabio): folder name
  and place (precedent: `project.md` and card notes, `.claude/skills/cubric-vision-project-files/`),
  when it is read (project open / first turn, via the app-state line), tools (`read_memory`,
  `write_memory` scoped to that folder only; NO delete, item 1), size caps, and whether the user sees
  it in the app. Writes go through a route, never a direct `fs` write from the loop.

## Phase 3c: One conversation per project, and the landing agent's jobs (Fabio, 2026-09-16)

*Taken by MPI-737 session 5da6c574 from Fabio's feedback. Verify mode: auto for the code, user-ux for
the end check. **Built 2026-09-17 by session 6fd51047** (evidence: `validation.md` § Phase 3c).*

**Fabio's answer (2026-09-17, session 6fd51047): "go"** to "go, all recommended", so D4-D6 are as
recommended below.

**As built:** `services/agentSessions.mjs` holds the conversations (a module, not a Map inside the
router, so D4/D5 are unit-testable); `projectKey` (`agentLoop.mjs`) is the one key function. D5 also
covers a PROJECT conversation opening another project: it carries, never moves. `open_project` is
structural like `_images`: only a folder `list_projects`/`create_project` gave, the open project, or
one the user typed (`UNKNOWN_PROJECT`). Two chat defects found and fixed on the way: a 200 reply with
`ok: false` (BUSY, NO_PROFILE) left the chat "working" forever, and a failed generation rendered
`[object Object]`.

Fabio, verbatim in intent: "each project has its own [short] recall ... if I change to another project, I
don't want to see the same conversation ... I'm not saying unload the model". And on the landing page
the agent should: create or open a project; on "create an image" with no project, make one (named
"New Project" or similar) and generate there; on "let's start a new project, the goal is X", create it,
open it, and start a memory file about the project.

**Facts (checked 2026-09-16):** `routes/agent.js` holds ONE `AgentLoop` (`defaultLoop`,
`services/agentLoop.mjs:989`); its state is all per-conversation (`_messages`, `_history`, `_images`,
`_groups`, `_notes`, `_notesProject`, `_readIds`, `_pendingConfirm`, `_working`) plus the SSE
`_subscribers`. `POST /agent/message` already carries `project`. `open_project` exists
(`/connector/open-project`), user-given path only (prompt rule, `agentLoop.mjs` ~450). Projects are
created by `POST /create-project { name, folderPath? }` (`routes/projects.js:769`: default root
`getProjectsRoot()`, a taken name gets `_<8 hex>`, writes `project.json` + `project.md`) and listed by
`POST /list-projects` (`:820`). Neither is a connector route or an agent tool. The renderer's
project switch is `project:changed` (`js/events.js:126`).

**Decisions for Fabio (recommendations first):**
- **D4 - One turn at a time, app-wide?** Recommended: YES. `BUSY` stays global: one model conversation
  runs at a time; a turn started in project A finishes in A's transcript even if you switch to B.
  Alternative: a turn per project in parallel (more spend, more edge cases).
- **D5 - The landing chat opens or creates a project: where does the conversation go?** Recommended:
  it MOVES into that project when the project has no conversation yet (always true for a new one), and
  the landing chat starts fresh. An existing project keeps its own conversation; the agent carries your
  request over in one line. Alternative: the landing conversation stays on the landing page.
- **D6 - Does a project's conversation survive an app restart?** Recommended: NO, as brief item 14
  says; the `<project>/Agent/` notes are the memory that survives. Alternative: save it in the project.

- [x] **A. One conversation per project.** Server: `routes/agent.js` keeps a `Map` of loops keyed by
  the project's `folderPath` (`''` = the landing page); `/agent/message` routes by `project`;
  `/agent/history`, `/agent/reset` take `?project=`; `/agent/confirm` and `/agent/attachment/:id` find
  the owning loop; `/agent/probe` stays loop-free. ONE `/agent/stream` for all: the subscribers move to
  the router (one broadcaster handed to every loop) and every event carries its `session` key.
  Attachments: a reset wipes only that conversation's files. Renderer: `agentService` sends, reads
  history and resets with the key (open project, or `''` on landing); `MpiAgentChat` ignores events of
  another session and re-renders from history on `project:changed`. D4/D5/D6 as answered.
  **Verify:** unit test, two projects keep separate histories and `BUSY` follows D4; desktop spec,
  switch project -> empty transcript, switch back -> it returns; landing and project chats differ;
  `npm test`, `npm run agent:test` 13/13.
- [x] **B. The landing agent's project jobs.** Connector routes `GET /connector/projects` (over
  `/list-projects`) and `POST /connector/create-project { name }` (over `/create-project`, default root
  only, never overwrites), and tools `list_projects` / `create_project`. `open_project` then takes a
  path from `list_projects` or from the user, never an invented one. Prompt rules: open by name; "make
  X" with no project -> create "New Project" (a taken name gets the route's suffix), open it, generate;
  "start a new project, the goal is X" -> name it from the goal, create, open, then `write_memory` a
  project-brief note (goal, look, decisions so far). No delete anywhere: extend
  `tests/agent-no-delete.test.cjs`'s allowlist by exactly these two routes. Docs: `docs/agent-chat.md`
  tools + routes, `resources/cubric/connector-manifest.json` if it lists routes.
  **Verify:** route tests (create never overwrites, list returns folderPaths); harness +3 cases (open
  by name, create-then-generate, new project with a brief note), each with a `--bite` flip; then
  Fabio on his landing page. *Auto part done 2026-09-17; `create-then-generate` REPLACES the old
  `no-project` case (the landing agent no longer just asks), so the harness has 15 cases. Open: Fabio's
  landing-page check (needs a full app restart).*
  *2026-09-17 (session d56a1cbe): harness `new-project-brief` was 2/3 (a first shot generated
  unasked after the brief note); the goal branch now ends by asking what to make first.*
  **CLOSED 2026-09-17:** Fabio's landing check "Everything worked nicely"; his screenshots' three defects
  (broken result image, invisible list numbers, a carried request confusing its new chat and missing its
  bubble) and the harness's `install-asks` guessed-id card are fixed (`validation.md` § Phase 3c close).

## Phase 3d: The agent box (folded from MPI-797, Fabio 2026-09-17)

*Fabio, 2026-09-17: "make sure 797 is part of our work". MPI-797 (`todo`, `blocked` on Phase 3c,
which is committed in `4ee23d00`) stays on the board as the record of the ask; its work lands here.
Same files as Phases 3b/3c: `MpiAgentChat`, `js/shell/agentPanel.js`, `js/services/agentService.js`,
`MpiPromptBox`. Verify mode: auto for the code, user-ux for the end check (folds into Phase 5).*

- [x] **1. Input hint.** In Agent mode the input says how to use it, e.g. "Talk to the agent.
  Shift+Enter for a new line, Enter to send."
- [x] **2. An agent box (D7).** Consider swapping the whole prompt box for an agent box that holds only
  the text input and the Agent|Prompt toggle. **Fabio, 2026-09-17: as recommended** - no new component:
  in Agent mode the existing prompt box (it already sets `mpi-prompt-box--agent-mode`) shows only the
  input, the image chips and the toggle.
- [x] **3. Dropped images attach to the next message.** Chips optional; numbered 1, 2, 3 only, never
  "start frame" / "last frame" / "picture 1".
- [x] **4. The side panel.** Resizes by dragging its edge, runs full height down to the status bar, and
  pushes the prompt input right so it never covers the agent text.
- [ ] **5. Remote image description progress** (folded into MPI-797 by MPI-737's close-out, Fabio
  2026-09-17, `2ab67359`): a Remote describe shows no progress (a ComfyUI one shows in the status bar);
  give it visible progress, "using one of the mascot animations once they exist". **DEFERRED (Fabio,
  2026-09-17): wait for the mascot animations**; they will also play in the agent chat (thinking,
  generating). The agent's triggers already exist: `agent:working` (thinking), `agent:tool` with
  `tool: 'generate'` (generating), `agent:result`, `agent:compacting`.
- [x] **6. The toggle is the agent's head** (Fabio, 2026-09-17: "our agent logo ... only the head").
  `MpiButton` gained an `image` prop (icon mode with an `<img>`: muted until hovered, full colour when
  active). **Second pass (Fabio: wrong head, too small):** the toggle shows the Studio robot,
  `assets/mascot/studio/logo.webp` (trimmed 128px copy of `Studio-Logo.png`), and an image button at
  `sm` drops its padding so the image is as tall as the Enhance button (`mpi-ibtn--image`).
  Not added to the components gallery (Fabio).
- [x] **7. An agent edit's card had the wrong shape** (Fabio's screenshot: Klein edit, 1:1 card, portrait
  image; the sidecar said 1024x1024, the file is 832x1248). `resolveNamedParams` injected the project's
  saved ratio on ops that size their own output (`imageSizedOps`), which the PromptBox never does; the
  server trusts client Width/Height, so the card took the wrong size. Now skipped there.
  **Verify:** desktop spec per item with a bite; then Fabio in his app (a reload, renderer-only).
  *Items 1-4 built and bitten 2026-09-17 (code checked; Fabio's eyes still open, in Phase 5 at the latest).*

**Design (2026-09-17, session d56a1cbe, from a read-only scout):** Agent mode keeps its OWN text
(`agentValue`; before, sending wiped the saved positive prompt through `_writeMode('')`), placeholder =
the hint, the ref picker off, and Ctrl+Enter no longer generates (`_triggerRun` never checked the mode).
The grid collapses to `1fr auto` so hiding slots cannot shift the textarea. Chips: images only, up to 9,
no op up-jump, badge = position always (never a slot tag or a frame pill), `_chipKey` carries the mode
so the toggle repaints; leaving Agent mode fits the chips back to the op (up-jump, else trim the tail;
a model with no image slot prunes them). Panel: a direct child of `.main-area`, absolute from the
topbar to the status bar, width `--agent-panel-w` (stored, clamped, at most half the area); the
workspace, prompt box and controls take the same `margin-left` through `:has()`. No splitter existed:
a new Primitive `MpiResizeHandle` (pointer capture; `resize-start` / `resize` / `resize-end`).

## Phase 4: Live on the GPU

*Sequential, GPU lease held. Verify mode: auto. Open every artifact; a green log is not an image.*

**Where it runs (Fabio, 2026-09-16: option A).** My own `npm run app:isolated` with the real engine
root, attached to the engine his app already runs (48188); never `:3000`. Every command that
dispatches (the agent's `generate`, a ComfyUI `look`) runs inside `gpu_lease.py run` and waits for its
job to settle, because the lease lasts only as long as the command. His app is untouched. The scratch
project "MPI-774 agent test" lands in HIS projects root (`APP_DOCUMENTS` is not profile-scoped); he
deletes it. The install item runs on a second isolated instance with a scratch `CUBRIC_ENGINE_ROOT`
and `CUBRIC_MODELS_ROOT` on K:, seeded so the boot repair downloads nothing (memory
`tool_sandbox_isolated_app_seed_uw_deps`).
**Order:** the person images first, then box measurement on them, then the parser, then the rest
(Head Swap last, since it uses the boxes).
**Two describers.** `look` now goes through `llmService.describeImage` (MPI-737, `2f33601c`), which
runs the Image descriptions pick: Remote (a DeepInfra vision model via `POST /llm/describe`, no GPU)
or ComfyUI (Qwen3-VL 4B, `image_descriptor.json`, GPU). Measure and parse both.

- [x] **Measure the describer's box answer, then build the parser.** *(2026-09-17, 047d6088: both
  describers answer RELATIVE; `boxFromDescribeAnswer` in the route; two live defects fixed on the way,
  see `validation.md` § Phase 4.)* Three real Vision outputs
  with a person; ask for the head box; record the raw answers in `research/box-measurement.md`;
  choose the parse and coordinate space from the evidence; implement it in the describe route.
  **Verify:** a unit test replays the recorded raw strings; the mapped box drawn on each original
  image is opened and inspected.
- [x] **Real generations through the agent.** *(2026-09-17, 047d6088: all five, each after a live fix
  where the first try was wrong; `validation.md` § Phase 4.)* t2i (turbo), t2v (medium + turbo), i2v with an
  attached image, an edit with a reference image, Head Swap with boxes from `look`. The agent keeps
  talking while each runs; the result posts back; it looks at every image result. **Verify:** each
  output opened (images read, video frames sampled); the cards exist in the project;
  `/agent/history` shows a `look` after each image result and no unrequested regeneration.
- [x] **Install, live, in a sandboxed store.** *(2026-09-17, 047d6088: No / Yes / re-read, with two
  fixes found live: the install no longer holds the Yes call for the whole download, and the re-read
  reads `installed`; `validation.md` § Install.)* The smallest not-installed model: the card shows
  the size; No starts nothing; Yes downloads, then a real re-read shows it installed. **Verify:**
  downloads status and a models re-read before and after, both paths.
- [x] **Compaction, live.** *(2026-09-17, fa18265c: Qwen2.5-72B, 32k window; handoff with the five
  fields, `agent:compacting` on/off, the goal recalled after its turn was dropped. Found live: every
  later turn compacted again -> the restart keeps only the turns that fit; `validation.md` § Compaction.)*
  A profile with a small context window crosses its trigger; the handoff
  carries the five fields; the next reply still knows the goal. **Verify:** `/agent/history` shows
  the handoff; the mascot showed "compacting".
- [x] **ComfyUI enhance VRAM (folded from MPI-677 step 1d, Fabio 2026-09-17, message `f82e6bea`).**
  *(2026-09-17, 047d6088: no resident model to evict; the borrow never applied, fixed. `validation.md`.)*
  On the 16 GB card, under the lease: Enhance (backend ComfyUI, the default since MPI-737) ->
  generate -> Enhance -> generate from the prompt box, watching VRAM and whether the second generation
  runs cold, i.e. whether the enhancer graph evicts the resident generation models (MPI-35 phase 2
  claimed it by static analysis only; the counter-argument: the encoder is a subset of what the
  generation already loads). Certain either way: a ComfyUI enhance is a queued job and waits behind a
  running generation. **Verify:** the result in `validation.md` either way, plus a one-line pointer in
  `tasks/MPI-677/validation.md` (MPI-677 stays done; its step 1d text calling DeepInfra the default is
  stale).
- [x] **Honest limits, live.** *(2026-09-17, fa18265c: both, with a REAL Remote refusal; `validation.md`
  § Honest limits.)* "Watch this video" -> the limit, in character; a describer refusal
  (MPI-737's Remote describer exists now: use a real refusal if one can be produced cleanly, else
  the fake) -> says so and names the Image descriptions setting.
  **Verify:** the transcript lines, pasted into `validation.md`.

## Phase 5: Fabio's pass

*Verify mode: user-ux.*

- [ ] **Fabio drives the agent in his own app.** A plain "do X -> see Y" checklist in
  `validation.md`, one action and one result per line. **Verify:** his confirmation recorded.
  *(Round 1 done 2026-09-17/18: transcript + findings in `validation.md` § Phase 5 - Fabio's first
  round. His memory test - restart, then ask about John - is still running.)*

### Phase 5 fixes (from round 1, all folded into this card)

1. **Model priority, a ranked list per TASK** (Fabio: best, second, third, ... not one featured
   model). New table in `js/data/modelConstants/` keyed by task, entries `{modelId, op}` (ops are
   per-model ids); `rank` on each op in `GET /connector/models`; one Model rule line ("of the
   installed models that do this task, take the highest-ranked unless the user names one");
   `docs/playbooks/add-model` gains a step so a new model lands in the table. **Fabio still owes the
   ORDER** (candidates listed in `validation.md`). **Verify:** a harness case - an edit request with
   klein-9b and krea2 installed picks `kleinEdit` 3/3, and naming Krea 2 still wins.
2. **A head box that is not head-sized must not become a square that eats the neighbour.** Live:
   `box1 1166x1166` at `x -245` on a 1664x2304 photo, `box2 1171x1171` on a 768x1344 photo. The
   describe route returns the box's share of the image; the loop refuses a box over the share a
   head can take and asks for a tighter measure (or a crop), instead of squaring it silently.
   **Verify:** the same two photos measured again -> the left woman's square holds her head only, or
   a refusal the user can read; unit test on the recorded numbers.
3. **The agent is Studio cream, not Vision rose:** every pink in the agent chat, panel and agent box
   becomes `--hub-accent` (the token comment saying "identity only, never an action colour" moves).
   **Verify:** no `--accent-heat` left in the agent surfaces; Fabio's eyes.
4. **Remote > Language Models needs a loading state** (spinner or mascot) while the connection block
   resolves; today it shows labels with empty values. **Verify:** Fabio's eyes on a cold open.
5. **Memory saved only when told** ("Don't forget that, okay?"). Strengthen the Memory rule so a
   stated goal, character or decision is saved without the cue. **Verify:** a harness case where the
   user states a character in passing -> `write_memory` called 3/3.

Round 1 continued (Fabio, 2026-09-18, same pass):

6. **No Stop while the agent generates.** He watched the latents come in, asked the agent to cancel,
   and it correctly answered that it has no such tool - but the app's own Stop was not reachable
   either. Cause: Agent mode hides `.mpi-prompt-box__col--run` wholesale
   (`MpiPromptBox.css`), and that column holds Run, **Stop** and Clear. The cancel path behind it
   already works and is origin-blind (`pb.on('cancel')` in `MpiGalleryBlock` ->
   `cancelRunningCueJob` / `activeGenerations.cancel`), and `_refreshPbGenerating` arms it from
   `activeGenerations`, so an agent-started generation already flips it busy. Fix: in Agent mode keep
   the run column, show only Stop in it (beside the Agent toggle). No new button, no new event.
   **Verify:** Fabio stops an agent generation from the agent box; unit assert that the agent-mode
   rule hides run/clear and not stop.
7. **A video result renders as a broken image box.** `MpiAgentChat._appendResult` builds an `<img>`
   for every result whatever its type, so a video result (`type: 'video'`) can never paint - the
   screenshot's broken tile is `alt="video"`. A result whose file is missing (a stopped generation
   that wrote nothing) breaks the same way, silently. Fix: a video result renders a `<video muted
   playsinline preload="metadata">`, and either element's `error` swaps in a fallback tile that says
   the generation did not finish (icon from `js/utils/icons.js`, cream). **Verify:** Fabio sees a
   playable tile for a video and a readable tile for a stopped one; unit test on both branches.

All seven are built (2026-09-18, session 627f63f6; `validation.md` § Phase 5 fixes 2-7 and § Fix 1).
Round 2 came back 2026-09-18: fixes 9 and 10 below were built from it, and fix 8 was found by it.

### Phase 5 fix 8: Stop poisons the next generation of a STREAMED model (CLOSED 2026-09-19, unreproduced)

**Closed by Fabio 2026-09-19 (session a2e84759): four valid repro attempts, zero reproductions.**
The lead below is preserved because the reasoning is still sound — but two of its claims are
WRONG and are corrected under § Fix 8 closure. Read the closure before re-opening this.

Found by Fabio's round 2, and it is fix 6's own consequence. He Stopped an H3 i2v at step 6/8 and
resubmitted 39 seconds later; the second run died on the first weight read of the still-cached
model — `hostbuf_file_reader_read failed`, through
`comfy_aimdo.host_buffer.read_file_to_device`. Evidence, the log extract and the four earlier
interrupts that did NOT bite (each had a 7-50 minute gap, or a different model):
`validation.md` § The defect his round 2 found.

**Unloading is REFUSED (Fabio, 2026-09-18): "I don't want any models to be unloaded. That's going
to slow down next generations." Both the always and the streaming-only variants are dead** — and
"streaming only" was never narrow anyway: H3 streams its weights, so every Stop while watching the
latents is a streaming Stop, which is the case he hits most.

**The lead, and it costs no reload:** `comfy_aimdo/host_buffer.py:74`

```python
def cleanup_file_reader():
    lib.hostbuf_file_reader_cleanup()
```

A teardown of the file-reader state alone — no model eviction, no host buffer freed. Grepped the
whole engine tree: **defined and never called**, by ComfyUI core or anything else. An interrupt
therefore leaves the reader dirty with nothing to clean it, which fits the failure exactly.

- [x] **Confirm the mechanism, then find the call site.** CLOSED unreproduced - see § Fix 8 closure. Unknown and load-bearing: what
  `hostbuf_file_reader_cleanup` does to readers still in use, and whether it is safe on a live
  cached model. Candidate homes, cheapest first: a hook in `ComfyUi-MpiNodes` fired on interrupt,
  an upstream patch to ComfyUI's interrupt path, or a node we can dispatch after a cancel.
  **Verify:** an H3 i2v, Stop mid-sample, resubmit inside 30s -> it runs, and the second run does
  NOT re-report "prepared for dynamic VRAM loading" from cold (which would mean it reloaded).
- [x] **Repro first, it is not yet proven.** DONE 2026-09-19: 4 valid attempts, 0 reproductions. The log pairing is strong (his Stop at step 6/8, same
  model 39s later, dead on the first weight read) and the four earlier interrupts that did not bite
  all had a 7-50 minute gap or a different model. But nobody has reproduced it deliberately.
  ~2 x 90s of GPU on the SHARED engine — check `GET :48188/queue` is empty and tell Fabio first.
- [x] Check whether a newer ComfyUI already calls it, and raise it upstream if not. It does not; aimdo 0.5.5 is identical. Two upstream defects to report - see closure.

#### Fix 8 closure (2026-09-19, session a2e84759)

**Two claims above are now disproven. Do not carry them forward.**

1. ~~"An interrupt leaves the reader dirty with nothing to clean it"~~ — the reader is NOT
   permanently poisoned. In Fabio's own log, BiRefNet (15:28) and SAM3 (15:31) both loaded and ran
   through the same streamed path minutes after the failure, same engine process, no restart.
2. ~~"A newer comfy-aimdo might fix it"~~ — it does not. 0.5.5 vs our 0.4.15: `host_buffer.py` is
   byte-identical and the DLL's entire file-reader string table matches exactly (same functions,
   same log lines, same exits). Upstream ComfyUI never calls `cleanup_file_reader` either
   (`gh search code "cleanup_file_reader repo:comfyanonymous/ComfyUI"` -> empty). A bump is not
   the answer. `cleanup_file_reader` being uncalled is still TRUE, just not evidenced as the cause.

**The repro: four valid attempts, all clean.** Driven against an isolated debug engine on :48199
(`--verbose DEBUG`, own user/output/temp dirs, never Fabio's :48188 or :3000). Each attempt: H3
i2v `minimax_h3_fl2va.json`, turbo branch (8 steps), 2s at 864x480, Stop mid-sample, resubmit.

| attempt | cancel at | gap | host RAM free | TE re-staged | run 2 |
|---|---|---|---|---|---|
| 3 | 5/8 | 10s | - | 10x | success |
| loop 1 | 4/8 | **40s** | 43.0 / 63.8 GB | 10x | success |
| loop 2 | 4/8 | 3s | 44.8 / 63.8 GB | 10x | success |
| loop 3 | 5/8 | 90s | 44.0 / 63.8 GB | 10x | success |

🔴 **A repro of this is INVALID unless run 2 re-stages the text encoder.** ComfyUI caches node
outputs, so an identical prompt string serves the CLIP node from cache and the 25GB
`qwen3vl_32b...` never loads — which is the exact path that failed. The first attempt did this and
read as a clean pass while testing nothing (run 1: 10 TE stagings, run 2: **0**). Vary the prompt
text between runs and assert the staging count. Harness: `scratchpad/repro.py`, `repro_loop.py`.

**The fingerprint table — measured, not inferred.** Every failure exit of
`hostbuf_file_reader_read`, driven deliberately by loading aimdo in the engine's python with
`set_log_debug()` (no generation, no GPU job):

| input | native log | level |
|---|---|---|
| handle after its `ModelMMAP` was dropped | `ReadFile failed error=6` -> `worker failed` -> `file read failed handle=... offset=... size=...` | ERROR |
| garbage handle | same, `error=6` | ERROR |
| read past EOF | `GetOverlappedResult failed error=38` -> `file read failed` | ERROR |
| `device_ptr=0` | `input validation failed device_ptr=0000000000000000 device=0` | ERROR |
| device index 1 | `input validation failed ... device=1` | ERROR |
| CPU pointer as dest | `CUDA API FAILED (1): copy_result: invalid argument` *(DEBUG)* -> `device copy failed result=1 ...` | ERROR |

**What that proves about the original failure.** Every NAMED exit logs at ERROR; the engine runs
aimdo at INFO (`main.py:263-297` maps ComfyUI's `--verbose`; the app passes none, so INFO), and
ERROR passes that filter — the 8 aimdo lines in his `app.log` prove the callback forwards. Yet at
15:24:41 **not one aimdo line was logged**: 15.5s of silence after `25140MB Staged`, then the bare
`RuntimeError`. By elimination it was none of the six rows above. The only remaining exit is a
CUDA failure inside the reader's own slot setup (`cuMemAllocHost` for the pinned slot buffer,
`cuEventCreate`, `cuEventRecord`) — whose ONLY log is `CUDA API FAILED` at DEBUG, invisible at
INFO. Pinned-host-memory / event state, not a file or pointer problem.

**Remaining untried condition: long-uptime host memory pressure.** The reader's slot buffer is
pinned HOST memory. His failing engine had been up ~3h cycling H3, BiRefNet, SAM3 and LTX through
the RAM-pressure cache; every repro attempt ran on a freshly booted box with ~44GB free. If this is
ever chased again, that is the variable — a multi-hour soak, not another four cycles.

**If it recurs, read one log line.** Match it against the table above; that names the cause without
re-deriving any of this. If the line is absent again, it is the silent CUDA slot-setup exit and the
next step is an engine started with `--verbose DEBUG`.

**Two upstream comfy-aimdo defects found on the way (not ours to fix, worth reporting):**

1. **A failure exit that logs nothing at INFO.** Three exits log at ERROR and one logs only at
   DEBUG, so `read_file_to_device` can raise with no cause above it — which is exactly why his
   original log is unreadable. The real defect behind this whole hunt.
2. **`vbar_free_memory (start): size=-8809040871136690176k`** — logged on every teardown of every
   run, a garbage negative size into a free call (`src/model-vbar.c:515`). Reproducible on demand.

### Phase 5 fixes 9 and 10 (Fabio's round 2, both built 2026-09-18, session 130cab18)

9. **Attachment chips wrapped into the middle of the sentence.** `_appendUser` appended each thumb
   straight to the bubble, inline with the text node. They now go in a
   `mpi-agent-chat__attachments--in-bubble` row under the text. **Verified:** live DOM, bubble
   children `[text, row]`, plus a unit assertion.
10. **The composer stood three lines tall beside its Send button.** `MpiInput` sets no `rows` so
   auto-height measured the browser's default of 2, and the landing rule asked for three lines on
   purpose. Now `rows = 1` plus one shared custom property, `--agent-composer-h`, read by both the
   field and the button — `1lh` could not do it, because it resolves against each element's own
   font-size. **Verified:** field 38.9 = button 38.9 live, growth intact, unit assertion.

### Umbrella: MPI-817 (2026-09-19)

This card and MPI-816 now sit under **MPI-817 — in-app agent reliability** (Fabio, 2026-09-19).
This card's remaining Phases 6 and 7 are the umbrella's Phases B and C; MPI-816 is its Phase A.
The umbrella carries the phase ordering and the parallel-batch ownership; this plan stays the
source of truth for everything in Phases 1-7.

### Spun out of this card: MPI-816 (2026-09-19)

Fabio hit a SEPARATE live failure while testing the agent for Phase 7: four Character Sheet
generations dispatched, all four dead on `prompt_outputs_failed_validation`. Diagnosed to the line
and filed as **MPI-816** (`todo`, `planned`) — a null field value clobbers a declared default in
`js/utils/declaredFields.js:500`, and `agent.list-models` (`js/shell/agentDispatch.js:488`) tells
the agent a flow's field ids and labels with no type, default or options, so it cannot construct a
legal value. **Not part of this card's scope** — MPI-774's remaining work is Phases 6 and 7 below —
but it is the same theme as Phase 7 and the two may be worth an umbrella.

### Phase 5 fix 11: the agent refused the keyless Ollama connection (Fabio, 2026-09-19, session 668b667e)

Fabio switched the agent from DeepInfra to the Ollama connection and every message answered
*"No API key for this connection."* It was never decided that the agent is DeepInfra-only — W3
ships Ollama `/v1` as a preset. **Root cause:** "Ollama is keyless" is a rule `routes/llm.js` applies
at all three of its key checks (`!key && profileId !== 'ollama'`), and `services/agentLoop.mjs`
missed it at both of its own (`runTurn`, `probe`). Enhance and describe worked on Ollama; the agent
never could. **Built:** the same exemption at both sites. **Verified:** two tests in
`tests/agent-loop.test.cjs` § (f) — red on the old code with his exact message, green after; a
keyless connection that is NOT Ollama is still refused and spends nothing. Suite 44 pass, 0 fail.

**OPEN, and it decides whether the agent is usable on Ollama at all — needs Fabio (Phase 7):**

**BOTH RESOLVED 2026-09-19, same session. Item 1 is BUILT; item 2 is still open.**

**Item 1 — the context — is fixed by changing ROUTE, not by a setting.** Measured against his real
Ollama before building anything:

| request | result |
|---|---|
| `/v1` keyless chat with tools | HTTP 200 — the `NO_KEY` fix is right |
| `/v1` plain call | `ollama ps` → `ctx 4096` |
| `/v1` + `options.num_ctx: 32768` | HTTP 200 → **still 4096** (silently ignored) |
| `/v1` + top-level `num_ctx: 32768` | HTTP 200 → **still 4096** |
| native `/api/chat` + `options.num_ctx` | **`ctx 32768`** |

So there was nothing to expose in the UI: `/v1` has no knob, and a slider there would have done
nothing. `/v1` is also wrong for a second reason — no `think` flag, so `qwen3-vl:4b` spent **45s**
producing reasoning `/v1` throws away and returned `''`.

**Built:** `chatEngineFor()` sends the `ollama` preset to `OllamaEngine` and the native route;
`OllamaEngine.chat` gained `tools`, `toolCalls`, `usage` and a caller-set `num_ctx`
(`OLLAMA_AGENT_CONTEXT` = 32,768, defaulting to 8,192 so enhance and describe are untouched).
Ollama's tool dialect differs in three ways that each fail QUIETLY, all converted in the engine so
the loop stays single-dialect: `arguments` is an object not a JSON string (the loop `JSON.parse`s
it and catches the throw into `{}` — every tool would have run with no arguments), no `id` on a
call, and results matched by `tool_name`. `_contextWindowFor` reports the same constant, so
compaction follows the window we set.

**Verified live** on `huihui_ai/gemma-4-abliterated:12b`: tool call out with an id and string
arguments, `ollama ps` → `ctx 32768`, result fed back, and the model's answer used it ("Krea 2,
MiniMax H3, and ILL Anime"). First call 60s (cold load of 7.6GB at 32k), second 926ms.

**Still open on the number:** 32,768 gives a compaction trigger of 16,384, and the floor is ~4.0k
plus a `list_models` answer at ~10.8k — so a turn that lists models very nearly triggers a compaction
on its own. The next lever is trimming `list_models` (options only for INSTALLED flows), not raising
the window, because the KV cache shares VRAM with the weights on a 16GB card.

~~1. **His Ollama serves a 4096-token context**~~ (`OLLAMA_CONTEXT_LENGTH:4096` in its `server.log`),
   and `/v1/chat/completions` has no `num_ctx`. The agent's fixed floor — system prompt 8.7k chars
   plus 11 tool schemas 6.0k chars — is **~3.7k tokens before the user types a word** (measured by
   capturing the first request body). One guide read or `list_models` answer overflows it, and
   Ollama truncates from the FRONT, silently: the rules and tools go first. `OllamaEngine` already
   carries this trap for enhance (`num_ctx: 8192` on the native `/api/chat`). Forks: drive the
   agent through native `/api/chat` with `num_ctx` on the Ollama preset, or point the user at the
   Ollama app's own context-length setting. **The native route is not free: `OllamaEngine.chat`
   (`services/llmEngines.mjs:114`) sends no `tools` and returns no `toolCalls`** — it was written
   for enhance, so it cannot carry an agent turn as it stands. That is the size of fork 1.
   NOT built, NOT live-tested — loading a 12B model would have perturbed his fix 8 repro, which
   was running.
2. **Only a model with the `tools` capability can be the agent.** Read from `/api/show`, no model
   load: `huihui_ai/gemma-4-abliterated:12b` has it; `huihui_ai/gemma3-abliterated:12b` and
   `gemma3:12b` do NOT. The model picker lists all of them alike; Probe is what tells them apart.

## Phase 6: Global memory (Fabio, 2026-09-18 — NEXT SESSION)

*Verify mode: user-ux.*

Today every note is per project (`<project>/Agent/`), which is right, and there is nowhere to keep
what holds across all of them. His v1, deliberately small:

- [ ] **A global store beside the project one**, in app data (`<APP_USER_DATA>/agent/`, where the
  attachments already live), so it outlives any one project. **Verify:** a note written in one
  project is read back in another, after a restart.
- [ ] **Saved on the user's ask, not on the agent's judgement.** "Save that in global memory" is the
  trigger; the per-project Memory rule keeps saving unprompted, and the two must not blur. **Verify:**
  a harness case — a plain statement goes to the project, "save that globally" goes to the global
  store.
- [ ] **The agent can say it has both.** Asked whether it remembers things, it answers: per project,
  and a global memory you can ask it to save to. **Verify:** a harness case on the answer.
- [ ] **A README that is a POINTER FILE**, `@`-style pointers to the other notes, read first; each
  note capped at 200 lines. The same shape as this repo's own `MEMORY.md`, for the same reason: the
  index is what gets loaded, the note is what gets opened. **Verify:** with several notes, one read
  of the README is enough to know which one to open.

Not now, on his word: anything cleverer (scoring, automatic promotion from project to global,
summarising). "Perhaps later on we can build a more complex, more efficient system."

## Phase 7: Hand the Flow back to the user, and where model knowledge lives (Fabio, 2026-09-18 — NEXT SESSION)

*Verify mode: user-ux.* **Design first, with Fabio — do not build from this section alone.**

His doubt, in his words: "I can see a lot of issues with the agent trying to use Flows because of
the gizmos." A Flow is the beginner surface and it is built for hands — boxes, sliders, a canvas —
and every gizmo a Flow grows is another thing an agent has to drive blind. His landing:

- [ ] **The agent has a go, then always hands it back.** Whether it succeeded or failed, the reply
  names the Flow it used and offers the way in: "I used Head Swap. Your images are already loaded —
  open it here and adjust it yourself." Same shape as the history workspace. That way a result not
  to the user's taste is one click from their own hands, and a Flow the agent CANNOT drive is still
  a useful answer. **Open questions for the design pass:** does the chat get a real control that
  opens the Flow with the media staged (a card, like the install Yes/No card), or is it a sentence?
  What stages the media? Which Flows are agent-drivable at all — is that a field on the descriptor?
- [ ] **Model/task knowledge may belong in a SKILL, not the system prompt.** The agent already reads
  skills: the corpus is `services/agentCorpus.mjs` (`listCorpus()`), served by
  `GET /connector/knowledge`, and `read_knowledge` pulls one — the harness shows it reading
  `skill:cubric-vision-flows` unprompted. So `skill:` entries are the existing home for "how to do
  this job well", while the system prompt is what it always carries. Phase 5's ranking went into the
  catalogue (`rank`/`note` on each op) plus one rule line; the open question is whether the
  per-task, per-model detail (strengths, when to pick what) moves into a skill entry that is read on
  demand, leaving the rule to say only "read the model skill before you choose". **Weigh:** a skill
  is cheap to grow and costs a tool call; the system prompt is always there and costs tokens every
  turn.

- [ ] **The agent does not know that EVERY i2v op centre-crops its start frame** (Fabio, live,
  2026-09-19). He animated a 4:5 portrait still on a 16:9 canvas with `minimax-h3 / i2v_ms`; the
  head left the frame and the character lost her identity. **Measured:** a cover-crop from 4:5 into
  16:9 keeps the middle **45% of the image height** — 55% is discarded, top and bottom, and a
  head is at the top.

  **This is not an H3 quirk and does not belong in one model guide.** Every i2v op in the app does
  it, by deliberate design (crop, never pad — letterbox bars baked into frame 0 get animated as
  scenery):

  | op | where the crop lives |
  |---|---|
  | `minimax-h3 / i2v_ms` | `MpiH3ImageToVideo._cover_crop` (`ComfyUi-MpiNodes/h3.py:106`), pinned by a self-check |
  | `wan22_i2v`, `wan5b_i2v`, `ltx_i2v_t2v` | `ImageResizeKJv2`, `keep_proportion: crop`, `crop_position: center` |

  `ref2v_ms` is the one that does NOT: `MpiH3References` scales each reference with "aspect kept,
  never upscaled, no crop" (`h3.py:283`), because references never become frames. Its
  `ref_image_size` matters — `max` (2048 short edge) is the identity setting, `match` squashes a
  sheet past readability.

  **Prose alone cannot fix this: the agent is never told the source image's size.**
  `resolveAgentMedia` hands dispatch `{url, mediaType, role, source}` and no dimensions
  (`js/data/generationControls.js`), and `list_models` advertises a flat `ratios: [...]` with no
  hint that one of them will cost the frame. So the agent cannot tell portrait from landscape, and
  a guide line telling it to "match the ratio" is unactionable.

  **Fabio's landing (his words, 2026-09-19), two branches:**
  1. *User did not ask for a ratio* → give the video **the source still's own shape**. Today an
     unset `ratio` falls back to the project's saved selection (`resolveNamedParams`), which has
     nothing to do with the picture. Silent and always right; no conversation needed.
  2. *User explicitly asked for a ratio that crosses the source* → **say so**. "at least let him
     know", and name the reference route when one is installed: `isOperationInstalled` already
     answers whether `minimax-h3-ref2va` is on disk. If nothing installed can hold the identity,
     that is the sentence.

  **Where it goes:** `_submitGeneration` (`js/shell/agentDispatch.js:171`) already has the target
  canvas resolved as `mergedInjection.Width/Height`, one line after it has `mediaItems`. Both
  branches are computable there; only the source dims are missing (an image decode in the
  renderer, or carry them on the media item).
  **Fabio generalised it, 2026-09-19:** *"Any model that takes in an input and has a ratio option
  can suffer from this issue… the agent can give a warning if the input mismatches… of course, this
  would mean that the agent would need to know the ratio of the input image."* So the rule is not
  i2v, it is **media-in + ratio-offered**, and the warning is the agent's to give.

  **BUILT (session 668b667e):**
  - `POST /connector/describe` now returns `output.imageSize {w,h}` on **every** look, not only a
    `box: true` one. It already read the metadata in the box branch and threw it away otherwise,
    and it is the only route that tells the agent an image's shape. A header read, not a decode;
    an unreadable image loses the field instead of failing the look. **Verified:** a real 1024x1280
    PNG through the real router in `tests/agent-generation-relay.test.cjs` — red before, green
    after, and the description still comes through.
  - **Shape rule** in the system prompt: with an input image and a ratio, look first, compare
    `imageSize` to the ratio, and tell the user what will be cut BEFORE generating — naming the
    matching ratio and whether anything installed can hold identity without cropping.

  **SETTLED by Fabio, 2026-09-19, after being told the channel constraint** (`generate` is
  fire-and-forget — `agentLoop.mjs:693` returns `{ok: true, started: true}` the moment the job is
  posted and the dispatch's own report only arrives via `onComplete`, so a warning attached to the
  result lands after the render has already burned the time): **no dispatch refusal. Snap to the
  closest ratio, and warn.** His words: *"the agent should use the closest crop. A 4:5 would make
  the agent use the 9:16 crop in the video model, for example, and a 5:4 would make the agent use a
  16:9. A little warning should display, saying there's a ratio mismatch and the image will be
  cropped."*

  **Why closest-with-the-same-orientation and not smallest-crop** — they disagree, and his
  instinct is the right one. A 4:5 picture (0.8) on H3, which offers `1:1 9:16 16:9 21:9`:

  | target | what it cuts | kept |
  |---|---|---|
  | `1:1` | top and bottom | 80% of the height — smallest crop, but it eats into the head |
  | `9:16` | **the sides** | 70% of the width, **full height, head safe** |
  | `16:9` | top and bottom | 45% of the height — what he hit |

  Minimal-crop picks `1:1`; orientation-matching picks `9:16` and is the one that keeps the face.
  The rule is written as "closest offered ratio with the SAME orientation", which lands on his
  example exactly. Every ratio label is literally `W:H` (`js/utils/ratios.js`), so the model can do
  the arithmetic from what `list_models` already gives it.

  **BUILT:** the Shape rule now carries both branches (unnamed ratio → snap to closest same
  orientation; named ratio that crosses → use theirs, say what it cuts, name `ref2v_ms`) and the
  one-line mismatch warning in either case.

  **COST, and it matters for the Ollama item below:** the Shape rule took the agent's fixed floor
  from 8,681 to 10,177 chars of system prompt — **~4,049 tokens** with the 11 tool schemas. Fabio's
  Ollama serves a 4,096-token window. The floor now IS the window.

- [x] **Ollama Cloud does NOT break the keyless-ollama invariant — CLOSED, no change** (peer session
  `56b53dee` raised it and then retracted it the same day, with the evidence). Nothing for Fabio to
  decide, and nothing to build:
  - **The local daemon already holds the credential.** `POST http://localhost:11434/api/me` on his box
    returns a live account (plan: free) and he has never put a key in our app: sign-in happens once in
    the Ollama app, and the local server proxies cloud models. A client calls `localhost:11434/api/chat`
    with a `-cloud` model and NO Authorization header — which is exactly what `OllamaEngine` does.
    (`GET /api/me` answers 405; it is POST-only, so the obvious probe makes it look absent.)
  - **ollama/ollama#13801 does not apply.** Closed, fixed by PR #14574, and it only ever hit
    `/api/generate` with `raw: true` on 0.14.2. We call `/api/chat`, never set `raw`, and his box runs
    0.34.1.
  - Only DIRECT `https://ollama.com/api/chat` needs a Bearer key, which matters to a client that does
    not want a local Ollama — not us, since our backend drives the local app already
    (`services/ollamaLifecycle.js`). So the `profileId !== 'ollama'` skip in `runTurn` and `probe`
    stays a stated invariant, not a "keyless unless".
  - **Still unverified:** a live cloud generation end to end (his plan is free, no `-cloud` model
    pulled). The one thing that could still surprise us is whether a cloud-served model returns
    `function.arguments` as an object or a JSON string — `fromOllamaToolCalls` already converts both,
    so it would survive either way.

  Kept from the same assessment, for whenever the agent surfaces model fit or memory pressure: plan
  the budget BEFORE loading and report what actually happened afterwards, rather than asking for
  147 GB in one go and dying with an OOM that reads as the user's hardware being too small.

- [ ] **Ollama's free CLOUD models may be the real answer to "let users run bigger models"** (peer
  session `56b53dee` relaying Fabio, 2026-09-19 — **not yet confirmed by him to me directly, and
  nothing has been run against his account**). His allowance page lists six covered by a resetting
  free allowance at 0% used: `gemma4:31b`, `gpt-oss:120b`, `gpt-oss:20b`, `nemotron-3-nano:30b`,
  `nemotron-3-super`, `nemotron-3-ultra`. The pay-as-you-go balance is $0 and is not needed for these.

  The pull is that `gpt-oss:120b` and `nemotron-3-ultra` are bigger agent models than a user will run
  locally, and they arrive with **no key in our app, no download, no new backend** — the existing
  `ollama` preset and `OllamaEngine` already reach them through the signed-in local daemon. Most of
  it is built.

  Open, and all in this card's files:
  - **Which of the six have `tools`** in `/api/show`. That gates agent eligibility, and six known ids
    is a far easier surfacing problem than the open local catalogue. Check this BEFORE reading
    anything into an empty `tool_calls` — a model with no tool support looks exactly like a dialect
    failure.
  - **The dialect itself on a CLOUD-served model:** `function.arguments` as an object vs a JSON
    string, a call with no `id`, a result matched by `tool_name`. `fromOllamaToolCalls` converts all
    three for local; cloud is unverified, and a silent mismatch runs every tool with empty arguments.
  - **Context window.** `OLLAMA_AGENT_CONTEXT` is pinned at 32,768 and `_contextWindowFor` reports
    it, so a cloud model offering more would be silently wasted.
  - **`RECOMMENDED_REMOTE_MODELS` has no `ollama` key** (the picker item below), and that table is
    what drives both the recommended-first ordering and the context window.
  - **What a user with no signed-in daemon sees.** Sign-in happens in the Ollama app, not ours, so
    the failure needs a message that points there.

  The free list is volatile — Ollama has revised these quotas before, so re-read the page rather
  than trusting a copy of it.

- [x] **A chat call with no deadline reads as "stuck"** (Fabio, live, 2026-09-19). He asked the agent
  to animate an adult image; the panel sat on `LOOKING AT IMAGE` and never moved. The log says it
  exactly: `09:29:26 Agent job fe7aac93… agent.describe`, then **nothing at all** until he quit at
  `09:31:33`. No error, no second line.

  **Cause: neither engine passed a signal to `fetch`.** `DeepInfraEngine.chat` and
  `OllamaEngine.chat` both made a bare call, so the only deadline was undici's own ~5 minutes —
  longer than any healthy call, and when it fires it says nothing a user can read. Every remote job
  rode on that: describe, enhance and the agent's own turns.

  **BUILT:** `_fetchWithDeadline` in `llmEngines.mjs`, used by both `chat()` methods (and so by both
  `complete()`, which delegate). `REMOTE_CHAT_TIMEOUT_MS` 180s — the slowest healthy agent turn
  measured is well under one minute; `OLLAMA_CHAT_TIMEOUT_MS` 600s, because a cold 12B load at 32k
  context measured ~60s before the first token and a local machine being slow is not the same failure
  as an endpoint being gone. The error names the endpoint and carries `code: 'TIMEOUT'`. Test stubs a
  fetch that never resolves and asserts both engines give up — it caught a half-applied edit on the
  first run (the Ollama call had been switched to the helper without its arguments, so it aborted on
  `undefined`).

  **A possible contributing cause, named for honesty:** my own `agent-test` harness run was hitting
  the SAME DeepInfra account at `09:28–09:29Z` on the key from `~/.secrets/di.txt`. Concurrency or a
  rate limit on that account cannot be ruled out as what stalled his call. A 429 would have returned
  an error rather than silence, so it does not explain the hang on its own — but the harness spends
  his money and should be flagged before it runs, not after.

  **Not fixed, and it is the other half:** the UI still shows nothing but a static label while a look
  is in flight, so a slow answer and a dead one look identical for three minutes. That is UI — his
  call, and it belongs with the picker item below.

- [ ] **NEXT SESSION, both found by Fabio live at 10:09Z on 2026-09-19, minutes after the two tests
  passed.** He asked for an image from the landing page, then said *"You can place it in the Fanvue
  project."* Two defects, and they are not the same one.

  **(a) The `NO_PROJECT` error teaches the model to ask.** His screenshot reads *"I need a project to
  create this image. Please open or create a project first."* That is `agentLoop.mjs`'s own
  `NO_PROJECT` text — *"No project is open. Please open or create a project first."* — relayed almost
  verbatim. The Project rule says the exact opposite ("never ask them to open or create one first,
  that is your job"), and the rule lost: a concrete tool result beats a prompt rule, every time.
  **The error message is the fix**, not more prose. It should tell the agent what to DO — create one
  with `create_project`, which now opens it, then send the same generate again — rather than
  describing the state to a user who cannot act on it. Check every other error string in the loop for
  the same shape while in there; this is the second time this session that a *message* has been the
  real instruction (the first was the crop rule's edges).

  **(b) An existing project is matched case-sensitively, but the filesystem is not.** Log:
  `10:09:29 created project "Fanvue" at …/Projects/Fanvue_2b752074`, while `fanvue` already existed
  and he had just named it. The `_<8 hex>` suffix is the taken-folder escape hatch in
  `POST /create-project`, so **the app already knew the name was taken** — Windows is case-insensitive
  at the folder level — and treated that as "pick another folder" instead of "you already have this
  project". Fabio's read: *"I'm guessing he's not looking at case sensitivity in strings."*
  Two layers to check, and they may both need it: the agent's own path (the Project rule says to find
  a project by name with `list_projects` before creating, and it did not), and `create-project`
  itself, which could answer "this project exists, here is its folderPath" rather than silently
  minting a twin. **Beware the trap this session already hit:** two projects with the same display
  name are indistinguishable in the picker, which is what made his chat look lost this morning. Same
  root, and worth fixing once.

- [ ] **A model that does not refuse adult work deserves a flag, next to the recommended one**
  (Fabio, 2026-09-19): *"Qwen3 VL 30B A3B Instruct seems to not care about uncensored content, so we
  could have a recommended NSFW flag for this, just like we have a recommended flag for the DeepSeek
  V4 Flash one."*

  **Evidence is already on this card:** test 2 above ran an adult image end to end on
  `Qwen/Qwen3-VL-30B-A3B-Instruct` — it looked at the picture, described it, wrote the prompt and
  dispatched the video, with no refusal at any step.

  `RECOMMENDED_REMOTE_MODELS` (`llmEngines.mjs:467`) is where the recommended mark comes from today:
  `{ id, jobs, contextWindow }`, one row per model, and `listRemoteModels` sorts those first. A flag
  belongs on that row. **What it must NOT become:** a promise. We can say a model did not refuse in
  our testing; we cannot say it never will, and a hosted provider can tighten its filter without
  telling anyone. The honest wording is closer to the panel's existing line (*"A hosted provider will
  refuse or quietly sanitise material that a local uncensored build will shape for you"*) — something
  like "did not refuse adult work in our tests", dated, not "uncensored".

  Covers all three rows (Enhancement, Description, Agent) and belongs with the picker item below,
  since a flag with nowhere to render is half a feature. **Fabio's call on the wording** before it
  ships — it is a claim about someone else's service, on a public UI.

  **SETTLED by Fabio, 2026-09-19, after seeing the prices: flag Qwen, leave DeepSeek unflagged.**
  He had assumed the two cost the same; they do not, and the flag does not follow price anyway — it
  follows evidence, and only Qwen has any.

  | per 1M | DeepSeek V4 Flash | Qwen3-VL-30B | gemma-4-26B-A4B-it |
  |---|---|---|---|
  | input | $0.06 | $0.15 | $0.07 |
  | cached input | $0.015 | none offered | none offered |
  | output | $0.18 | $0.60 | $0.34 |
  | context | 1,048,576 | 262,144 | 262,144 |
  | multimodal | no | yes | yes |

  From his own usage pages, per request: DeepSeek `$1.18 / 3.37K = $0.00035`, Qwen
  `$0.02023 / 20 = $0.00101` — ~3× cheaper while carrying MORE input per request (10.9K vs 6.4K).
  The gap is wider than the sticker for an agent, because **25.65M of his 36.89M DeepSeek input
  tokens were cached**: the system prompt and tool schemas repeat every turn, which is the cached
  tier's ideal case. Effective input ≈ $0.029/M against Qwen's flat $0.15, so ~5×.

  So: **Qwen3-VL-30B gets the flag** (it drove an adult image end to end today — look, describe,
  prompt, dispatch, no refusal). **DeepSeek V4 Flash does not**: today's harness runs went through it
  but on cat pictures, and a tolerance flag on no evidence is exactly the promise this item must not
  make. Its recommended mark stays what it already is — cheap and fast.

  Worth a look when the flag work starts: Qwen's usage page shows **18 OK, 2 ERROR**. Some of those
  are likely this session's early driving mistakes; confirm before attributing them to the model.

- [ ] **A note Fabio asked for early in the agent work may never have been saved** (his recollection,
  2026-09-19): *"when I started the agent work, I asked to save a note on a certain model, which I
  think was 26 billion parameters. Maybe it was Gemma 4."* `google/gemma-4-26B-A4B-it` is the
  recommended **enhance** model (`RECOMMENDED_REMOTE_MODELS`, `llmEngines.mjs:467`) and its usage
  page shows 26 requests, all OK, $0.00436 — so it was being exercised around then.

  Two readings and he could not remember which, so check both: either he asked for a note ABOUT a
  model and wants to know it landed, or the agent was RUNNING on that ~26B model when he asked and
  the note never got written (a model that does not call `write_memory` looks identical to one that
  does, from the chat). **Cheap first step, before any theorising:** list every
  `<project>/Agent/*.md` across his projects with mtimes and compare against when he was testing —
  a missing note is visible in one `ls`. Note that this session already found a case where a note
  landed in the WRONG project (`create_project` not opening what it made, fixed in `c785c75d`), so
  "not saved" and "saved somewhere he never looked" are different answers with the same symptom.

- [ ] **The Ollama connection picker tells the user nothing, and the enhance picker five rows above
  it tells them everything** (Fabio, 2026-09-19: *"I had no idea what to select where, so I just
  selected one of the abliterated models."*). Both live in `MpiLlmSettings`.

  | | enhance / describe backend row | the connection + Agent row |
  |---|---|---|
  | model list | curated `MODEL_REGISTRY`, each with a name and a note | raw `GET /v1/models`, bare ids |
  | is it downloaded | `Downloaded` / `Not downloaded` per model (`_ollama.models[id].downloaded`) | nothing |
  | can it do the job | n/a | nothing — and only a `tools`-capable model can be the agent |
  | nothing installed | `MpiOllamaSetup` installs Ollama, starts it, pulls the model | an empty dropdown, no error, no way forward |
  | Ollama not running | the row offers to start it | the note reads `Error: the request failed.` |

  **Why the connection row is empty-handed:** `RECOMMENDED_REMOTE_MODELS` has no `ollama` key at
  all (`services/llmEngines.mjs:346`, *"Custom and Ollama get no hints"*), and Ollama's `/v1/models`
  returns `{id, object, created, owned_by}` and nothing else — no tags, no `context_length` —
  so `listRemoteModels` yields `contextWindow: null`, `vision: null`, `recommendedFor: []` for
  every entry, sorted alphabetically. The note under the picker ("Pick a model that can call
  tools") asks the user for a fact the app can read and does not show.

  **The data already exists on this machine.** `GET /api/show` returns a capability list per
  installed model with no model load — measured 2026-09-19 on Fabio's box: `gemma-4-abliterated:12b`
  and `dolphin3-abliterated` carry `tools`; `gemma3-abliterated:12b` and `gemma3:12b` do not. So
  the picker could grey out or flag what cannot be the agent instead of letting him pick it and
  fail. `ollamaLifecycle.js` already installs, starts and pulls, so the "nothing installed" arm is
  wiring, not new machinery. Sits with fix 11 above (the keyless bug) — same connection, same row.

  **Fabio, 2026-09-19, after using it:** *"Shouldn't we have a recommended note in front of the
  selection for each one of them? Because I go to Description Model, I have no idea what to select,
  and if I have no models downloaded in Ollama, it's even worse."* So this covers **all three**
  Ollama rows — Enhancement model, Description model and Agent model — not just the agent one,
  and a recommended model that is NOT downloaded must still appear, marked, with the pull offered.
  That is the enhance row's existing `Downloaded` / `Not downloaded` treatment applied to the
  connection rows. The capability each row needs differs (`tools` for the agent, vision for the
  describer), and `/api/show` answers all of them with no model load.

  **Smaller thing, same panel, seen in his screenshot:** the Test tool use result line is not
  cleared when the Agent model changes — it still read `gemma-4-abliterated:12b` while the dropdown
  had moved to `qwen3-vl-abliterated:4b`. `_renderAgentProbe` clears it on re-render, but changing
  the model only writes `Storage.setAgentPrefs` and never re-renders that row.

- [x] **Release VRAM only ever spoke to ComfyUI** (Fabio, live, 2026-09-19: the card sat at
  15.1/16.0 GB after a Test tool use). Ollama holds a model for five minutes after the last
  request and a 12B is ~8GB of 16. `OllamaEngine.releaseOwnModels()` already existed with nothing
  exposing it. **Built:** `POST /llm/ollama/unload`, called from `js/shell/memoryOps.js` beside the
  ComfyUI unload, and deliberately never an error path — not installed / not running / already
  empty all mean "no VRAM of ours to free", and failing there would show "Unload Failed" on a
  machine that never had Ollama. **Verified live:** 3.5GB resident → route → `ollama ps` empty.

- [x] **`list_models` is ~10.8k tokens and most of it is repetition** (Fabio: *"Can we not use small
  pointers explaining more or less what each model does, so that the agent can then go in, follow
  that pointer, and actually read the rest of the model if it's the appropriate model to use?"*).
  He is right, and it is measured:

  | part | tokens |
  |---|---|
  | 21 models with their ops + `params` | 4,598 |
  | 13 flows with their fields | 2,124 |
  | core subtotal | **6,722** |
  | plus the route's guides, `fit`, media roles, `rank`/`note`, `missingDownloadGb` | ≈ 10.8k live |

  **The weight is `params`, repeated PER OP.** `krea2-nsfw` costs 512 tokens, 420 of it `params`,
  because each of its 7 ops carries the same 9 ratios, the same 2 quality tiers and the same 14
  style names — and the next model repeats most of the same list again.

  **The pattern to copy already exists in this card**: guides are pointers (`list_models` gives
  each model its guide ids, `read_knowledge` fetches one on demand). Do the same for the detail —
  a compact line per model and flow (id, name, type, installed, op names, `rank`/`note`), and a
  `describe_model(id)` that returns the `params`, field specs and media roles for the ONE thing the
  agent picked. Rough target: ~2k for the list, which is the difference between the agent being
  usable on a 32k local window and compacting on every turn. Raising `OLLAMA_AGENT_CONTEXT` is the
  wrong answer, because the KV cache shares VRAM with the weights on a 16GB card.

  **BUILT (session c7832c1f).** `compactCatalogue()` in `agentLoop.mjs` is the projection the MODEL
  sees; the route still answers in full, so the CLI, the manifest and every other caller are
  untouched, and no new route exists. `describe_model(id)` reads the same full answer and hands back
  ONE entry whole — a model or a Flow.

  | | tokens |
  |---|---|
  | `list_models` before | ~9,440 |
  | `list_models` after | **~1,449** (85% off) |
  | `describe_model krea2-nsfw` (the fattest) | ~669 |
  | first turn: the list + describing its pick | **~2,118** |

  Measured on the REAL catalogue (21 models, 13 flows) rebuilt from the data modules, not the stale
  fixture: `scratchpad/build-live-list.mjs` + `scratchpad/measure-diet.mjs`.

  **Two things fell out of doing it:**
  - **A model's note was repeated on every one of its ops** — the same disease as `params`. "anime
    and stylised art, not photography", six times. Said once about the model when every op agrees,
    kept per op when they disagree: that alone is 387 tokens of the 1,449.
  - **`guides` and `boxParams` are not dropped, they MOVE.** The loop reads them off the full answer
    itself (`_rememberGuides`), so the guide gate and the box gate still bite with the ids out of the
    model's sight. Proved by a test: the model is handed no `guides` and `generate` still answers
    `GUIDE_NOT_READ` naming the id to read.

  Rules that pointed at `list_models` for detail now point at `describe_model` (Settings, Box,
  Guide); the Model rule reads `installed: false` and `runsHere: false` off the short list. A refused
  setting (`INVALID_*`, `MEDIA_REQUIRED`) now says in its note which id to `describe_model` — the one
  failure the short list can cause.

- [x] **A note landed in a DIFFERENT project of the same name** (Fabio, live, 2026-09-19, the same
  four-sisters run; he reported it as *"I can't read the brief"* and then *"my chat is gone"*).

  What the log and the disk say, together:
  - `09:23:42 connector created project "Cowgirls" at …/Projects/Cowgirls_2cbf44b0`
  - `…/Projects/Cowgirls/Agent/project-brief.md`, **mtime 09:24** — the brief for the new project
    went into a project from an EARLIER session that happens to share the name.
  - His chip list is the proof of why: `CREATING PROJECT: COWGIRLS`, then `NOTED: …`, with **no
    "Opening project" between them**. The agent created a project and never opened it, so
    `currentProject` stayed what the app already had open, and `write_memory` wrote there.
  - His chat then "vanished" for the same reason: a conversation is keyed by project, the two
    projects are both called "Cowgirls" in the list, and neither held the conversation he remembered.

  **BUILT: `create_project` opens what it made.** There is no such thing as creating a project you
  did not want opened, and the runTurn post-step now treats a create like an open — including the
  handover, so the conversation MOVES to the new project instead of being stranded on the landing
  page. A create whose open fails answers `opened: false` with a warning rather than letting the
  model assume. The prompt lost its "open the folderPath it returns" clause in the process.

  **Left for Fabio, because it is UI:** `create_project` uniquifies the FOLDER (`Cowgirls_2cbf44b0`)
  but not the NAME, so the projects list shows two identical "Cowgirls" with nothing to tell them
  apart. That is what made a working app look like it had lost his work.

- [x] **BOTH live tests PASSED in Fabio's own app, 2026-09-19 09:45–10:00Z.** He handed the runs over
  ("you know what the tests are, I'm going to leave it in your hands") and went to other work. Driven
  over `POST /agent/message` on `:3000` — his key, his engine, his GPU, his exact wording — with
  `GET /agent/stream` followed for every tool call. Model: `Qwen/Qwen3-VL-30B-A3B-Instruct`.

  **Test 1, the four sisters** (MPI-816's closing condition, now ticked on that card):
  `create_project → list_models → describe_model(character-sheet) → read_knowledge(guide:krea-2) →
  write_memory → generate ×4 → look ×4`. Four cards landed, named *Eldest Sister — Leader*,
  *Second Sister — Sharp-shooter*, *Third Sister — Tracker*, *Youngest Sister — Wildcard*; engine
  times 47.4s / 33.8s / 33.2s / 33.3s, no error line. The first sheet was OPENED, not just logged:
  front, back and portrait panels matching the note the agent wrote before generating. Every fix
  from this session is visible in that one sequence — the create opened its project (`project.open`
  4 ms after `created project`), the note landed in the right project, `describe_model` replaced the
  fat catalogue, and the background in his message no longer turned a make-request into a brief.

  **Test 2, animating an adult image** (his `inpaint_001.png`, 832×1024 PORTRAIT):
  `look → describe_model(minimax-h3) → read_knowledge(guide:minimax-h3) → generate`, output
  **768×1344 = 9:16**, 159s, with audio. The agent's own words: *"Ratio: I matched the source's
  portrait shape with 9:16. Note that video generation will crop the original picture somewhat to
  fill this framing."* — the ratio came from `_ratioForSource`, and the trimmed Shape rule warned
  about a crop WITHOUT naming edges, which is exactly what Fabio asked for. The frame was checked:
  the rider is framed from the front with her head intact, because a portrait source on a portrait
  ratio crops the SIDES. The adult image went through the describer with no refusal and no hang.

  **Two things worth keeping from the run:**
  - On the first attempt I attached the wrong file (his app screenshot). The agent looked at it, said
    *"this is not a horse and rider scene — it's a screenshot of an application interface"*, refused
    to animate, and asked for the real picture. The Looking rule holding under a mistake is worth
    more than a passing test.
  - **My driving error, not the app's:** the video landed in `Cowgirl Sisters - Western 1876` rather
    than `fanvue`, because a generation lands in whatever project the APP has open and I passed
    `project` in the message body without calling `/connector/open-project` first. The skill already
    says this. In the real app the renderer sends its own open project, so a user cannot hit it.

- [x] **A make-request with BACKGROUND was read as "describing a project", and nothing was made**
  (Fabio, live, 2026-09-19 — the four-sisters run, which is MPI-816's closing test). He asked for four
  character sheets and added who the sisters are and that it is for a western set in 1876. The agent
  created the project, saved a brief, asked what he wanted to make first, and generated nothing.

  **It followed the rule.** The Project rule had two branches — "asks you to make something" and
  "starts a new project and tells you its goal" — and a make-request carrying background satisfies
  both readings. The background decided it.

  **BUILT:** one branch, mechanical. If the user asks for anything to be MADE, create the project,
  open it and make it **in that same turn**; background is material for the work, never a reason to
  stop — note what matters and still make all of it. Only a description with nothing asked for ends
  the turn with a question. The project is named after what they are making (this also drops the old
  "exactly New Project" line: he saw `Cowgirls` and did not object, and it is one less rule).

  **The harness case could never have caught it:** `create-then-generate` sent one bare line,
  *"Make an image of a cat asleep on a sunny windowsill."* It now carries background the same shape
  as his, and passes 3/3 on the real model. That run cost $0.0085 on his DeepInfra key — see the
  timeout item below, where the same spend may have stalled his own call.

- [x] **A generate with an empty media slot was reported to the user as started** (Fabio, live,
  2026-09-19, on `Qwen/Qwen3-VL-235B-A22B-Instruct`). He asked for a video of his cowgirl still; the
  chat said *"I've started generating the video… using the provided image as the starting frame"* and
  **nothing was generated**. The line above it was the truth: `"i2v_ms" needs image in its
  "startFrame" slot.` The model called `generate` with no `media` at all.

  **Why the user is told a lie rather than an error:** `generate` is fired and not awaited
  (`agentLoop.mjs`), so the tool answers `{ok: true, started: true}` and the model writes its
  paragraph from that. `resolveAgentMedia`'s refusal comes back from the RENDERER, one round trip
  later, and lands in `_notes` for the NEXT turn — which, in a turn that ends there, the user never
  sees. The app was right at every step; the only thing wrong was the order.

  **BUILT:** a media gate in the loop, the third of its family (guide, box, media). Before it fires,
  `_missingMedia` checks the op's required slots — read off the FULL catalogue the loop already
  keeps — and refuses in-turn: *"Nothing was generated: `i2v_ms` needs image in its `startFrame` slot
  and your call passed none. Send it again with media: [{ role: "startFrame", image: … }]. The slots
  this op takes: …"*. The model gets the correction while it can still act on it, and cannot answer
  `started` for a call that never left. Proven red first (the empty call reached the app and returned
  `started: true`).

  **This is the same root as the unowned narration bug** (four sheets reported as started after four
  failed dispatches) and it removes its commonest cause, but not the general case: any dispatch that
  fails INSIDE the renderer still resolves after `started: true`. That one is still Fabio's call
  which card it lands on.

- [x] **The crop warning named the wrong two edges** (same run). The agent told him a 9:16 video
  would crop his picture *"cutting the top and bottom portions"*. A 9:16 target is TALLER than his
  wide still, so the crop takes the LEFT AND RIGHT. The Shape rule shipped this morning described the
  right mechanism in orientation words ("a tall picture on a WIDE ratio loses the top and the
  bottom") and the model reversed it. **Rewritten as arithmetic with no orientation to flip:** work
  out the picture's W/H and the ratio's W/H, and if the ratio's number is SMALLER the sides go, if
  LARGER the top and bottom go — name only those two edges. A wrong pair is worse than silence: the
  user leaves the framing alone because the part they care about sounded safe.

  **ANSWERED by Fabio, same day: he did NOT ask for a vertical video** — he asked for his landscape
  still to be animated, nothing more. So the snap was ignored. The screenshot says why: the tool
  calls were `list_models`, `read_knowledge`, `generate` — **it never called `look`**, so it never had
  an `imageSize` to compare and picked a ratio out of the air. A rule that begins "call look and
  divide" cannot work on a model that does not call look.

  **Fabio's standing instruction, 2026-09-19:** *"Let's not give too much context to the agents when
  we can avoid it… we have to keep context to a minimum so that the user doesn't spend many credits."*
  Applied here and it is the general shape for this phase: **anything the app can compute, the app
  computes; the prompt keeps only what needs the agent's judgement or its voice.**

  **BUILT, and the prompt got SMALLER doing it:**
  - `_ratioForSource()` in the loop. No ratio named + the generation starts from a picture → the
    picture's own shape decides, in code: parse the op's offered `W:H` labels, keep the ones of the
    same orientation, take the nearest. His case now lands on `16:9`. Silent, exact, and it cannot be
    skipped the way a `look` can. The result line says which ratio it took, because otherwise the
    model narrates one it picked in its head (which is what he read).
  - The Shape rule went from **1,494 chars to 308** (~370 tokens off EVERY turn). It no longer
    teaches the arithmetic, the orientations or which two edges go — Fabio: *"instead of giving a lot
    of information to the agent, we can simply tell the agent to tell the user which parts are going
    to be cropped. There's no need to say top and bottom or left and right."* What is left is the one
    thing only the agent can do: when the USER named a ratio, say in one line that part of the
    picture will be cropped.
  - The Settings rule's start-frame sentence went with it: the code does that now.
  - `ref2v_ms` as the identity-preserving alternative is out of the prompt. Checked: `guide:minimax-h3`
    names it 8 times, and the guide gate makes the agent read that before its first H3 prompt — so it
    is not lost, it is just read on demand instead of carried every turn.

  **Fabio's heads-up, 2026-09-19:** recent disk-offload work reportedly lets 8GB cards run 200B+
  models, trading speed; he is putting an agent on it. It does not soften the line above, and the
  distinction is worth keeping when that lands: offloading **weights** is cheap — read once per
  token, in a predictable order, which is what `mmap` and streamed MoE experts exploit — while the
  **KV cache** is read *and written* every token for every layer, so it is the worst thing to put
  on disk. So that work, if it pans out, changes which MODEL the agent can run, not this constant.
  The `list_models` diet is a straight win either way and is not waiting on it.

## Plan Drift

- 2026-09-17 (Phase 4 close, session fa18265c): (9) live compaction on a 32k window compacted on
  EVERY turn after the first: the restart kept the last 4 turns whatever their size, and one
  `list_models` answer is ~9.5k tokens against a 16.4k trigger. The restart now keeps the newest turns
  (at most 4) that fit in half the trigger (same file, needed for the compaction item). (10) My
  `app:isolated` boot ran the node drift repair on the SHARED engine because MPI-800's uncommitted
  `node_lock.json` pin was in the tree (MpiNodes -> cff4c3b3 on disk; engine not restarted); MPI-800
  told (message `b800d1f7`), nothing reverted.

- 2026-09-17 (Phase 4, session 047d6088): live runs found four things no fake could, all folded in
  (same files as the card): (1) `buildDescribeInjectionParams` never sent the image (ComfyUI describe
  with a question answered empty); (2) an empty text-op answer left every caller waiting forever
  (`generationService` now calls `onError`); (3) the model guessed Head Swap boxes -> a box gate, a Box
  rule, `square` on the describe route; (4) `list_models` listed Flow fields as bare ids, so Head Swap's
  expression field got an instruction -> `fields: [{id, label}]`, step fields included. The box parser
  maps RELATIVE answers (measured), not the pixel case `mapFromDescribeSpace` assumed; that function is
  gone. Later the same day: (5) unnumbered attachments -> "picture 1" from an earlier turn -> numbered,
  sized lines + a Numbering rule; (6) H3 i2v framed a portrait start frame at 16:9 -> sizes + a ratio
  sentence; (7) commandExecutor's `Input_` pass renamed dotted keys, so the MPI-677 encoder borrow and
  `Replace Text.replace` never reached ComfyUI -> `js/utils/injectionKeys.js` (outside this card's
  files, but it decided the folded step 1d measurement); (8) `agent.install-model` awaited the whole
  download and the loop's re-read ignored `installed` -> fixed, result text says what happened.

- 2026-09-17 (Phase 3c, session 6fd51047): (1) the conversations live in a new module,
  `services/agentSessions.mjs`, so the router stays thin and D4/D5 are unit-testable. (2) The harness
  case `no-project` ("asks for a project") contradicted the new landing rule and became
  `create-then-generate`; `memory-write`'s flip changed from `project: null` (the agent may now create
  a project and save there) to a full note store. (3) The first harness run showed the model naming the
  project after the request ("Cat on Windowsill") and writing a brief note; the Project rule now says
  "exactly New Project" and "no note" for a make-something request, 3/3 after. Fabio said "New Project
  or similar", so a descriptive name is his call to reopen. (4) MPI-656 Phase 1 landed while this ran,
  which clears the Phase 4 blocker noted on 2026-09-16.
- 2026-09-16 (~14:40Z, session 6fd51047): (1) Fabio closed item 3 and chose option A for Phase 4
  (recorded under Phase 4). (2) MPI-737 routed `look` through the Image descriptions switch, so Phase
  4 measures both describers, and the Remote half needs no GPU. (3) Phase 4 order: the person images
  come first. (4) Phase 4 waits for MPI-656's Phase 1 (a live peer's uncommitted boot-path edits).
  (5) The autonomous dispatch check returned MPI-558, MPI-656 and MPI-715. After reading their plans,
  none was dispatched: MPI-715 needs Fabio's `raw/` edit plus GPU runs on MPI-711's Bernini graph;
  MPI-656 rewrites the model-root and download code Phase 4 runs against the real engine (a peer has
  since started it); MPI-558 alone is not a batch.
- 2026-09-16 (~13:45Z, MPI-737 session 5da6c574): Fabio gave his agent feedback in the MPI-737
  window after MPI-774's own session (6fd51047) closed with no changes. Folded in here, not a new card:
  the panel padding (item 3, fixed) and Phase 3c (one conversation per project; landing agent creates
  and opens projects). Phase 3c goes BEFORE Phase 4. MPI-737 also changed code this card reads:
  `/llm/enhance` now requires `backend`, and the `secretsClient` DeepInfra-key methods are gone (no
  agent caller used them).
- 2026-09-16 (Phase 3b start, session 105b3570): (1) `files.json` named the moved
  `cubric-vision/generating.md` (MPI-776 split it into `cubric-vision-generate/SKILL.md`): repointed,
  and Phase 3's unlisted files added. (2) **`.claude/` is excluded from the portable build**
  (`APP_COPY_EXCLUDES`), so the in-app agent cannot read `.claude/skills/cubric-vision*` in an
  installed app: item 2 needs a shipped copy. (3) MPI-776 offered `rename_card` + `cardName` on
  generate for the in-app agent (message `c2ccfb52`): folded into item 2 (it deletes nothing; the
  relay is already in HEAD). (4) **MPI-737 is live and holds `js/shell/agentDispatch.js`** (claim
  `2a0d4794`): item 2 adds guide ids in `routes/connector.js`, never in the relay. (5) The
  autonomous dispatch check selected MPI-513/512/560; none was dispatched: all three are umbrellas
  whose plans assign files per member at dispatch time, MPI-513's footprint missed its renderer
  consumers, MPI-512 needs live Pod work, MPI-560 needs Fabio's bench and open design.

- 2026-09-16 (harness, session e0fe3905): the harness found five loop/contract defects (see
  `validation.md`); fixing them grew the card into `js/data/generationControls.js`
  (`namedParamsFor`), `js/shell/agentDispatch.js` (`_listModels` ops carry `params`), and
  `scripts/recipe-test.mjs` (exports `runChecks`). `look` now uses the describe route's 30-min budget.

- 2026-09-16 (session e0fe3905): four items folded in before the harness. (1) The LLM provider
  section becomes SHARED with MPI-737 (coordinator message `b5952029`, Fabio); MPI-774 owns the
  connection store, probe, model list and the Agent row. (2) Fabio's gallery rework: toggle moved,
  drawer replaced by a left panel that pushes the workspace. (3) `agent:*` on the renderer bus for
  the later animation card. (4) Landing box moves beside the headline. The mascot swap is OUT
  (placeholder art until the animation card). Found while reading: `MpiAgentChat` history replay
  reads `role`, the loop writes `kind` - folded into (2).

- 2026-09-16 (Phase 3a-3c, session 7ab56409): (1) **Attachments were staged twice** — the route
  saved them for its own reply and `runTurn` saved them again, so the chat and the model held
  different ids for one picture. The route now passes its staged records in and the loop registers
  them; found while building the trust boundary, folded into it. (2) The box-bounds branch was
  **dropped rather than rebuilt** (see Current State item 3). (3) Fabio's landing rearrange was
  folded into this card: same surface W4 built, and the defect was W4's full-width band. (4) The
  wiring run added two fixes the plan did not foresee: the endpoint key now falls through to
  `DEEPINFRA_API_KEY` inside Electron as well (the `routes/llm.js` order), and the system prompt
  carries a Project rule, because the model invented folder paths rather than asking.

- 2026-09-15 (contract written): three refinements, all recorded in `docs/agent-chat.md`.
  (1) Flow box `params` stay inside the image **unless the step declares `overflow: 'allow'`**
  (both Head Swap steps do), not always. (2) `POST /agent/message` carries the renderer's open
  `project` at send time: the server holds no open-project state, and staging plus `NO_PROJECT`
  need it. (3) The describer question is ONE retitle (node 38 -> `Input_Describe_Prompt`) and the
  route injects a whole ChatML string, the `llmService.js` `Input_System_Prompt` precedent; no new
  graph nodes, and no injection keeps today's caption byte for byte.
- 2026-09-15 (Batch 1 dispatch, session 5be4be69): (1) **MPI-766 closed** (card `done`, claim
  `766c1a1e` `complete`), so W4 got the landing slot after all. (2) W3 writes the agent pick and
  W4 reads it, which would make one worker depend on the other. The orchestrator added
  `Storage.getAgentPrefs()/setAgentPrefs({profileId, mode})` (`js/core/storage.js` +
  `STORAGE_KEYS.AGENT_PREFS`, default `{profileId: 'deepinfra', mode: 'auto'}`) before dispatch,
  so both import an existing helper. (3) The fork-bridge handler and `ipcMain` channels both live
  in `main/secretsStore.js` (no preload whitelist), so W3 owns both ends. (4) MPI-677 has no live
  session; message `b59959d0` names the shared paths for whoever resumes it. (5) Workers write no
  `state/` records (four agents writing `index.json` at once would race); the orchestrator wrote
  one claim per worker and files any blocked-file messages at integration.

## Verification

**Verify mode:** user-ux (Phase 5). Phases 0, 3 and 4 and Batch 1 self-verify (`auto`); D1-D3
are settled.

Done when: every brief item 1-15 has a line of evidence in `validation.md` (the command that ran,
or the observation, beside it); the harness passes 9 cases 3/3; `connector-manifest.json` lists
only served capabilities and `npm run build:portable:dry-run` passes its assert; Fabio's pass is
recorded.

`mpi-execute-parallel` is for Batch 1 only. Phase 0 must land first; Phases 3-5 share one app
instance and one GPU.

## Preservation Notes

- `research/investigation.md` keeps the seven wrong investigator claims visible so they do not
  come back through a later brief.
- The probe script lives in a session scratchpad that expires; its command and every number are in
  `research/investigation.md`.
- At close: `docs/agent-chat.md` rewritten to current truth; `docs/README.md` routes it;
  `.claude/skills/cubric-vision/generating.md` carries the new routes. New components and events
  change the wiring maps: **ask Fabio before touching `.claude/rules/`** (component-mounts,
  component-events).
- Events to append at close: **MPI-737** (the describe route exists; its cloud backend plugs in
  behind it; question, crop and box are built), **MPI-766** (where the landing entry mounts),
  **MPI-593** (the new connector routes are the CLI surface).
- MPI-677's inherited item (the manifest's four capabilities) closes here; note it on MPI-677's
  checklist line at close.
