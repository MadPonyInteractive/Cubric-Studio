# MPI-817 Validation

Phases A and C's earlier work record their evidence in `tasks/MPI-774/validation.md`, which
this file does not repeat. What follows is the work done directly on this card.

## Fabio's first app pass on the pinned panel (2026-09-19, session ea603cb9)

He restarted the app and started the Phase 7 checklist. Three things came back before he
moved on to the MPI-820 video pass, all three now fixed. His five-step Phase 7 check itself
is still owed: he did not report on it.

### 1. Focus mode left the agent panel behind

F hid the topbar and the prompt dock, and the agent chat kept its 420px of the window.
`#agent-panel-mount` was simply not in `styles/shell/focus-mode.css`.

**It is collapsed, not hidden, and that is the whole finding.** The panel is
`position: absolute`; its siblings take their `margin-left` from
`.main-area:has(> .agent-panel-mount--open)`. `:has()` matches on DOM structure, so a
`display: none` panel still matches it: the obvious one-line fix hides the chat and leaves
its 420px gap behind, which reads as a broken layout rather than a missing rule. Setting
`--agent-panel-open-w: 0px` takes the margin with it and rides the width transition the
panel already had. `:not(.page-landing)` on the selector rather than joining the landing
`revert` block below it: a custom property cannot revert to another author rule, and
reverting this one to `unset` makes the width invalid.

`tests/desktop/focus-mode.spec.js` (new) asserts **the sibling's margin as well as the
panel's width**, because only the margin catches the `display: none` mistake. It needs the
real shell: `agent-chat.spec.js` mounts the prompt box into `#e2e-pb-host`, where
`#agent-panel-mount` does not exist.

### 2. The popup caret pointed at the model button

Fabio had asked twice for the cog to move left of the model button. Last session decided it
was "not needed" after fixing the resize bug. It was needed, and for a reason neither of us
had named: **`.mpi-popup::after` is pinned to the popup's own centre** (`left: 50%`).
`positionPopup` centres the popup on the cog and then clamps it to the viewport, and the
cog sits near the right edge, so this panel clamps left almost every time. The caret slides
with the popup and lands on the model button next door, which makes it read as the model's
popup.

The swap alone does not fix it, which is why both shipped. Moving the cog left shrinks the
overflow by the width of the model button; it does not remove it, and a narrower window
brings it straight back.

- The swap: the two `__col` divs traded places. Every grid track is `auto`, so DOM order is
  the visual order and the template is untouched.
- The root cause: `--popup-arrow-x` on the MpiPopup primitive, **defaulting to `50%`**, so
  no other owner of that primitive changes. `positionPopup` sets it after the clamp, from
  the cog's own centre, held 12px inside the popup so it cannot ride off a rounded corner.

The existing resize spec now measures caret-against-cog at both window sizes; the narrower
one is where it drifts furthest. `agent-chat.spec.js`'s hardcoded slot list was also
reordered: `.filter` preserves THAT list's order rather than the DOM's, so the list is the
only thing making the expectation mean anything about order, and it now describes the real
face left to right.

### 3. The agent writes negation into prompts, and the rule was filed under the wrong op

Diagnosed from two of Fabio's own conversations, one image and one video, same root.

**Krea2 / `t2i`, the standoff.** Three rounds lost to a revolver that would not go back in
its holster. The prompts said "not drawn", "never leaves the holster", "not held", "both
hands empty". A text encoder has no "not": each of those adds its noun and nothing cancels
it, so each retry made it worse. `docs/agent/models/krea-2.md` had the right rule and had
it filed inside the `krea2Edit` / `inpaint` paragraph, with an edit-path reason (the
reference's appearance cancels out of CFG). Fabio was on `t2i`. Worse, the negative-prompt
bullet said "state exclusions in the positive prompt instead", which reads as a licence for
exactly what went wrong.

**H3 / `i2v`, the orbit.** One conversation later, the same failure on a different model.
The camera rolled instead of orbiting; the re-run added "never rolling or spinning in place"
and "no camera roll or spin in place" **to the constraint line**, which the guide already
restricted to "rendering faults only". `docs/agent/models/minimax-h3.md` also had the rule,
also filed under one op (`ref2v_ms`). And the word the agent needed was already in the
guide's own camera vocabulary: `arc`, sitting directly beside `roll` in the same list with
nothing saying they are the pair that gets confused.

Both guides now carry a `### Say what is there, never what is not` section of their own,
each with its measured case. H3's also ties the constraint line to it (that line is where
the temptation lands on a re-run) and names the `arc` / `roll` pair, with the instruction
never to pass the user's word "rotate" through to the camera line.

**This is a documentation fix, and it is not the whole answer.** The same defect in two
guides independently says the rule does not belong in a per-model guide at all. See the two
items held for Fabio's shape in `checklist.md`: a Prompt rule in the system prompt (there is
a Settings rule, a Duration rule, a Box rule and a Shape rule, and nothing about writing the
prompt), and surfacing the agent's real prompt in the chat. Four rounds were spent
correcting a prompt he was never shown.

### 4. The agent could not tell which model made an image, and did not know it could not

Fabio's third conversation, the duck on a pony. Two runs on `ill-anime`, then he **changed
the model to Krea 2 in the pinned panel** and asked for a cartoon. The agent looked at the
existing image, replied *"the Krea 2 result came out in a cartoon style already"*, and
**generated nothing** - the request looked already met.

It knew Krea 2 was pinned: `_pinnedSettingsLine` says so verbatim. What it could not know is
what made the picture in front of it. `_appStateLine` listed bare refs, `look` reads pixels,
and the only model named anywhere in that turn was the pinned one, so it welded the two
together. The two newest sidecars in that project say `modelId: ill-anime`.

This is the `{started:true}` family for the third time in one day: the chat asserts
something the file contradicts. One root cause, both symptoms - the false claim, and the
generation that never ran because of it.

Fixed: `modelId` rides on the generate result (`agentDispatch._reportDone`), into
`_images`, and renders as `t2i_004 (made by ill-anime)`. A ref with no known origin gets no
"made by", and the line now TELLS the agent that a bare ref is unknown and must never be
attributed to the model selected now - without that sentence it fills the gap itself, which
is the whole bug. `tests/agent-loop.test.cjs` covers all three: the attribution, the absence
of a false one, and the warning sentence.

### What this says about the recipes, for Phase D

**The agent never touches the enhancer recipe.** Zero references to it in `agentLoop.mjs` or
`agentTools.mjs`; it read `docs/agent/models/illustrious.md`. So there are TWO prompt
knowledge bodies per model, and every vendor-skill merge from the 2026-08-17 survey landed
in the recipe - the one the agent never reads. Fabio reached the same suspicion from the
output side ("maybe the agent is not even using our recipe"). That is Phase D's real weight.

The Illustrious guide itself is fine: it correctly specifies Danbooru tags over sentences,
and the agent read it. The first miss was composition, fixed on retry.

## Checks

| Check | Result |
|---|---|
| `npm test` | **1420 pass, 0 fail, 1 skipped** (was 1415 before the provenance test) |
| `npm run lint:components` | clean, `--max-warnings=0` |
| `tests/desktop/agent-chat.spec.js` + `focus-mode.spec.js`, **whole files** | **30/30** |
| `tests/agent-corpus.test.cjs` | 10/10 (it enforces the no-em-dash copy rule on both guides) |

### Run the desktop specs through their own config

The first attempt reported **29 failed and exited 0**. Cause was the invocation, not the
code: `npx playwright test <file>` loads `playwright.config.js`, which has no `globalSetup`,
so no `CUBRIC_PORT` was assigned and `shellWindow` fell back to its `127.0.0.1:3000`
default and hunted Fabio's live app. Always `npm run test:desktop -- <files>`, which is
`--config=playwright.desktop.config.js`. The exit code is no guard here.

## Still owed by Fabio

- The five Phase 7 steps in `tasks/MPI-774/validation.md`. He started the pass and reported
  these three faults instead; none of the five has a verdict yet.
- Whether the `MODEL_PINNED` refusal stands, against the plan's settled "drop the modelId".
- Whether raw `injectionParams` should stop merging over pinned settings. One line.
- The shape of the two agent-prompting items above.

---

# Session c6414b8c (2026-09-19) — Fabio's SECOND app pass: the agent cannot outpaint

He ran the duck-and-pony concept again. Krea 2 t2i, then an i2i to 3D, both good and both
his own words ("that's a good one", "looks great"). Then: *"grow the top and bottom edges so
the format becomes 9:16, and after that animate it"*. **The outpaint came back as the
original picture and the animation was never made at all.** Two separate root causes, both
in the same surface, plus one he asked for directly.

## 1. The agent could not outpaint — the frame never reached it

**The evidence is the sidecar, not a theory.** `Cowgirl on a Bull/Media/.meta/274ecd5b-…json`:

```
flowId: "outpaint"
flowInputs: { mediaItems: [{ role: "image1", url: …/i2i_001.png }],
              injectionParams: { Input_is_Turbo: true } }
pixelDimensions: { w: 928, h: 1136 }      generationMs: 70467
```

No frame anywhere, and 70 seconds of GPU spent to hand back the same 4:5 shape
(`i2i_001.png` is 896x1088, the result 928x1136 — the graph's own bucket for that shape).

**Why.** Outpaint's frame is `{ kind: 'crop', role: 'image1' }` in `flowsRegistry.js` and it
has **no `param` on purpose**: the gizmo's value becomes a PADDED PICTURE (`composePaddedImage`
draws the source into a bigger black rect), so the graph loads one image that already
carries its bars and needs no pad node, no mask, no fill input. Two places dropped it:

- `_listModels` built `boxParams` from `kind === 'box'` only, so a `crop` step was invisible.
  The agent was handed a flow whose one declared field is a turbo toggle.
- `_submitFlow` handled media, fields and box params. **There was no crop branch at all.**

So the agent passed the user's unpadded picture, Krea 2 had no black to paint, and the run
reported success. Fixed on both sides, and **the refusal is the more important half**:
running with no frame was never a neutral fallback.

| | |
|---|---|
| `_listModels` | a crop step now rides as `frame: { param, role, ratios }`, `ratios` being the gizmo's own `CROP_RATIOS` labels |
| `generate` tool | `params: { frame: { ratio: "9:16" } }`, symmetric with `params.box1` |
| `validateBoxParams` | takes `frame` only on a flow that has a crop step, and only a label the gizmo offers → `INVALID_FRAME` / `UNKNOWN_PARAM` |
| `_submitFlow` | no frame on a crop flow → **`FRAME_REQUIRED`**, naming every shape it accepts. A ratio the picture already is → **`FRAME_UNCHANGED`**, rather than spending a generation on a re-render |
| the derivation | `frameRectForRatio` → the shipped `stepValueToMedia('crop', …)` → `place-preview-asset` → the padded url replaces `image1` |

**A RATIO, not a rect.** The model names the shape and the arithmetic happens in the app —
the same reason `BOX_NOT_MEASURED` exists three lines above it.

### Proven on Fabio's own picture, at the pixel, with no GPU

A throwaway desktop spec fed the real `i2i_001.png` through `frameRectForRatio` +
`composePaddedImage` in a live renderer and read the result back:

```
natural { w: 896, h: 1088 }        rect { x: 0, y: -252, w: 896, h: 1593 }
out     { w: 896, h: 1593 }        1,680,260 bytes     896/1593 = 0.5625 = 9:16
topBar [0,0,0]   bottomBar [0,0,0]   middle not black   just inside the top bar not black
```

The top and bottom grew, the width did not move, and the picture survived whole between the
bars — which is the request, verbatim. The spec was deleted after the run; the arithmetic it
proved is a committed unit test.

## 2. The agent was never told a flow's media roles

One second earlier in the same run:

```
[2026-09-19T17:39:20.846Z] [WARN] [system] connector generate failed: BAD_REQUEST
  "flowOutpaint" has no media role "inputImage". Roles: image1.
```

Model ops carry `media: mediaRolesFor(…)`; **flow entries carried none**, so it reached for
a role it HAD been told about — `inputImage` is real, on `minimax-h3-ref2va`'s `ref2v_ms`.
It learned the true one from a refusal. `GET /connector/models` now maps the flow list
through the same `mediaRolesFor` with the null model that function already takes.

## 3. It could not chain — "then animate it" had nowhere to wait

`generate` returned `{ started: true }`; the real result landed in `this._notes`, which is
read at the **start of the next turn**. A request whose second half needs the first half's
output cannot be finished at all, and the chat log shows the model working this out for
itself and then stopping. Fabio's call: **ship the await.**

`wait: true` on the generate tool awaits the same promise and returns the output, whose
`filePath` is the ref the next step passes as media. Not the default — an unwaited generate
keeps the chat answering while a five-minute video runs, which is right for a LAST step.
One `settle`, attached two ways, never both: a double report would draw the card twice.

A **Chaining rule** went in the system prompt with it, carrying Fabio's own shape — do both
halves; and for a step whose output the user will judge, wait, look, and redo it rather than
animating a bad picture, or ask and say exactly what happens next so a yes is the whole
answer. (When MPI-822 makes flows queueable this becomes queue-then-queue; `wait` is what
makes the dependency expressible either way.)

## 4. `A` opens and closes the agent (asked for directly, same message)

`agentMode.toggle` in `hotkeyRegistry.js`, bound in `initAgentPanel()` — not on the
PromptBox's toggle button, which is remounted on every workspace switch while that service
is app-lifetime. Both sides already meet at `state.agentMode`, so the button's own
`onState` listener repaints it and nothing else needed wiring. `allowWhileTyping: false`,
and the hotkeys page carries the row.

## Checks

| Check | Result |
|---|---|
| `npm test` | **1430 pass, 0 fail, 1 skipped** (1421 before; 9 new), exit 0 |
| `npm run lint` + `lint:components` | clean, `--max-warnings=0` |
| `tests/desktop/focus-mode.spec.js`, whole file | **2/2**, including the new A-key case |
| `tests/desktop/agent-chat.spec.js`, whole file | **29/29** |

### Mutation guards — broken in the REAL source, run, restored byte-identical

| Mutation | Result |
|---|---|
| `if (hasCrop) knownParams.add('frame')` → `if (false)` | 1 failing |
| `frameRectForRatio`'s grow axis inverted (`<` → `>`) | 2 failing |
| `if (args.wait)` → `if (false)`, every generate fire-and-forget | 1 failing |

All three restored with a matching sha256. Script:
`scratchpad/mutate.py` (throwaway).

## LIVE in Fabio's app (2026-09-19 19:06-19:11Z, read by session a018e069)

His own request, one message: *expand this image up and down to 9:16, then do a video where
the duck pulls the reins, the pony lifts its front legs and the duck says "Ayoo, silver,
away!"* All three fixes ran, chained, with no refusal in `app.log`. His verdict: 🎉🎉🎉.

| Fix | Evidence on disk |
|---|---|
| The frame | sidecar `8f711272-….json`: `image1` is now `Media/.preview-assets/d8d5b009….png` (the PADDED picture, not `i2i_001.png`), and the graph logged `_fit_encode_image … in=(1, 1360, 768, 3)`. Output `flowOutpaint_002.png`, **768x1360**, 68.7 s. The 18:40 no-op beside it is 928x1136 |
| Media roles | no `BAD_REQUEST … no media role` line anywhere in the run; `image1` first time |
| `wait` chaining | `generation.submit` 19:06:34 → `Prompt executed` 19:07:43 → `agent.describe` → second `generation.submit` 19:08:02, whose sidecar (`990cbfa0-….json`) carries `flowOutpaint_002.png` as `startFrame`. `minimax-h3` `i2v_ms`, 768x1344, 193 s. The LAST step was left unwaited, as the Chaining rule says |

Pixels checked, not just metadata: the outpaint invented sky above and meadow below with the
subject whole between them, and a four-frame sheet of `i2v_005.mp4` opens on the outpainted
frame and has the pony reared by frame 48.

**One fault surfaced by the same run, and it is MPI-820's, fixed there:** the chat said
"about 6 seconds" and the card said 3S. See `tasks/MPI-820/validation.md` § The THIRD half.

---

# Session a018e069 (2026-09-19, evening) — his THIRD pass: memory, a lie about a failure, and `list_cards`

## 1. `fetch failed`: the agent was told a finished render had failed, and re-ran it

His 6 s clip took **337 s**. The chat printed `fetch failed`; asked next to extend the clip,
the agent answered *"The previous attempt failed … no clip was ever created"* and **started
the same five-minute render again**, with `i2v_006.mp4` sitting on disk. The `{started:true}`
lie in mirror image: the app said failed, the file said otherwise.

**Root cause, measured rather than argued.** `services/agentTools.mjs` posted with Node's
`fetch` and a 30-minute `AbortSignal`. `fetch` drops any response whose HEADERS take over
300 s whatever the signal says, and `/connector/generate` holds its response for the whole
render. A loopback server answering at 310 s, both clients, same signal:

```
fetch FAILED at 304.9s: fetch failed / cause=UND_ERR_HEADERS_TIMEOUT
http  OK {"ok":true} at 310.0s
```

It fits the day exactly: the 193 s clip passed, the 337 s one did not. Nothing was logged;
the 30-minute budget in that file's comments had never been reachable. `_post` is now
`node:http` (no new dependency: the undici bundled in Node is not importable, so the
`headersTimeout` dispatcher route was not available).

**Not fixed, same trap, other subsystem:** `services/llmEngines.mjs` gives Ollama
`OLLAMA_CHAT_TIMEOUT_MS = 600_000` through the same `fetch`, so its real ceiling is also
300 s. Its tests stub `global.fetch`, which is the next section's lesson.

## 2. That fix made `npm test` reach his LIVE app — caught, cleaned, belted

`tests/agent-no-delete.test.cjs` walks every table function with dummy `__ARG__` arguments
behind a `globalThis.fetch` stub. With the POSTs off `fetch` the stub covered nothing, no
`CUBRIC_PORT` was set, and they went to the default port: **127.0.0.1:3000, his running
app.** `app.log` 19:42:06Z: `created project "__ARG__"`. Everything else was refused by its
route (400 on the body, `NO_SUCH_PROJECT`, `NO_SUCH_CARD`); his open project and his running
2 s render were untouched. Three empty dirs it left in the repo root are removed. **The
`__ARG__` project itself is his to delete** (landing page, right-click, Delete project).

- The test now runs against a server it owns (port 0, `CUBRIC_PORT` pointed at it), so it is
  blind to the transport AND cannot leave the process. It also asserts a POST was recorded:
  the stub's other broken promise was that it saw every request.
- `loopbackBase()` throws when `CUBRIC_PORT` is unset under `NODE_TEST_CONTEXT`. Proven by
  the re-run: Projects folder 48 → 48, no new `__ARG__` line in the live log.
- `routes/connector.js` `_appPost` carries the same `|| 3000` default and no belt. Noted.

## 3. `list_cards` — the agent can see the project it is sitting in (Fabio: "go")

His memory test: after a restart, asked to redo the duck clip, it said *"I can't see the duck
image in this turn"* in a project of eighteen cards, read a skill written for agents with
disk access, listed his other projects, and he attached the picture by hand. `_images` is a
per-SESSION allowlist (attachments + that session's results); nothing listed the project.

| | |
|---|---|
| `services/agentCards.mjs` (new) | `listCards`: newest first, one short row a card (name, ref, kind, model or flow, op, size, a clip's REAL length, 200 chars of prompt). `readCard`: one in full, whole prompt, settings that ran, `madeFrom`. Two hops on purpose, his progressive-disclosure rule |
| routes | `GET /connector/cards[/:groupId]?folderPath=`, off `project.json` + `Media/.meta/`, no renderer |
| tool | `list_cards { groupId?, limit? }`, the OPEN project only. Every ref joins the allowlist, so `look` and `generate` take it, **a video included** - which is also the answer to "extend this clip" |
| the boundary | a sidecar is untrusted JSON: a path outside the project's own `Media/` (or a `..` climbing out of it) gets NO ref. The allowlist exists because `look`/`generate` ship the file to an engine that may be a remote Pod |
| prompt | a Cards rule (look before saying you cannot see it; **check before redoing a run that reported a failure**), and the App state line no longer lets "Images: none" read as "the project is empty" |

Run read-only against his real project: 18 cards, 6 rows = 2.3 KB, `i2v_006.mp4` first, and
`readCard` on it gives `Input_Duration: 6` and its start frame. One call would have answered
"no clip was ever created".

## Checks

| Check | Result |
|---|---|
| `npm test` | **1462 pass, 0 fail, 1 skipped** (1439 at the start of the session) |
| `npm run lint` | clean |
| `tests/agent-cards.test.cjs` (new, 7) | pass, incl. the hostile-sidecar case and the loop case: `look` refuses the ref BEFORE `list_cards` and resolves it after, and no absolute path reaches the model |
| `tests/agent-tools-post.test.cjs` (new, 3) | pass. Stubs `fetch` to THROW, so a revert to `fetch` goes red |
| `tests/agent-no-delete.test.cjs` | pass on its own server, with the two read-only routes allowlisted |

**Not live-verified:** `list_cards` and the `_post` transport both need an app RESTART and
have not run in his app. The route, the service and the loop were each driven for real in
tests; the agent actually CHOOSING to call `list_cards` is the part only a live turn shows.

## Still owed by Fabio, after this session

- ~~A live outpaint.~~ **Done 2026-09-19, see § LIVE above.**
- The five Phase 7 steps and MPI-820's clip check, still unverdicted from the last session.
- `MODEL_PINNED`, raw `injectionParams`, and the two held agent-prompting items — unchanged.
- **Fault 4 of his report is NOT fixed and was not in scope:** the agent's deliberation
  reaches the chat verbatim ("Let me check if there's anything else I should prepare.
  Actually the generation is async…"). Intermediate assistant content is rendered as it
  arrives. Either a prompt rule or a collapsed disclosure in the chat — his shape to pick,
  and the same argument as the two held items.

---

# FOURTH pass, 2026-09-19 20:15Z (session 40e3efaf) — `list_cards` live, and "the last one"

CI first: the first master run containing `1f3bd9fd` (on `dce8c096`, run 35465610648)
finished **success**, `tests: success`. It had reached origin on a peer's push without its
own gate run.

## `list_cards` ran in his app: called, and the wrong card picked

His message, nothing attached: *"using the same image that you used for the last video that
you created, can you instead make the duck look at the camera and say quack quack?"*

Step log: Looking through the project → Reading a project note → Reading a card → Reading
minimax-h3's settings → Reading: guide:minimax-h3 → Starting generation → Noted. No "I can't
see the file". **That is the stated pass for `list_cards`.** `app.log` 20:15:12Z
`agent.list-models`, 20:15:31Z `generation.submit` (job 3bfc8c86).

His finding: it used the frame of the video BEFORE the last one. Ground truth, read off the
sidecars by `createdAt` (their mtimes are useless: all rewritten 19:56Z by a peer's wave pass):

| clip | createdAt | startFrame |
|---|---|---|
| `i2v_008` "Duck quack quack at camera", 3 s — THE RUN IN QUESTION, landed | 20:18:51Z | `a3a74166…png` = `i2v_006`'s frame, not `i2v_007`'s. His observation, confirmed on disk |
| `i2v_007` "Duck looks at distant horse", 2 s, agent job bcb8ca73 | 19:43:13Z | `87bcbd82…png` (the solo duck) |
| `i2v_006` "Duck pony runs", 6 s | 19:30:17Z | `a3a74166…png` (the outpainted duck-on-pony) |

`listCards()` run read-only on his project returns `i2v_007` as ROW 1, so the route and the
sort are right. The agent then read `Agent/duck-riding-pony.md`: *"Base image for all
animations: … flowOutpaint_002.png"*, variants ending at "Duck pony runs". `i2v_007` is in no
note. It answered "the last video" from the note and said so: *"the same frame from the last
video (… that fed both Duck pony runs and this one)"*. The Cards rule ranked a card over
memory for what RAN and said nothing about which one is LAST.

**Fix:** one sentence pair in the Cards rule — "the last / the latest / the one before" is the
list's order, newest first, counting what the user made by hand and what the agent made in a
conversation it no longer remembers; a project note never answers it.

## The ratio-snap narration

The result line was `Ratio 9:16, taken from the picture's own shape.` It now reads
`Ratio 9:16: the nearest to the picture's shape of the only ratios this model makes (<the
op's list>). It cannot make the picture's own size or any ratio outside that list, so never
offer one.` Built once (`snapNote`), used by both the started and the waited result.

## Checks

| Check | Result |
|---|---|
| `node --test tests/agent-*.test.cjs` | **150 tests, 149 pass, 0 fail, 1 skipped** |
| `tests/agent-loop.test.cjs` | the snap case asserts the whole list is in the message and that a user-named ratio gets no note; a new case pins both Cards-rule sentences |
| `npx eslint services/agentLoop.mjs tests/agent-loop.test.cjs` | clean |
| Live Projects folder before/after the run | 48 → 48 |

**SUPERSEDED by § FIFTH pass below — all three ran live after his 20:46:47Z restart.**
Written before it: the recency sentence (re-ask "the same image
as the last video" — pass is the frame of whatever row 1 is), the snap note (a 3:4 picture
into H3, no offer of 768x1024), and **still the `_post` fetch fix**: this pass's clip was 3 s
= ~193 s of render, under the 300 s limit. It needs a 6 s H3 clip (~337 s).

---

# FIFTH pass, 2026-09-19 20:48-21:02Z — all three ran live, on the uncommitted tree

`app.log`: `Server started` **20:46:47Z**, after the edits above, so the restart loaded them
(`services/` is served from the tree). Three asks, three `generation.submit`, no re-run:

| submit | landed (sidecar `createdAt`) | response held | clip | startFrame |
|---|---|---|---|---|
| 20:48:26Z job 5b1a3a46 | 20:53:17Z `i2v_009` | **291 s** | 5 s "Duck quack quack at camera" again | `a3a74166…` = `i2v_008`'s |
| 20:49:59Z job 977cf947 | 20:56:52Z `i2v_010` | **413 s** | 4 s "Duck unmounts pony" | `9e9e3301…` (attached: Duck riding a pony v2) |
| 20:51:30Z job b7520db2 | 21:02:08Z `i2v_011` | **638 s** | 6 s "Duck unmounts pony Krea" | `52a6d66b…` (attached: Krea v3, 896x1088) |

- **`_post` (node:http): PROVEN.** Two responses were held past Node fetch's 300 s headers
  limit (413 s, 638 s — queue wait counts, the route holds for the whole job) and both came
  back: his screenshot shows all three result thumbnails in the chat and no red `fetch
  failed`. A loopback failure never reaches `app.log`, so the chat is the evidence, not the log.
- **Recency: PASS.** "Can you repeat the last video but make it slightly longer" → Looking
  through the project → Reading a card → it NAMED "Duck quack quack at camera" (`i2v_008`,
  row 1), reused its frame and prompt, asked 5 s for 3. It did not open a note this time. The
  frame alone would not discriminate (`i2v_006` shares it); the card name and the prompt do.
- **Snap note: no bad offer.** Two portrait sources that H3 has no ratio for (896x1088) went
  to 9:16 and neither narration offered another framing. The tool result itself is not
  visible in the chat, so this is "the symptom did not recur in two runs", not a read of the line.
- **Duration held:** "slightly longer" → 5 s, unasked → 4 s, "make sure it's 6 seconds" → 6 s,
  and both long ones got an extra beat rather than an idle tail.

Noticed, not built: *"I'll let you know the actual length when it lands"*, twice. It cannot —
a result reaches the model at the start of the NEXT turn. On the checklist.

---

# SIXTH, 2026-09-20 — the promise it cannot keep (built, NOT live-seen)

CI first: run 35469616004 on `cddd86f1` = success, and the three master runs after it.

Mechanism, read not guessed: a generation that finishes after the turn lands in `this._notes`,
which `services/agentLoop.mjs` reads at the START of the next turn (comment at the `_notes`
write). Nothing lets the agent open a turn, so "I'll let you know when it lands" is false by
construction. The Duration rule told it what to say BEFORE the answer is back ("I asked for N
seconds") and nothing about AFTER, which is the hole the promise filled.

Edit: one sentence appended to the Duration rule — never promise to report back, you never
speak first, a generation that finishes after your turn reaches you only when the user writes
again; say the card will show the real length and that they can ask then.

- `node --test tests/agent-*.test.cjs` → 151 tests, 150 pass, 0 fail, 1 skipped (the LIVE
  DeepInfra test, no key in the agent shell — skipped before this change too).
- New test `the Duration rule forbids promising to report back…` passes; the pre-fix source
  has 0 matches for its first regex (`git show HEAD:services/agentLoop.mjs | grep -c`), so it
  is red on the old rule.
- `eslint services/agentLoop.mjs tests/agent-loop.test.cjs --max-warnings=0` → clean.
- `docs/agent-chat.md` does not quote the Duration rule; no doc edit owed.

**Owed by Fabio's eyes:** restart the app (`services/` loads at boot), ask for one clip WITHOUT
a chained second step (so it is not waited), and read the narration: it should say "I asked
for N seconds" and point at the card, with no "I'll let you know". An LLM's choice cannot be
unit-tested; the test pins the sentence, the pass is the proof.

**LIVE, 07:16Z, his screenshot (first text-to-video ask, new project "Anime Kids and Dog"):**
`app.log` `Server started` **07:15:08Z**, after the 07:05Z edit, so the restart loaded it. One
non-waited H3 t2v clip, job 1eff025f `generation.submit` 07:16:02Z. Narration, verbatim: *"I
asked for **6 seconds** to give the play room to unfold. The card will show the real clip
length when it lands — note that's what the run actually produces, which may differ slightly
from what I asked for. If it comes back and you'd like it longer ... just say so and I'll redo
it."* No "I'll let you know". **PASS** - one run, so "the symptom did not recur", same weight
as the snap note.

Same screenshot, the cosmetic fault reproduced: the step log reads Starting generation →
Reading: guide:minimax-h3 → Starting generation, against ONE `generation.submit`. The first
"Starting generation" is the refused `GUIDE_NOT_READ` call. Still open on the checklist.

**The clip landed (`t2v_001`), his verdict: good, the prompt achieved the result.** First
text-to-video through the agent. Sidecar `ff7a05d8…json`: `modelId` minimax-h3, `operation`
`t2v_ms`, `Input_is_Turbo: true`, `qualityTier: medium`, `Input_Duration: 6` → real
`duration: 5.875` at 24 fps, 1344x768, `Ratio_Label` 16:9 (no source, so no snap),
`generationMs` 325869 (5 m 26 s). Turbo + medium is the Auto-mode line in `agentLoop.mjs`
("For video: use qualityTier 'medium' and turbo: true"), not a guess by the model. The
response was held **~326 s**, past Node fetch's 300 s limit, and the thumbnail landed in the
chat with no red line: the `_post` fix holds on the t2v path too. The card reads 6S for 5.875.

His correction, same hour, so nobody misreads "good": the AGENT's half was right (prompt,
movement, settings). The clip still had to be repeated because the MODEL morphed. That is a
re-roll, not an agent fault - and a re-roll at 6 s costs 5 m 26 s each. His point: 2-3 s was
his default for exactly this reason, and the Duration rule sends the first render of an
unseen idea straight to full length. A draft/final split was proposed and he TURNED IT DOWN
("if I said something that needs more time, the agent can't possibly fit it into 2 seconds").
His rule instead: 2-3 s is the default, go above it only when the request cannot fit.

---

# SEVENTH, 2026-09-20 — "1K" got 1664x960, and a single action got 6 seconds (built, NOT live-seen)

**1. The resolution (urgent, his word).** He asked "redo it in 1K" expecting full HD. Both
sidecars: `t2v_001` `qualityTier: medium` 1344x768; `t2v_002` `qualityTier: high`
**1664x960**, 2 s, turbo, 212.7 s. The agent's own words: "bumped the quality tier up to
high, which gives the ~1K resolution". Root cause, read not guessed: `GET /connector/models`
→ `namedParamsFor` handed it `qualityTiers` as bare NAMES (`very_low … high, very_high, 2k,
4k`) and no pixels anywhere, so a resolution could only be matched on how a name sounds.
1920x1088 is `very_high` (`js/utils/ratios.js`). The route, the tier table and the injection
are all correct; the agent was never told what a tier IS.

Fix at the source: `namedParamsFor` returns `tierSizes: { [tier]: { [ratio]: 'WxH' } }`, built
in the loop that already walks tier x orientation x ratio (572 chars for an H3 op). Settings
rule: a tier's name is not its size, match a named resolution on `tierSizes`, "1K, 1080p and
full HD all mean 1920 on the long side", say the real pixels. `docs/agent-chat.md` route shape
updated. NOT changed: the tier names themselves, and the UI.

**2. The duration.** The old rule named "a sustained action, a camera move that travels" as
what earns seconds, and the agent's prompt was "running … gentle tracking camera" → 6. New
rule: the default is 2 to 3 seconds; ONE continuous action is 2-3 s however long it could go
on (his examples: kids and a dog, a man enters a bar); what earns more is a SEQUENCE (his
coffee-shop example) or a line too long to say in 3 s. His two measured anchors stay, the 6 s
one reworded as "a second stage". "The user naming a length always wins" untouched.

- `node --test tests/agent-*.test.cjs tests/connector-*.test.cjs` → 255 tests, 254 pass,
  0 fail, 1 skipped (the LIVE DeepInfra test, no key).
- New: `tierSizes gives the real pixels…` (H3 `high` 16:9 = 1664x960, `very_high` =
  1920x1088 / 1088x1920, and on EVERY model+op a size only for an advertised tier and ratio,
  no tier left unsized); `the Duration rule defaults to 2-3 seconds…` (also asserts the old
  sentence is GONE); `the Settings rule matches a named resolution on tierSizes…`.
- eslint on the four changed code files → clean.

**Then TRIMMED, same hour, on his word ("always better to remove than to add").** Measured:
the 16 rules were 10,462 chars at HEAD and 11,562 after the two fixes above (+10.5%), with
the Duration rule the biggest in the prompt at 1,958. Rewritten to 1,011 (under its 1,212 at
HEAD) and the Settings sentence 354 → 205: total **10,466, net +4 chars for three behaviours**.
Cut from Duration: the "both misses are failures" paragraph, the 6 s anchor, the measured
5 m 26 s anecdote. A test now fails if the Duration rule grows past 1,212 again. `tierSizes`
costs 572 chars per H3 op, 1,144 for the whole `describe_model` answer, and only on that call.
**His three tests ran against the LONG text** (loaded at his restart, before the trim), so a
pass proves the idea, not these words: the trimmed text needs one more restart.

**LIVE, 07:58-08:04Z, on the LONG text (his chat, pasted; sidecars + `app.log`):**
- **1K: PASS.** "Redo the latest video in 1K" → `very_high`, **1920x1088**, 2 s, 259.7 s, and
  it named the pixels and the tier ("long side 1920"). Same seed 742897577 as `t2v_002`.
- **Single action: PASS.** The cowboy got 3 s, "one clear 3-second beat".
- **Sequence: PASS.** Four cuts got 10 s, "a real sequence ... rather than a single 3-second
  action". It said why, unprompted.
- **NEW FAULT, his words "I did not ask for the last two to be 1K":** the 1K he asked for on
  ONE redo stuck to the next two unrelated clips ("matched to your 1K request from before"),
  so a 3 s and a 10 s render went out at 2.09 MP and he cancelled both. The Settings rule
  said "raise one only when the user's own words asked for it" and never said for WHICH
  clip. Reworded, no new sentence: default for EACH new clip, their words for THAT clip, what
  they asked on one clip never carries to the next, only a redo keeps its card's settings.
  Pinned. Rules total 10,597 (+135 over HEAD). NOT live-seen: built after his 08:05:51Z
  restart, which loaded the TRIMMED text but not this.
- Noticed, not built (narration, his call under "remove, don't add"): it said the 1K redo
  kept "the same seed so the scene comes back the same way" - false, a different canvas is a
  different latent shape and a different sample (`js/utils/ratios.js`). And after the
  medium redo: "both are now re-rendered" while they were still rendering, and an offer to
  "drop them to the base 1344x768 tier", which is the tier they were already at.

**Owed by Fabio's eyes, ONE restart covers both** (`js/data/` is renderer, `services/` is boot):
1. "Redo it in 1K" (or "full HD") on the H3 clip → the card should read **1920 x 1088**, and
   the agent should name those pixels. Cost warning from `ratios.js`: `very_high` is 2.09 MP,
   measured 3.3x the time of native per frame - ask for 2 s.
2. A fresh single-action ask ("a man enters a bar") → 2 or 3 s, not 5-6.
3. A real sequence (the coffee-shop one) → it should still go longer, and say why.

**LIVE AGAIN, 08:09-08:24Z, on the TRIMMED text** (`Server started` 08:05:51Z, after the
07:50Z trim; a fresh conversation, so no "1K" in its history). His verdict: "a success".
- "A cyberpunk cowboy ... all he does is take off his hat and look at the camera" → job
  9692f33e, `Input_Duration: 3` → 3.042 s, medium 1344x768, turbo, 167 s. Narration: "one
  continuous action ... asked for 3 seconds ... the real length will show on the card".
- The fire-truck sequence, four shots → job 31453f08, `Input_Duration: 10` → 10.125 s,
  medium, turbo, 587 s (held past 300 s again and landed). Narration: "a genuine sequence
  (four beats that must happen in order), I budgeted around 10 seconds rather than the
  usual 2-3".
So the 1,011-char Duration rule does what the 1,958-char one did: **the trim cost nothing.**
Both came out at medium, which is the default and NOT proof of the per-clip fix: that was
built after this restart, and this conversation never asked for 1K.

---

# EIGHTH, 2026-09-20 — what never landed survives a restart (built, NOT live-seen)

Live, ~08:06Z: he closed the app on two running clips (cowboy, fire truck, both the medium
redo), reopened, asked "do you remember those? can you requeue those?". The agent listed the
project, found three park clips, and said honestly it had no trace. Correct, and useless: D6
keeps a conversation in memory only, and a clip that never lands leaves no card and no sidecar.

Three designs were on the table and HE cut them down, in this order, do not re-offer the
first two: (1) persist + reload the whole conversation - refused, a restarted project would
start with a big context; (2) an archived digest of the conversation the agent can read -
refused, "the user might talk a lot of crap that never amounts to anything"; (3) his: landed
generations already carry their prompt, ONLY cancelled / never-finished ones do not. Built (3).

`AgentLoop._trackUnfinished(project, args, status)`: at submit (after the early-refusal
window, so a refused call is never recorded) it writes the agent's own `generate` args to the
project note `unfinished-generations.md`; `settle` removes it on a landing and stamps the
error code otherwise; `settleThrow` stamps RUNTIME_ERROR. Keyed on model + prompt, so the
cancelled 1K cowboy and its medium redo are ONE entry with the newer settings. Serialised
through one promise chain (two submits landed 1 s apart this morning). It is an ordinary note:
the first message already lists it with a hook ("2: Cyberpunk cowboy, Fire truck crash"),
`read_memory` already reads it. **No new tool, no new route, 0 chars of prompt.** An empty
note is filtered out of the listing, so a project with nothing unfinished pays nothing.

- `tests/agent-loop.test.cjs` → `a generation that never landed survives a restart…`: submit
  with a promise that never settles → the note holds the EXACT call, status `running`, none
  of the chat; a NEW loop on the same store hears the hook in its first message; the requeue
  lands → hook `none`; a third loop's first message has no line for it; a cancel stays.
- Smoke against the REAL store (`services/agentMemory.mjs`, scratch project, script in the
  session scratchpad): four 1.5 KB prompts → the newest 2 kept in 3,424 bytes (note cap
  4,096); a fresh loop hydrated from the file, landed one, the other survived; the real
  `_projectNotesLine` printed `unfinished-generations.md: Generations that never finished
  (1: Clip 3)`.
- agent + connector tests: 256, 255 pass, 0 fail, 1 skipped (live key). eslint clean.

Known ceilings, all deliberate: ~2 fire-truck-size prompts or ~8 short ones fit one note,
oldest drop first; an entry nobody requeues lingers until pushed out; the landing-page
conversation has no project, so nothing is kept for it; a requeue of an image-to-video after
a restart still has to find its frame through `list_cards`, this note only holds the ref.

**Owed by Fabio's eyes:** restart; ask for one clip; close the app while it renders; reopen;
"requeue what I lost". Pass = it names the clip from its first message, reads the note, and
sends the same prompt and settings with no questions. Then let it land and check
`<project>/Agent/unfinished-generations.md` reads "Nothing unfinished."

## LIVE PASS 2026-09-20 19:02Z — Phase E and the video hand-off, in ONE message

Fabio, in his own app after a restart (ComfyUI up 19:01:24Z), a video chip in the agent box and
one message: *"Can you convert this video into a GIF and remove its background so that only
the duck is visible?"* His words after: "I did it all in one go, and it worked quite nicely."

- `app.log`: `Agent job 90b03c89…: gif.make` at 19:01:51.873Z, then
  `Agent job e10d7af2…: gif.cutout` at 19:02:04.420Z, ComfyUI `got prompt` 1.7 s later loading
  SAM3 — so it chose `method: "name"` for "only the duck". No error line, no `threw`.
- The chat went straight to MAKING A GIF with NO `list_cards` step first: the ref and its item
  id arrived with the attachment, which is the by-reference hand-off working end to end (drop
  guard, send, route, loop). Both results drew in the chat; the cut-out landed as an entry on
  the same GIF card, as designed.
- The honest-limit held with no prompt line: *"Give it a look to confirm the edges hold up
  in motion."* It did not call the cut-out good.

Closes: checklist "Phase E" and "A video cannot be handed to the agent". NOT covered by this
run: `edit_gif`, `gif_to_video`, a dropped Explorer FILE (he used a card), and all of Phase F.

## Phase E — the agent's four GIF tools (2026-09-20, built; live pass above)

`make_gif` / `edit_gif` / `cutout_gif` / `gif_to_video` over MPI-830's routes. The model says
`ref`, never an item id: `list_cards` and a finished generation put the SHOWING version's
`itemId` on the `_images` entry, and the tools look it up there. A ref with none is
`NOT_A_CARD` and no route is called.

- `tests/agent-cards.test.cjs` → `the GIF tools turn a ref into the item id the card is
  SHOWING…`, on a real project folder: a cold ref reaches no route; `video: i2v_006.mp4` is
  sent as `videoItemId: item-clip`; a card with `selectedIndex: 1` sends `item-still`, not the
  first in its history; both sources at once is `BAD_REQUEST`; the make reply's ref feeds
  `cutout_gif`, whose reply feeds `edit_gif`; `edgeColour: "opaque"` is sent as `null`; the
  model's copy of the output has no `itemId` while the chat's result card keeps it; `make`
  joins `_groups`, a cut-out on a card already there does not.
- `tests/agent-no-delete.test.cjs`: four routes added on purpose, with the reason.
- Full suite: 1582 tests, 1581 pass, 0 fail, 1 skipped (live key). eslint clean on the five
  files touched.

**Owed by Fabio's eyes (restart first — `services/*.mjs` is server code):** in a project with
a video card, ask the agent in your own words to turn it into a GIF and remove its
background. Pass = a GIF card lands, a transparent entry lands on that same card, both show
in the chat, and the agent says the motion needs your eye instead of calling it good. Proof
line in `app.log`: two `Agent job <id>: gif.make` / `gif.cutout`.

## LIVE ROUND 2026-09-20 19:07–19:12Z — Phase F, Fabio's own app, his words pasted back

`app.log`: `gallery.visible` 19:07:18Z, `card.mark` 19:10:40Z, `gallery.visible` 19:12:04Z. There
is NO `card.rename` line: the four refusals happened in the loop and never reached the renderer.

| His ask | What ran | Verdict |
|---|---|---|
| "give names to all the square and triangle cards that don't have a name yet" | `visible_cards` → 4 × `rename_card`, ALL refused `UNKNOWN_CARD` | It FOUND exactly the four. **The refusal was a bug, fixed below.** |
| "mark the latest card with a circle" | `mark_card` → `dot` on `gif_001` | PASS. "circle" reached `dot` from the tool description alone. |
| "From the stuff I'm looking at... is any of these an image?" | `visible_cards` → "filtered to Squares, 5 cards", 4 videos + 1 image, by name | PASS. The filter came back in the panel's own words, the set was the grid's. |
| Landing page: "How many videos am I looking at?" | no tool call; said the gallery is not on screen, offered to list once a project is open | PASS on the rule (it did NOT fall back to a project). The answer rambled and wrongly said a listing cannot tell a video from a still. |

**Fixed from this round:** `rename_card` was gated to cards this conversation GENERATED — a gate
from before `list_cards` existed. A card the app LISTED is now nameable (`_seeCards` adds its
`groupId`); an id it was never shown is still `UNKNOWN_CARD`. Test: `agent-card-marks.test.cjs`
→ `the loop: …`. And `visible_cards` now says each row's `kind` tells image from video with no
`look`, for the confused landing answer. Tool-description changes only; no prompt line.
82 agent tests pass, 0 fail, lint clean. **The rename fix is NOT live-seen** (server code:
restart, then repeat the first ask).

## Phase F — marks and the visible set (2026-09-20, built; live round above)

`list_cards` rows carry `mark` and take a `mark` filter; `mark_card` sets or clears one;
`visible_cards` returns what the gallery grid is SHOWING, in its order, with the filter in
the panel's own words. The renderer names the ids, the route builds the rows off disk.

- `tests/agent-card-marks.test.cjs`, six tests on a real project folder and the REAL router
  with a fake renderer: a legacy `favourite: true` reads `dot`, an unmarked row has no `mark`
  key, `mark=circle` is `BAD_REQUEST`; the visible set keeps the RENDERER's order and returns
  an ARCHIVED card `/connector/cards` never can, drops an id disk does not have, `limit=1` is
  the grid's first with `total` still 2, `folderPath` never leaks; `GALLERY_NOT_OPEN` returns
  no cards at all; `card-mark` relays `false` for a clear and 400s a non-string; the loop
  sends `"none"` as `false` and registers a visible card's `ref` with its item id; the
  renderer handler is pinned to the grid's own `matchesGallerySort` / `byGalleryOrder`.
- `tests/agent-no-delete.test.cjs`: both routes added on purpose, with the reason a cleared
  mark is not a delete.
- Full suite: 1588 tests, 1587 pass, 0 fail, 1 skipped (live key). eslint clean on all nine
  files touched.
- NOT covered by a test, only by the live check: `_markCard` / `_visibleCards` running in the
  real renderer (the module cannot load under Node), and the card repainting its mark.

**Owed by Fabio's eyes (same restart):** mark a few cards by hand, some triangle, some circle.
(1) "Name all the triangle cards" → exactly those. (2) "Mark the newest video with a square" →
the square appears on the card at once, and the filter panel finds it. (3) Filter the gallery
(say videos only + triangles) and ask for something on "the cards I'm looking at" → it says
the filter back in the panel's words and hits exactly the grid's set, top one first.
(4) From the landing page or a card's history view, ask the same → it says the gallery is
not on screen and does NOT act on the whole project.

## A video handed to the agent (2026-09-20, built, NOT live-seen)

His report, second time: "I can't send videos to the agent" (toast: "Media type not supported
for this model"). Root cause, two gates in series, both fixed:

1. `MpiPromptBox.js` `_maxMediaForCurrentOperation`: agent mode returned 0 for anything but
   an image, so a dragged card, a dropped file and "send to prompt" all died at the toast.
   Now a video is accepted once a project is open (`AGENT_MAX_VIDEOS = 2`), and the toast
   in agent mode says what the agent takes instead of blaming a model.
2. Transport: `_sendAgentTurn` only gathered image chips, as base64 data URLs, into a stager
   that takes JPEG/PNG/WebP. A clip is NOT sent as bytes. With a project open every video
   chip is already a project file (a card, or a drop the box imported), so it is sent as
   `{ url, name, mediaType: 'video', itemId }`; `routes/agent.js` honours the path only
   inside that project's `Media/` (`agentCards.ownedMedia`, the check `list_cards` uses);
   the loop registers it as a card-like ref (kind `result`, with its item id), so `generate`
   takes it as media by url and `make_gif` by item id. Nothing is copied or staged.

- `tests/agent-video-attachment.test.cjs`, four tests: a path outside the project, a `..`
  escape and a `blob:` are all refused; a referenced clip is announced to the model as
  `[Attached video 1: … (ref: …)]`, resolves as kind `result`, is never served by the
  attachment route, and `make_gif` sends its `videoItemId`; a clip with no item id yet says
  why `make_gif` cannot take it and is refused `NOT_A_CARD`; both gates are pinned in source.
- Full suite: 1600 tests, 1599 pass, 0 fail, 1 skipped. eslint clean.
- NOT covered by a test: the prompt box itself (it cannot load under Node). The drop, the
  chip and the send are proven only by the live check below.
- Known ceilings: no video thumb in the chat bubble (nothing is staged to show); on the
  landing page, with no project, a video is still refused.

**Owed by Fabio's eyes (restart the app: `routes/agent.js` and `services/` are server code):**
agent mode, project open. (1) Drag a video CARD onto the box → a chip, no toast. Ask "make
this a GIF" → `gif.make` in app.log, a GIF card lands. (2) Drop a video FILE from Explorer →
it imports as a card and chips; ask for something that takes a clip. (3) With no project
open, drop a video → the new toast, no chip.

## rename_card on cards the app listed - LIVE PASS 2026-09-20 21:47Z

Fabio restarted the app (app.log rotated: line 1 is 21:46:34Z, the ComfyUI boot) and repeated
his own ask, word for word: "give names to all the square and triangle cards that don't have a
name yet". Project: Cowgirl on a Bull.

- app.log, four lines inside 30 ms, 21:47:21.223Z to .252Z: `Agent job c42bbc3c`, `021ec943`,
  `e4de259c`, `9bc119df`, each `: card.rename`. Before the fix this ask left NO such line at
  all: the refusal happened in the loop, so nothing ever reached the renderer.
- Disk: `project.json` mtime 21:47:21Z, the same second. All 11 marked cards (5 square,
  6 triangle) now carry a `customName`; none is left null. Fabio had named some by hand since
  the failed round, so four renames, not eleven, is the right count.
- The only cards still unnamed are unmarked or `dot` (recording_002, t2v_001, gif_001): the
  mark filter held, the agent did not name outside the ask.
- Fabio's own words: "some cards were already named, but the agent was able to name the other
  ones."

This closes the one item handoff d8d9bda5 carried as suite-green but not live-seen.

## Out of rounds: the turn ends in words, not on an error (built 2026-09-20 22:10Z, NOT live-seen)

Found live 21:51-21:53Z, Fabio's ask: "produce a video like this one but in anime style". app.log:
`agent.list-models` x3, `generation.submit` 21:51:45Z (anime still), `agent.describe` x2,
`generation.submit` 21:52:57Z (the clip). Nine tool calls in EIGHT rounds = `MAX_STEPS`. The
model asked for a ninth and the loop answered "Too many tool calls in one turn. Please try a
simpler request" one second after dispatching the clip. The chat read as a failure while the
GPU rendered it; the clip landed fine (MPI-839's pass above is that same clip).

ROOT CAUSE, two parts. (1) The cap REFUSED the round and broke out, so the model never got to
speak: the only text of the turn was an error blaming the request. (2) 8 rounds is exactly one
still -> look -> animate chain: each generate costs about four rounds (settings, guide,
generate, look) plus two up front, leaving none to say so.

FIX (`services/agentLoop.mjs`): `MAX_STEPS` 8 -> 16, exported. The call made after the last
round carries NO tools plus a one-call system line (`OUT_OF_ROUNDS`, never stored in
`_messages`), so the model can only answer in words: what it did, what is running, what is
left. One call, not a refused round plus a retry. `STEP_LIMIT` survives only for an EMPTY
closing reply, and now says "Anything I started is still running. Reply to carry on."
No standing prompt line was added.

- `tests/agent-loop.test.cjs` § (j), two tests, RED before the fix (seen), green after: the
  closing call has no `tools`, its text is the `agent:message`, no `agent:error`, nothing runs
  past the cap, the nudge never joins the conversation; the mute-model path gets `STEP_LIMIT`
  without "simpler request".
- Full suite 1602 tests, 1601 pass, 0 fail, 1 skipped (live key). eslint clean on both files.
- `docs/agent-chat.md` cap line updated.
- NOT proven: a real provider accepting tool messages in history with no `tools` param. OpenAI
  shape and Ollama `/api/chat` both allow it on paper; if one 400s it surfaces as
  `ENDPOINT_ERROR`. Owed: one live chain after a restart.

## A look is kept once, in the card's sidecar (built 2026-09-20 23:55Z, session 3ed1701d, NOT live-seen)

Fabio's decision from the restyle round: "if an image is described, it's described forever".
`AgentLoop._lookOnce(ref)` serves BOTH the auto-look in `settle()` and a plain `look` call:
sidecar first (`agentTools.storedLook`, straight off disk), vision model only on a miss, then
`storeLook` writes `look: {text, at}`. A question, a crop or a box never touches the store. An
attachment has no `itemId`, so it is described live as before.

Two shape decisions the plan left open:
- **The write goes through `POST /project-media/agent/update-meta`, not a second writer.** That
  route owns `updateItemMeta`'s per-sidecar queue, which is not exported, and `routes/projects.js`
  is held by a live peer (MPI-851). Going through the route needed no edit there and cannot race
  a trim or a rename on the same card.
- **`storeLook` never creates a sidecar.** The route starts a missing one from `{}`; a file
  holding only `look` would read as a real item.

Evidence:
- `tests/agent-loop.test.cjs` § (k), four tests. Seen RED first on the old code: `one picture,
  one vision call` actual 2, expected 1. Green after.
- `tests/agent-tools-post.test.cjs` "a kept look": real temp sidecar, test-owned server. One
  POST for a real card, none for a missing sidecar, none for a file outside `Media/`.
- **The real route, not a stand-in:** scratch script mounting the real `routes/projects.js`
  router on its own port over a temp project. Miss `null` -> store -> hit returns the text;
  the sidecar kept `prompt` and `modelId` beside the new `look`; `item-none.json` was not created.
- `npm test` -> 1663 tests, 1661 pass, 0 fail, 1 skipped (live key), 1 todo (MPI-797's, not
  this card's). eslint clean on the six changed files.
- `tests/agent-no-delete.test.cjs` allowlists the route, with the reason.

Known limit, written into `docs/agent-findings.md`: if the renderer rewrites a sidecar from a
copy that predates the look, the field is dropped and the next look is a miss. One extra vision
call, nothing wrong on screen. NOT measured whether any renderer path does that.

Open question for Fabio: a kept description outlives the describer that wrote it. When the
vision model is swapped for a better one, every card already described keeps the OLD model's
reading (the cowgirl's "leaning forward" would survive). Recording which describer wrote it
needs `agent.describe` to report its model, and that lives in `js/shell/agentDispatch.js`
(MPI-797 holds it).

**Owed by Fabio's eyes:** restart the app (`services/` loads at boot), ask for one still with a
follow-up that makes the agent look ("make a fox, then tell me what you see"). Pass = ONE
`agent.describe` in app.log for that picture, and `look` present in its `Media/.meta/<id>.json`.

## Denoise is a named param, and an agent run finally injects one (built 2026-09-21 00:30Z, NOT live-seen)

Read before building, all from code: 0.3 on the krea2 i2i sidecars is the op's DEFAULT, not his
slider; and **an agent run injected no denoise at all** (the PromptBox control returns
`{ Denoise: v }`, `resolveNamedParams` never set it), so the graph ran its baked value while
`_snapshotControlState` recorded the project's. The duration bug's twin.

Built on the duration ladder in `js/data/generationControls.js`: `modelShowsDenoise` (the op's
component list is the authority), `namedParamsFor(...).denoise = {min, max, default}` or null,
and `resolveNamedParams` injects `Denoise` = asked > the project's op bucket > the op default,
refusing `INVALID_DENOISE` by name. `routes/connector.js` `NAMED_PARAM_KEYS` carries it;
`services/agentLoop.mjs` offers it with Fabio's meaning in the tool DESCRIPTION, no prompt line.
`js/shell/agentDispatch.js` needed NO edit (MPI-797 holds it): `_listModels` passes
`namedParamsFor` through whole and `_submit` merges `named.injectionParams`.

- `tests/agent-denoise.test.cjs`, 7 tests, RED first (`modelShowsDenoise is not a function`).
- `npm test` -> 1670 tests, 1668 pass, 0 fail, 1 skipped, 1 todo (MPI-797's). eslint clean.
- `.claude/skills/cubric-vision-generate/SKILL.md`: the param row, the merge list, the error code.
- Behaviour change to know about: an agent i2i / upscale / detail run now uses the op default
  (or the pinned project's slider) where it used the workflow's baked value. For krea2 i2i both
  are 0.3. NOT checked per workflow whether every baked value equals its op default.

**Owed by Fabio's eyes:** after a restart, "make this picture anime, keep her pose" on a model
with no edit op. Pass = the agent sets a LOW denoise and says so; the sidecar's
`generationSettings.controlState.op.denoise` equals what it asked for.

## The 07:45Z run tested a build from BEFORE both fixes - it proves nothing about them

Fabio ran "make a fox" in his app at 2026-09-21 07:45-07:46Z and reported the agent got the
image but never looked at it. **That app booted at 2026-09-20 22:22Z** (`app.log` line 1 is
21:46Z, the GPU-detect + ComfyUI boot lines are 22:22-22:23Z, and the log ROTATES on restart, so
there was no later one). The kept look landed at 23:52Z and denoise at 00:30Z. `services/` loads
at boot, so the running main process had neither. Both still owe a live check after a restart.

Read off the same run, and NOT about the new code:

- `Fox/Media/.meta/2854b732-….json` has no `look` field, and exactly ONE `agent.describe`
  (07:46:41.7Z) fired for it - the OLD auto-look. Sidecar mtime is the same second, so the
  sidecar existed when the describe started: when this is re-run on a current build, a missing
  `look` field is a real failure, not a race.
- **The agent promised to report back AGAIN**: "I'll wait for it to finish in the chat... As soon
  as the image arrives, I'll take a look at it and describe what I see." The Duration rule's
  never-promise sentence WAS in that build (shipped 2026-09-20, sixth pass). A prompt line lost
  to the model's instinct for the fourth recorded time. It is the same shape as the i2i-over-edit
  loss: the fix belongs in a tool result, not another sentence.
- **What he actually saw is the missing wake.** The auto-look's note sits in `_notes` until he
  types, so a finished generation produces silence. That is Phase C's wake-on-drain, designed in
  `plan.md` and not built. His words - "the agent got the image but wasn't able to do anything
  about it" - are that gap, not the look store.

## The describer is replaced, on a scored run (2026-09-21, Fabio's key, ~0.3 cents)

Ten multimodal DeepInfra models against the Cowgirl on a Bull preview asset, using production's
own system prompt (parsed out of `comfy_workflows/image_descriptor.json`), its 1 MP / 16-px
nearest downscale and its `image_url` data-URL shape. Scored against a truth file read off the
picture, not against my opinion of the prose. Harness, truth and every answer:
`.agents/mpi-kanban/tasks/MPI-817/research/` - re-runnable with `BENCH_MODELS=…`.

| model | must-hits | wrong | cents |
|---|---|---|---|
| **google/gemma-4-26B-A4B-it** | **10/10** | **none** | **0.0159** |
| mistralai/Mistral-Small-3.2-24B | 10/10 | rider "leaning forward" | 0.0182 |
| Qwen/Qwen3-VL-30B-A3B-Instruct | 10/10 | rider "leaning forward" | 0.0393 |
| google/gemma-3-12b-it | 10/10 | guns "held horizontally and pointed outwards" | 0.0092 |
| inclusionAI/Ling-3.0-flash-VL | 9/10 | none | 0.0199 |
| Qwen/Qwen3-VL-235B-A22B | 9/10 | none | 0.0536 |
| google/gemma-3-4b-it | 8/10 | none | 0.0080 |
| google/gemma-3-27b-it | 8/10 | guns "pointed forward and slightly downward" | 0.0105 |
| meta-llama/Llama-4-Scout (INCUMBENT) | 6/10 | none | 0.0298 |
| Qwen/Qwen3.5-9B | 0/10 | EMPTY reply, 1388 input tokens billed | 0.0244 |

Change: `services/llmEngines.mjs` `RECOMMENDED_REMOTE_MODELS.deepinfra` - `describe` moves to
`google/gemma-4-26B-A4B-it` (which already carried `enhance`), and Scout keeps its entry with
`jobs: []` because `agentLoop.mjs:963` still reads its `contextWindow`. Half the price of the
model it replaces. `node --test tests/llm-connection.test.cjs tests/llm-describe.test.cjs
tests/agent-loop.test.cjs` -> 103 tests, 0 fail. eslint clean.

Two traps for whoever surveys next: the image-input marker is the `multimodal` TAG, not the name
(gemma-3-4b and Mistral-Small carry no hint in theirs, and 53 live models have it); and the tag
is NOT sufficient - Qwen3.5-9B has it and answered with nothing.

**Not covered:** one picture, one question. Fabio asked for a harder second case (two characters
in unusual poses) and it has not been run; the harness takes any image plus a truth file.
**Not done:** recording WHICH describer wrote a stored look, which he asked for in the same
breath. `agent.describe` does not report its model, and that lives in `js/shell/agentDispatch.js`
(MPI-797's claim). Until it does, a stored description cannot be re-read when the model changes.

## LIVE 2026-09-21 08:28-08:41Z — the restart, what it proved, and what it broke

Fabio restarted at `08:28:39Z` (`APP_USER_DATA set to`, the only boot in this log after
22:22:36Z — **app.log APPENDS across restarts here, it does not rotate**, so line 1 is the
previous run's tail and dates nothing).

**Check (a), the kept look: PASSED on the write half.**

```
08:29:28  generation.submit
08:30:01  agent.describe      <- exactly one, whole boot
08:30:05  look written to the sidecar
```

`Kaiju Giant Bowl/Media/.meta/8a0fac58….json` carries `look: {text, at}`. The text is correct
for the frame (bowl, city street, rubble, cars, smoke, dark sky) — the new `gemma-4-26B-A4B-it`
describer reading a picture the old Scout would have invented a pose for.

**Check (a), the READ half: FAILED.** At `08:36:10` a second `agent.describe` fired for Fabio's
"Tell me what you see." — six minutes after the text was already on disk. `agentLoop.mjs` served
it live because `if (!args.question && !args.crop && !args.box)` is the only door to
`_lookOnce`, and the model passed his sentence as `question`. By the letter of his 2026-09-20
decision that is correct (a question is a different answer); in practice the most natural way to
ask for the plain description is a question, so the cache would never be hit. Fixed in the
`question` param's description (it had none).

**Check (b), denoise: NOT RUN, and the reason is the finding.** "Make this anime, keep her pose"
went to `edit_001` / `kleinEdit` / `klein-9b`, whose `controlState.op` is `null` — an edit op has
no denoise. The agent never reached an i2i op, so nothing about denoise was exercised.

Klein covered the subject. Fabio asked for **a different technique**; the agent submitted
`edit_002`, `kleinEdit` / `klein-9b` again, with a stronger sentence
(`"Keep her bare chest uncovered with no bra, no top…"`), and **no `list-models` in between** —
it never reconsidered. It could not: `NOTES` carried a note for all four edit ops and none for
any i2i op, so "another technique" did not exist in its world. The result was right after two
passes; the request was not honoured.

### Fabio's ladder for a restyle (2026-09-21, approved direction)

1. A restyle ask is **i2i first**. Low denoise holds the composition.
2. Prefer a model whose style matches the ask (`ill-anime` for anime).
3. No matching model: i2i on whatever they have, prompted well — **describe the picture, then
   add the style**.
4. **Edit is the escalation**, reached only when the user says "that's too different".

This does not reverse his 2026-09-20 "edit is more truthful". That held because i2i prompted from
a *wrong* description is unsafe, and Scout misread poses. A correct, kept description is the
precondition, and it only started holding this morning.

### Built 2026-09-21 (commit 314355ec, suite 1673 / 0 fail)

| # | Where | Change |
|---|---|---|
| B | `agentLoop.mjs` look schema | `question` gains a description: omit it for the plain description (kept, free, instant); a question always spends a fresh vision call |
| C1 | `agentLoop.mjs` Model rule | Narrowed, not added to: a **local** instruction is the edit task; a whole-picture **restyle** is i2i, and the i2i note says how |
| C2 | `modelPriority.js` | New `OP_NOTES`, keyed by op and **appended** to the model note rather than replacing it — a restyle needs both halves. One entry: `i2i` |
| C3 | same note | The restyle prompt is built from the card's kept description, never a better scene |
| — | `modelPriority.js` | `klein-9b:kleinEdit` declares its observed habit: it tends to cover a bare subject |

`tests/model-priority.test.cjs` gains two tests. The composition one is **proven red** with the
join backed out (`pass 6 / fail 1`), green with it.

**Still owed:** one live run — "make this anime" on an imported photo should now reach i2i on
`ill-anime` at a low denoise, with the prompt visibly built from the description and no clothing
added. That run is also the first real exercise of the denoise named param.

---

# Session 43718bac (2026-09-26): the leftovers, from handoff b12a5213

Fabio's answers to the Continue Brief: go on the five small defects; **yes** to closing the
`injectionParams` hole while pinned; yes to one live DeepInfra call for the out-of-rounds path.
Each fix below was seen RED before it was built.

| # | What | Where | Test (red first) |
|---|---|---|---|
| 1 | A loopback call that THREW reached the chat and never `app.log`. Every `_post`/`_get` failure now logs `loopback <METHOD> <route> failed` with the error, and `logger.error` prints the `cause` chain (`cause: ECONNREFUSED ...`), where Node keeps the reason. Shared primitive: every `logger.error` caller gains it. | `services/agentTools.mjs` `_logLoopbackFailure`; `routes/logger.js` `_causeLines` | `tests/logger-cause.test.cjs` (new, 2); `tests/agent-tools-post.test.cjs` dead-server case |
| 2 | A refused `generate` still read "Starting generation", so a refused round and its retry read as two runs. The done frame now says **"Generation not started"**, by the same by-id correction MPI-870 built for a cached look; history carries it too. | `services/agentLoop.mjs` `GENERATE_REFUSED_LABEL` | `tests/agent-loop.test.cjs` "refused IN-TURN" |
| 3 | Ollama chat (`stream:false`) went over Node `fetch`, so its 10-minute budget died at the 300 s headers limit. `OllamaEngine.chat` now posts over `node:http(s)` (`_postWithDeadline`, fetch-shaped answer, same `TIMEOUT` error). Covers agent, enhance and describe: one client. | `services/llmEngines.mjs` | `tests/agent-loop.test.cjs` "posted WITHOUT fetch" + "never answers is a TIMEOUT" |
| 4 | Pinned, raw `injectionParams` still merged over the resolved params: the agent could move a setting the user set. `resolveSettingsOwner` now owns them too (pinned = `{}`), and BOTH merge sites read the gate's answer: submit and quote. | `js/shell/agentDispatch.js` | `tests/agent-pinned-settings.test.cjs` (new case) |
| 5 | A kept look did not say which describer wrote it. The renderer reports `describer` (the endpoint model id, or `ComfyUI qwen3vl-abliterated-clip` locally), `_lookOnce` passes it on, and the sidecar `look` carries `{ text, describer, at }`. | `js/services/llmService.js`, `js/shell/agentDispatch.js`, `services/agentLoop.mjs`, `services/agentTools.mjs` | `tests/agent-tools-post.test.cjs` kept-look case; `tests/agent-loop.test.cjs` "described ONCE" |

**The test trap, paid for once.** Moving Ollama chat off `fetch` un-stubs every test that faked
`global.fetch` for it. Seven were converted to a host the test owns (port 0): two in
`agent-loop`, three in `llm-describe`, one in `llm-service`, one in `llm-connection`. The last one
was missed by the first sweep and **reached localhost:11434 for real once** in the first full run
(`model: 'm'`, no messages, 25 ms: a 404 or a refused connection, no model load). The full run
caught it; it is converted. Search that finds them all: `OllamaEngine` in `tests/`.

**Out-of-rounds, proven live** (item 6, Fabio's OK, 2026-09-26 ~17:55Z). One call on his
DeepInfra key to `deepseek-ai/DeepSeek-V4-Flash-0731`, built exactly as `agentLoop.mjs` builds
the closing request: three tool-call rounds of history, NO `tools` param, the `OUT_OF_ROUNDS`
system line LAST (text checked against the source). HTTP 200 in 2.6 s, zero tool calls, a
288-character plain answer naming what was made, what is running and what is left. $0.0000455.
Script: session scratchpad `out_of_rounds_live.mjs`. Not proven: Ollama's native route (it would
load a model on his GPU); `/api/chat` takes a tool-less request by its docs.

**Held, not built — item 4 of the brief, the 30-minute clock.** Read, not measured: the route's
own `JOB_TIMEOUT_MS` (`routes/connector.js:313`) starts at DISPATCH and resolves `TIMEOUT` ("may
still be running") while a job is still queued; `agentTools._post` has the same 30 minutes. With
MPI-870's fan-out ("upscale all 50") the tail of a deep queue now reaches it, the loop counts it
settled, and the wake can report a drain while jobs still run. The fix moves the clock to job
START (the renderer pings when the Cue job begins; the route re-arms its timer), which spans the
renderer, the route the MCP shares, and the agent: a design change, so it goes to Fabio first.

| Check | Result |
|---|---|
| `npm test` (whole suite) | **1965 tests, 1964 pass, 0 fail, 1 skipped** (live key) |
| `npx eslint --max-warnings=0` on the six changed sources | clean |
| `tests/agent-prompt-budget.test.cjs` | passes: no system-prompt text changed |

Also closed: messages `83f75bbf`, `f3f1907c`, `a7dc92be` (sent by this card; every recipient
card is `done`, and the conditions they raised are gone).

## Same session, round 2: Fabio's answers, and three more builds

**The pinned panel PASSED** (Fabio, after a restart: "It all checks out"). Recorded on MPI-774.
His follow-up is built: every pinned refusal and the Settings panel line now offer "close the
settings panel and I'll pick the model" (`tests/agent-pinned-settings.test.cjs`, red first).

**No clock on a job** (Fabio: "We shouldn't have a clock... three videos that are 15 seconds
each on a GPU like mine... might very well take an hour and a half"). A finished generation
already ended the wait: the renderer reports, and the route answers. The 30 minutes only ever
caught a job whose WINDOW went away mid-render, so that is what ends one now.
- `routes/connector.js`: `JOB_TIMEOUT_MS` is gone. Each pending job remembers the window that
  took it; when that window's job stream closes, `_settleWindowJobs` answers its jobs
  `WINDOW_CLOSED` ("closed or reloaded... check the gallery, send it again if it is missing").
  Another window closing leaves it alone. `tests/agent-generation-relay.test.cjs`, red first.
- `services/agentTools.mjs` `_post`: no default clock; only the quick routes keep one.
- `routes/mcp.js` (MPI-593's file, unclaimed): the job record was deleted an hour after START, so
  `wait_generation` on a render longer than that answered UNKNOWN_JOB mid-render. The hour now
  starts when the job finishes. `tests/mcp.test.cjs`, seen red with the old line put back.
- `TIMEOUT` rows replaced by `WINDOW_CLOSED` in both skill docs and `docs/agent-chat.md`.

**Global memory BUILT** (MPI-774 Phase 6 = this card's Phase B; Fabio's yes on his 09-18 spec):
- Store: `services/agentMemory.mjs`, one set of internals over two roots. Global notes live in
  `<APP_USER_DATA>/agent/memory/`, the same README-of-pointer-lines shape, the same caps (4 KB a
  note, stricter than the spec's 200 lines, 100 notes).
- Route: `/connector/memory` takes `scope=global` (query or POST body), no folderPath.
- Tools: `read_memory` / `write_memory` take `scope: project | global`; global needs no project
  (the landing page can save one). The write says "global only when the user asks to keep it
  for every project". Label: "Noted for every project: <title>".
- Listed once per conversation (and again after a compaction): `[Global notes, kept for every
  project ...]`, pointer lines only; nothing at all when there are none.
- Memory rule: "your notes survive a restart, per project and global (all projects, only when
  asked)". Budgets held without raising either: system prompt 10,146 of 10,150 bytes (the rule
  was reworded 3 bytes SHORTER), tool schemas 17,180 of 17,200 (two descriptions trimmed).
- Tests, all red first: `tests/agent-memory.test.cjs` (store + route), `tests/agent-loop.test.cjs`
  (write/read with no project, listed once, the rule, the tool wording).
- **Owes Fabio's live check after a restart:** (1) in one project, "save globally that I always
  want warm cinematic light", then restart, open another project, ask what it remembers: it
  names the note; (2) a plain "my character is called Rook" lands in the PROJECT, not global;
  (3) "do you remember things?" names both kinds.

| Check | Result |
|---|---|
| `npm test` (whole suite) | **1974 tests, 1973 pass, 0 fail, 1 skipped** (live key) |
| `npx eslint --max-warnings=0`, nine changed sources | clean |
