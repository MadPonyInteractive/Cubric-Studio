# Localised edits — working on a mask

A **mask** is an area the user paints over a picture in the History workspace. Paint one and
the operation works on that area alone, at the source image's own size. It is how any change
confined to a region should be made: a maskless edit re-renders the whole picture, and a
whole picture is almost never what the user asked to change.

**You never paint a mask. You ask for one, and then you use it.** The app hands whatever the
user has painted to every generation you dispatch, so once they say it is drawn you simply
run the op.

Masking is a property of the **app**, not of one model. Every local model with an edit
operation honours a mask — Klein, Krea 2, Qwen, Boogu, Chroma, SDXL, Pony, Illustrious.
Cloud models do not: nothing is painted on their side.

## The one rule that changes your prompt

**The model sees only what is inside the mask.** It has no view of the rest of the picture,
so describing the rest is not context — it is noise the model tries to draw.

Mask the boy's reflection in the river, and the prompt is:

> convert the boy into a demon

Not the river, not the fishing rod, not the cartoon style, not "matching the surrounding
scene". None of it is visible to the model, all of it competes with the instruction.

Prompt the **delta only**: what that area should become. Short, imperative, one verb per
change — the same shape every edit guide asks for, just narrower.

## Which operation

| Op | What a mask does to it | Use it for |
|---|---|---|
| `edit` (and `kleinEdit`, `krea2Edit`, `qwenEdit`) | re-renders everything inside the mask | changing a thing that is already there |
| `inpaint` | holds everything outside the mask still | adding a thing, or removing one |
| `detail` | above ~0.5 denoise behaves almost like `inpaint`; below it it is detailing, but it can still change the subject a lot | sharpening or reworking a region |
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
   them the Mask tool is in the History workspace on that card. A roughly square area is the
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
