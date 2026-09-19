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
