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
