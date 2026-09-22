# Localised edits — working on a mask

A **mask** is an area the user paints over one picture. Paint one and
the operation works on that area alone, at the source image's own size. It is how any change
confined to a region should be made: a maskless edit re-renders the whole picture, and a
whole picture is almost never what the user asked to change.

**You never paint a mask. You ask for one, and then you use it.** The app hands whatever the
user has painted to every generation you dispatch, so once they say it is drawn you simply
run the op. The mask travels with the picture it was painted over, and that picture is what
gets edited - so a mask is never applied to some other image you were handed, such as one
attached to the conversation.

Masking is a property of the **app**, not of one model. Every local model with an edit
operation honours a mask — Klein, Krea 2, Qwen, Boogu, Chroma, SDXL, Pony, Illustrious.
Cloud models do not: nothing is painted on their side.

## The one rule that changes your prompt

**The model sees only what is inside the mask** — cropped out and blown up to fill the
frame. It has no view of the rest of the picture, so describing the rest is not context —
it is noise the model tries to draw.

Mask the boy's reflection in the river, and the prompt is:

> convert the boy into a demon: glowing red eyes, sharp horns, pale grey skin, a sinister
> grin

Not the river, not the fishing rod, not the cartoon style, not "matching the surrounding
scene". None of it is visible to the model, all of it competes with the instruction.

**The user's words are not the prompt.** They describe the picture from OUTSIDE, because
they can see all of it — "make the boy's reflection demonic" is a perfectly good ask and a
terrible prompt. Translate it into what the crop should become; never echo it.

This exact one failed live, 2026-09-22. Masked over that reflection, the prompt sent was:

> turn the boy in the water reflection into a demon version of himself … faint red aura
> reflected in the water

The model had an upside-down boy in front of it and no river, no bank and no boy above it.
Told about water and a reflection, it drew them: an **upright** demon rising out of the
water with its own reflection beneath it. Nothing about the graph was wrong — the crop is
what masking IS. The prompt described a picture the model was never given.

So: never name the region ("the reflection", "the background", "the left side"), never name
what it sits in ("in the water", "on the wall"), never name what surrounds it. To the model,
that crop is simply the picture.

Prompt the **delta only**: what that area should become.

## The shape depends on the op

Three ops, three ways of writing the same ask. Using one op's shape on another wastes the
run — ask what the model is looking at, and what it is being asked to do with it.

**`edit` / `kleinEdit` / `krea2Edit` / `qwenEdit` — an instruction.** A verb, on what is
already there. It re-renders the mask, so tell it what to make of it.

> convert the boy into a demon: glowing red eyes, sharp horns, pale grey skin, a sinister grin

**`detail` — a description of what is already there.** A noun phrase, not an instruction:
there is no verb for it to follow. Mask a face and describe the face you want that face to
be.

> beautiful redhead woman, green eyes, freckles

Under about 0.5 denoise that sharpens what is there. Above it, you get a NEW redhead woman —
same prompt, different job — so the denoise is as load-bearing as the words.

**`inpaint` — add, or remove.** To remove, say so; the mask is the thing going away.

> remove the flower from the vase

To add, name the thing. Whether it wants the bare noun or a full sentence depends on how the
mask is drawn, which you cannot see:

> a flower  ·  add a flower to the vase

**These two are trial and error.** Denoise, mask shape and wording all move the result, and
none of them is visible to you. So say what you are about to send before you send it, and
let the user correct the wording — one round of that is cheaper than three blind runs.

## Which operation

| Op | What a mask does to it | Use it for |
|---|---|---|
| `edit` (and `kleinEdit`, `krea2Edit`, `qwenEdit`) | re-renders everything inside the mask | changing a thing that is already there |
| `inpaint` | holds everything outside the mask still | adding a thing, or removing one |
| `detail` | above ~0.5 denoise behaves almost like `inpaint`; below it it is detailing, but it can still change the subject a lot | sharpening or reworking a region — prompted as a DESCRIPTION |
| `i2i` | honours it — the mask drives the same crop | a restyle confined to a region |
| `control` | **does not honour it.** A mask changes nothing here | never reach for it to localise |

`inpaint` and `detail` **require** a mask: dispatched without one they are refused, and the
refusal tells you to ask the user to paint. `edit`, `kleinEdit` and `i2i` do not require one —
which is the trap. They run happily without a mask and repaint the whole picture, and the
result comes back reporting success.

So when the ask is local, do not reach for `inpaint` because it is the op that mentions masks.
Reach for the op that matches the job, and make sure a mask is painted.

## The flow

1. The user asks for a change confined to a region.
2. Say so, and ask for the mask: name the op you will run, say what to paint over, and tell
   them the way there in the app's own words: click the card in the gallery to open it, then
   pick the Mask tool from the toolbar down the left. Never say "History" or "the History
   workspace" to them - that is our name for it and it is written nowhere on screen. A
   roughly square area is the
   natural shape — the graph squares the painted region off anyway.
3. They paint it and tell you to go ahead.
4. Dispatch the op, prompting for the masked area only.

Do not offer to paint it yourself, and do not try to choose the area for them. With several
people in a picture you cannot know which one they meant.

## What to expect back

The picture keeps its **source size**. Only a 1024px crop around the mask is ever sampled and
then stitched back in, which is why this is the only way a very large image — 8K, 16K — gets
edited at all. Do not offer an upscale afterwards to "restore" the size; nothing was lost.

## What masking does not cover yet

- **Video.** A mask on a video card does not reach a generation. Video masking is coming.
- **The GIF cut-out ops** (`gifCutoutSam3`, `gifCutoutBirefnet`) build their own masks from a
  name, or automatically. Nothing is painted for them and you pass none. A GIF lands as an
  image card, so the Mask tool is available on one like any other picture.
