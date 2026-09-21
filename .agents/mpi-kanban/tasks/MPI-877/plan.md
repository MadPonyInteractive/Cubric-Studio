# MPI-877 — The agent learns localised edits

Sits **in front of MPI-876** (Fabio, 2026-09-21).

## Current State

Not started. Planned from a live failure in Fabio's own app on 2026-09-21, and from
Fabio's own explanation of what localised edits are — which is knowledge the agent's
docs do not contain anywhere.

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
4. **Check the GIF surface** before claiming it. The card says images and GIFs; confirm
   the GIF ops honour `Input_Mask` rather than assuming it.

## Verification

**Verify mode:** `user-ux` — steps 1, 2 and 4 are unit-testable, but whether the agent now
*reaches for* the mask route and prompts only the delta is a judgement only Fabio can make,
in his own app, on the same ask that exposed it.

The closing check is the original failure re-run: ask for the reflection alone to change,
and get a demon reflection under a normal boy.
