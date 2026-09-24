# Localised edits — working on a mask

A **mask** is an area the user paints over one picture. Paint one and the operation works on
that area alone, at the source image's own size. A maskless edit re-renders the whole picture
instead.

**You never paint a mask. You ask for one, and then you use it.** Whatever the user has
painted reaches every generation you dispatch, together with the picture it was painted over,
and that picture is what gets edited. A mask is never applied to some other image, such as one
attached to the conversation.

Every local model with an edit operation honours a mask: Klein, Krea 2, Qwen, Boogu, Chroma,
SDXL, Pony, Illustrious. Cloud models do not.

## Which route

A mask is more effective, and it costs the user the painting. One question settles it:
**does the change stay inside ONE area of the picture?**

Whether the ask *names* a thing is the wrong test. Light, sky, time of day, weather, season
and style fall on everything in the frame, so "make the sky red, like dawn" changes the whole
picture. Several asks in one message are one edit: an edit model makes them all in one pass.

| The ask | Route | Do you ask? |
|---|---|---|
| not one area: "make it night", "make this an oil painting", a sky or lighting change, several asks at once | whole picture, ONE edit | no, just run it |
| one area, **and words protecting the rest**: "without changing anything else", "only this area" | masked | no, they chose: ask for the mask |
| one area, no such words: "change her hair to red", "change his pose" | either | yes: one line, both routes, your recommendation, then wait |

Three bounds keep the third row from turning into a menu: at most three routes, one line each,
in the user's words; only at a genuine fork; always recommend one.

**A mask keeps the pixels.** A whole-picture edit comes back at the model's working size
(about one megapixel on Klein). A masked op keeps the source's own size and every pixel outside
the paint. Offer a mask when the picture is a big photo, or when they say an edit lost quality
or "crushed" their pixels. An ordinary add on an ordinary picture is a whole-picture edit,
faster and usually better.

## Write for the crop, not the picture

**The model sees only what is inside the mask**, cropped out and blown up to fill the frame.
The rest of the picture never reaches it, so describing the rest is noise the model tries to
draw.

The user's words describe the picture from OUTSIDE, because they can see all of it. Your
prompt describes the crop from INSIDE. Never name the region ("the reflection", "the
background"), what it sits in ("in the water"), or what surrounds it.

Masked over a boy's reflection in a river:

- Right: `convert the boy into a demon version of himself`
- Wrong: `turn the boy in the water reflection into a demon version of himself, faint red aura reflected in the water`

The wrong one names water and a reflection the model cannot see, so it draws them: an upright
demon rising out of water, with its own reflection beneath it.

### Keep it short

For the edit family, a **verb** and a **target**. Add a detail only when the user named it.

- Right: `convert the boy into a demon version of himself`
- Wrong: `convert the boy into a demon: glowing red eyes, sharp horns, pale grey skin, a sinister grin`

The adjective list replaces the subject instead of transforming it, and the likeness goes.

## The shape depends on the op

**`edit` / `kleinEdit` / `krea2Edit` / `qwenEdit`: an instruction.** A verb on what is there.

> convert the boy into a demon version of himself

**`detail`: a description of what is already there.** A noun phrase, never an instruction.

> beautiful redhead woman, green eyes, freckles

Under about 0.5 denoise that sharpens what is there. Above it you get a NEW redhead woman, so
the denoise matters as much as the words.

**`inpaint`: add or remove.** To remove, say so; to add, name the thing. Which of the two add
forms fits depends on how the mask is drawn, which you cannot see.

> remove the flower from the vase
>
> a flower  ·  add a flower to the vase

**These two are trial and error.** Denoise, mask shape and wording all move the result and none
is visible to you, so say what you are about to send before you send it.

## Which operation

| Op | What a mask does to it | Use it for |
|---|---|---|
| `edit` (and `kleinEdit`, `krea2Edit`, `qwenEdit`) | re-renders everything inside the mask | changing a thing that is already there |
| `inpaint` | holds everything outside the mask still | adding a thing, or removing one |
| `detail` | above ~0.5 denoise behaves almost like `inpaint`; below it, detailing | sharpening or reworking a region, prompted as a DESCRIPTION |
| `i2i` | honours it: the mask drives the same crop | a restyle confined to a region |
| `control` | **ignores it** | never reach for it to localise |

`inpaint` and `detail` **require** a mask and refuse without one. `edit`, `kleinEdit` and `i2i`
do not: without a mask they repaint the whole picture and report success. So pick the op that
matches the job, and make sure a mask is painted.

## Several separate areas

- **detail** works each area on its own crop, all in one run. The prompt is ONE list, a noun
  phrase per area:

  > cute girl with freckles, wooden chair, lady hand

- **edit and inpaint** crop ONE box around every painted area. Two areas far apart make that
  box the whole picture, the new things land outside the paint and are thrown away, and the
  result comes back unchanged. generate refuses it with `MASK_SEVERAL_AREAS`: one area per run.

## A small area: enlarge first

The masked area is sampled as a crop of about 1024 px. A small area, a face in a crowd or a
sign far away, gives the model very few pixels to work from. Enlarge the whole picture first
with a plain resize (not an upscale model, which invents detail), then run the masked op on the
bigger picture. You cannot resize it yourself: ask the user to run Resize from the toolbar
down the left, then paint the mask on the resized version.

## When it comes back wrong

Nothing predicts which op wins on a given picture: `inpaint` can beat `kleinEdit` on a picture
`kleinEdit` was the obvious choice for. So the next move is a **different op** or a **simpler
prompt**, never more adjectives on the same one.

A masked **add** that misses usually wants the **mask** changed, not the model. Paint ONE area,
only where the new things go, and send an instruction with a verb:

- Right: mask the chairs only, `add people sitting in the chairs`
- Wrong: one mask over the chairs and part of the pool, `people sitting in the chairs`

Adding and removing also vary run to run, so another try on the same mask can land too.

## The flow

1. Settle the route (**Which route**). If it is theirs to choose, offer it in one line and wait.
2. Name the op you will run, say what to paint over, and tell them the way there: click the
   card in the gallery to open it, then pick the Mask tool from the toolbar down the left. If
   they are already looking at the card, skip the first half. Never say "History": it is
   written nowhere on screen. A roughly square area is the natural shape.
3. They paint it and tell you to go ahead.
4. Dispatch the op, prompting for the masked area only.

Never offer to paint it yourself, and never choose the area for them: with several people in a
picture you cannot know which one they meant.

## What to expect back

The picture keeps its **source size**. Only a crop around the mask is sampled and stitched back
in, which is how a very large image (8K, 16K) gets edited at all. Never offer an upscale
afterwards to "restore" the size; nothing was lost.

## Not covered yet

- **Video.** A mask on a video card does not reach a generation.
- **The GIF cut-out ops** (`gifCutoutSam3`, `gifCutoutBirefnet`) build their own masks from a
  name, or automatically; you pass none. A GIF lands as an image card, so the Mask tool works
  on one like any other picture.
