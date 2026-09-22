# MPI-877 — The agent learns localised edits

Sits **in front of MPI-876** (Fabio, 2026-09-21).

## Current State

**ROUND 3 BUILT 2026-09-22, card still in `doing`, waiting on Fabio's own re-run.**

Round 2 RENDERED. Fabio ran it live: `kleinEdit` / `klein-9b` on his own card, mask and image
both 768x1024, `InpaintCropImproved` with no assertion, 37.21 s. The round-2 binding fix is
proven live and the narration and "History" faults were not raised again. Two new things came
back, and both are fixed and pushed:

- **The edit landed as a NEW GALLERY CARD** and the History workspace drew no latents. One
  cause, the round-2 shape one level up: `activeMask` published the mask and its picture but
  not the CARD they belong to, so dispatch had nothing to route at and fell through to
  `scope: 'gallery'`. The reader now publishes `groupId` and `maskedGenerationOpts()` sends a
  masked submit where a Cue press in that workspace goes (`5a873926`).
- **The prompt was written for the whole picture, not the crop.** Fabio's call, and it closed
  MPI-885, which had carded a graph change: "the model only sees the masked area, so why
  prompt other stuff in it?" The Masking rule now carries the worked pair in the SYSTEM
  PROMPT rather than only in the fetched doc, plus translate-never-echo, the ban on naming the
  region or what it sits in, and the PER-OP shapes — instruction for the `edit` family,
  description for `detail` (whose denoise decides sharpen-vs-replace), add-or-remove for
  `inpaint` (`09680f2d`).

Evidence and the red-proofs: `validation.md` § Round 3. `checklist.md` § 7.

**Open for Fabio, on the card:** should the agent RUN `detail` / `inpaint`, or teach the user
to run them? Built as run-but-say-first; he asked the question and has not answered it.

---

_Round 2's note, kept:_

Round 1 (`54e25445` + `ab9e2661`) is pushed. Fabio ran it live and the mask half held: the
agent read `app:masking`, refused to paint or pick the area, named the Mask tool, said what
to paint, chose `kleinEdit` and checked its note. Three faults came back with it, all fixed
in `c79d0118` (pushed — a peer's push carried it).

1. **The masked edit could never render.** Five dispatches across two models died in the
   engine: `InpaintCropImproved ... Expected torch.Size([682, 512]), got
   torch.Size([1024, 768])`. The mask came off the open card at 768x1024; the image was the
   chat ATTACHMENT, `att_564c16a9.webp`, measured at 512x682 — a thumbnail rendition.
   Nothing bound a mask to the picture it was painted over. `activeMask` now publishes
   `{ dataUrl, url }` and `bindMaskedSource` points `inputImage` at the mask's own picture.
2. **The reply was mostly reasoning** — four paragraphs before the answer, naming the
   masking rule and the kleinEdit note out loud while the status strip had already listed
   every read. A **Voice rule** now covers it.
3. **"History" is our word, not the app's.** Corrected in the Masking rule, the
   `MASK_UNSUPPORTED` refusal, `docs/agent/masking.md` and the Honest-limits line.

Evidence and the red-proofs: `validation.md` § Round 2. `checklist.md` § 6.

**The ONLY thing outstanding is Fabio's re-run**, and nothing has rendered yet. He must
RESTART the app (`services/agentLoop.mjs` is server-side, so a reload will not pick the
Voice rule up) and Start Over in the Agent panel, then repeat the ask: the boy's reflection
alone turns demonic, under a normal boy. He said he will report back in the next session
and will not touch the app before then.

One design change against the plan below: reaching the viewer through `navigation.js` was
tried and backed out — it drags the whole component tree into `agentDispatch`'s CJS
require, where `MpiLevelMeter.js:2` imports a server-absolute `/js/utils/dom.js` Node
cannot resolve, so every dispatch test died on an audio module. The mask now travels
through a new import-free `js/shell/activeMask.js`.

Below is the plan as written before the work, kept for its research.

**Not started — planned only, and not authorised to start.** Written 2026-09-21 from a
live failure in Fabio's own app plus his own explanation of localised edits, which is
knowledge the agent's docs do not contain anywhere.

Research already banked, so the next session does not redo it: both faults are pinned to
file:line below, and the Klein master graph has been traced — `i2i` **does** honour a
painted mask (node 592 gates the shared encode). `control` is the one open question; do
not put it in the docs either way until it is traced or benched.

Card sits ahead of MPI-876 on Fabio's instruction. MPI-876 is likewise planned and
unauthorised.


## Plan Drift

- **2026-09-21, round 2.** The card's `user-ux` verify mode earned its keep: every automated
  check in round 1 was green and the feature still could not render. A mask was published as
  bare pixels, so dispatch attached it to whatever image the model named. Fixed by giving the
  mask its picture rather than by validating sizes at the crash site — a size check there
  would have turned a crash into a refusal and left the mask pointed at the wrong image.
- **2026-09-21.** The 512-wide chat attachment behind the mismatch is its own bug: a maskless
  `edit`/`i2i` on an attached card edited the thumbnail and reported ok. Spawned out rather
  than folded in, and a peer has since built it as **MPI-884** (`712c3ff2`, unpushed at the
  time of this handoff). MPI-877's fix does not depend on it — the binding makes masked
  edits correct whatever the attachment is.
- **2026-09-21.** `MpiLevelMeter.js:2`, the server-absolute import named in Current State
  above, was fixed by a peer as **MPI-881** (`11e7cdc9`). `activeMask.js` still stands on its
  own merits (one slot, no DOM reach from dispatch) — do not "simplify" it away by reaching
  for `navigation.js` now that the import is clean.

## What happened, live

Project "Agent tests", card `t2i_003`, a flat-cartoon boy fishing. Fabio asked for the
boy's **reflection** in the river to turn demonic, the boy himself untouched.

1. The agent ran a maskless `kleinEdit`. Klein repainted the whole subject — the boy on
   the bank became a purple horned devil. Exactly the whole-image drift the agent had
   itself predicted one message earlier.
2. It then reasoned "region-limited change → `inpaint`", told Fabio to paint a mask, and
   offered to walk him through it.
3. Fabio painted the mask and said go.
4. The agent dispatched `inpaint`, hit `MASK_UNSUPPORTED`, and told him to run it himself
   in the app — **with the mask already painted and sitting right there.**

Fabio's verdict: *"I don't think the agent understands much about masking."* He is right,
and its own docs are why.

## The two faults

### 1. Teaching — the agent does not know localised edits exist

The registry, the workflows and `commandExecutor` all agree, and none of it reaches the
agent:

```
js/services/commandExecutor.js:791
if (payload.maskDataUrl) params['Input_Mask'] = payload.maskDataUrl;
```

**No model check. No op check.** Any local workflow declaring an `Input_Mask` node gets
the painted mask — `klein_9b_t2i`, `klein_t2i`, `boogu_edit_*`, `qwen_edit`, `chroma_*`,
`krea2_t2i_*` all declare one. Localised editing is a property of the **app**, not of one
model.

> **Do not repeat this session's mistake.** The `Input_Mask` comment at
> `js/data/commandRegistry.js:482` sits inside the `krea2Edit` op and reads as a Krea2
> feature. It is not. Fabio corrected it directly: *"It's not KREA2 that can do localised
> edits. It's every single model that has the edit op — apart, obviously, from cloud
> models."*

**What a mask does, in Fabio's words plus the code that backs each one:**

| Fact | Backing |
|---|---|
| A mask makes `edit`, `detail` and `inpaint` process **only** that area | `commandExecutor.js:791`, generic injection |
| The model **cannot see the rest of the image**, so prompting about anything outside the mask is useless and actively confuses it | the mask drives a crop — `commandRegistry.js:482` |
| Output **keeps the source image size**, so this is how 8K and 16K images are edited at all | edit follows the source via `imageSizedOps` |
| Masked **edit** re-renders everything inside the crop | `models.js:694` — *"re-renders the whole crop"* |
| **inpaint** holds everything outside the mask still; it is for **adding or removing** things | `models.js:694` — the LanPaint branch, *"holding everything outside the mask still"* |
| **detail** above ~0.5 denoise behaves almost like inpaint; below it, it is detailing, but it can still change the subject a lot | Fabio, 2026-09-21, from production |
| Images and GIFs only, today. Video masking is coming | Fabio, 2026-09-21 |

### Which ops honour the mask — read off the graph, 2026-09-21

Fabio asked whether `i2i` and `control` respect a mask too. Traced in
`comfy_workflows/klein_9b_t2i.json` (the master graph; branches
`1 t2i · 2 i2i · 3 depth · 4 edit · 5 inpaint · 6 detail · 7 upscale`). `Input_Mask` is
node **296**, and it gates **three `MpiIfElse` switches by its own presence**:

| Node | mask present | no mask | What it means |
|---|---|---|---|
| **592** | `InpaintCropImproved` (581) | `Input_Image` (474) whole frame | feeds `ImageScaleToTotalPixels` → `VAEEncode "Encode ref 1"` → `SamplerCustomAdvanced` — **the shared main image-encode path** |
| **656** | `LanPaint_KSampler` (652) | `SamplerCustomAdvanced` (185) | mask swaps the sampler for the hold-outside-still one |
| **576** | reroute `masked edit` ← `InpaintStitchImproved` (582) | plain `VAEDecode` (166) | stitches the crop back at **source size** |

**So `i2i` does honour a mask** — node 592 sits on the shared encode that the main sampler
consumes, so any branch running through it gets the crop instead of the whole frame.
Fabio's recollection was right.

**`control` is NOT settled.** The depth branch builds its own conditioning and was not
traced to `Encode ref 1`. Do not claim it either way in the docs until it is checked —
trace it, or bench it.

Two more facts fall out, both confirming Fabio's account:

- `InpaintCropImproved` runs `output_resize_to_target_size: true` at **1024x1024**, and
  `InpaintStitchImproved` puts it back. Only a 1024 crop is ever sampled, whatever the
  source is — that is exactly why this is how 8K and 16K images get edited at all.
- `MpiMaskSquareBbox` (584, `padding: 64`) squares the mask bbox and feeds it as
  `optional_context_mask`. The graph squares it off anyway, which is why a square mask is
  the natural shape to draw.

**The right answer to the live ask** was: mask the boy *in the reflection*, run **`edit`**
(any local model that has it — Klein included), prompt `convert the boy into a demon`.
Nothing about rivers, rods, cartoon style or "matching the surrounding scene" — the model
cannot see any of it. The agent's actual prompt was three lines of scene description, all
of it invisible to the model and all of it noise.

### 2. Plumbing — the agent cannot use a mask even when one exists

`js/shell/agentDispatch.js` contains **no `maskDataUrl` at all**. The normal in-app path
reads it from the viewer:

```
js/components/Blocks/MpiGroupHistoryBlock/MpiGroupHistoryBlock.js:1828
const maskDataUrl = viewer.el.hasMask?.() ? ... getMaskDataURL('black', 'white') ...
```

The agent builds its own config and never asks. Two consequences:

- A masked-capable op (`edit`) dispatched by the agent runs **whole-image, silently**.
  No error. That is the first failure above, and it would recur forever.
- `agentDispatch.js:252` refuses every `requiresMask` op **unconditionally**
  (`"needs a painted mask, which this endpoint cannot supply"`) without ever asking
  whether one exists. That is the second failure.

## Scope — v1 (Fabio, 2026-09-21)

The agent does **not** create or manage masks. The user paints; the agent advises, then
uses what is there.

1. When a change is confined to a region, the agent **offers the mask route** — names the
   op it will run, tells the user what to paint, and can name the mask tools available.
   It was already nearly doing this; it just named `inpaint` when it meant `edit`.
2. The user paints and says *"I drew the mask, go ahead."*
3. The agent dispatches the right op against that mask, and prompts **for the masked area
   only**.

### Deferred to a later version — do NOT build here

The agent understanding how to drive masks **itself**. Fabio: *"he would have to do quite
a bit, like know which mask to select... If there are 5 people in there, he doesn't know
which one corresponds to the person that the user is talking about, so let's leave it for
another version."* This card does not select, create, name or disambiguate masks.

(This supersedes nothing: the standing "masks → agent v2" deferral covers exactly that
half. The advise-and-use half is what Fabio moved forward into v1.)

## Remaining Work

1. **Attach the mask.** `agentDispatch.js` reads the viewer's mask the same way
   `MpiGroupHistoryBlock.js:1828` does and puts `maskDataUrl` on the dispatch config.
   **Verify:** a unit test dispatching `edit` with a mask present asserts `maskDataUrl`
   reaches the executor payload, and that a dispatch with no mask omits it.
2. **Make the refusal conditional.** `agentDispatch.js:252` refuses a `requiresMask` op
   only when no mask exists, and its message tells the agent to ask the user to paint one
   rather than claiming the endpoint cannot supply it.
   **Verify:** unit test — `inpaint` with a mask dispatches, without one refuses, and the
   refusal text names painting rather than `cannot supply`.
3. **Teach it.** The table above into the agent's model docs (`docs/agent/models/*.md` —
   `flux-2.md:35` currently teaches the opposite), plus the advise-then-use flow, the
   delta-only prompting rule, and images/GIFs-only.
   **Verify:** Fabio's own re-run of the reflection ask.
4. **Settle `control`, and check the GIF surface**, before either goes in the docs. `i2i`
   is answered above (yes). `control` is not — trace the depth branch or bench it. Same
   for the GIF ops: the card says images and GIFs, so confirm rather than assume.
   **Verify:** each op the docs claim is backed by a traced node or a bench run, named in
   `validation.md`. An unproven op is left out, not hedged.

## Verification

**Verify mode:** `user-ux` — steps 1, 2 and 4 are unit-testable, but whether the agent now
*reaches for* the mask route and prompts only the delta is a judgement only Fabio can make,
in his own app, on the same ask that exposed it.

The closing check is the original failure re-run: ask for the reflection alone to change,
and get a demon reflection under a normal boy.
