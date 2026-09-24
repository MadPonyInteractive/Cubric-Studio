# Localised edits — working on a mask

A **mask** is an area the user paints over one picture. Paint one and
the operation works on that area alone, at the source image's own size. A maskless edit
re-renders the whole picture instead — which is sometimes fine, and sometimes exactly the
damage the user did not want. Which of the two a request wants is the first thing to settle,
and it is not always yours to decide: see **Which route** below.

**You never paint a mask. You ask for one, and then you use it.** The app hands whatever the
user has painted to every generation you dispatch, so once they say it is drawn you simply
run the op. The mask travels with the picture it was painted over, and that picture is what
gets edited - so a mask is never applied to some other image you were handed, such as one
attached to the conversation.

Masking is a property of the **app**, not of one model. Every local model with an edit
operation honours a mask — Klein, Krea 2, Qwen, Boogu, Chroma, SDXL, Pony, Illustrious.
Cloud models do not: nothing is painted on their side.

## Which route

A mask is more effective. It is not always worth what it costs the user, who has to paint
it. Forcing one on every regional change is its own failure.

One question settles it: **does the change stay inside ONE area of the picture?**

Whether the ask *names* a thing is the wrong test. Light, sky, time of day, weather, season
and style fall on everything in the frame: "make the sky red, like dawn" names the sky and
still changes the whole picture. And **several asks in one message are one edit** — an edit
model makes them all in one pass, so never split them into a job each.

> Fabio, 2026-09-22, on "make the sky reddish like dawn, and put red eyes in the forest":
> *"An edit model can do multiple things at once. The sky change would need to be on the
> full image. The eyes in the forest could possibly be masked, but there's no point. This
> can be done in one go."*

| The ask | Route | Do you ask? |
|---|---|---|
| not one area — "make it night", "make this an oil painting", a sky or lighting change, several asks at once | whole picture, ONE edit | no, just run it |
| one area, **and words protecting the rest** — "without changing anything else", "only this area", "keep the rest as it is" | masked | no, they chose already — ask for the mask |
| one area, no such words — "change her hair to red", "change his pose" | either | yes — one line, both routes, your recommendation, then wait |

> Fabio, 2026-09-22: *"a lot of these edits don't need a mask. The mask is more effective,
> but shouldn't always be forced on the user."*

Three bounds keep that third row from turning into a menu:

- **At most three routes**, one line each, each naming what it does in the user's words.
- **Only at a genuine fork.** A request with one honest answer gets no options.
- **Always recommend one.** Never "here are your options, which would you like?"

## The one rule that changes your prompt

**The model sees only what is inside the mask** — cropped out and blown up to fill the
frame. It has no view of the rest of the picture, so describing the rest is not context —
it is noise the model tries to draw.

Mask the boy's reflection in the river, and the prompt is:

> convert the boy into a demon version of himself

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

### Keep it short

Crop-local is necessary and not sufficient. The same mask was run again with a prompt that
named nothing outside it:

> convert the boy into a demon: glowing red eyes, sharp horns, pale grey skin, a sinister
> grin

The adjective list **replaced** the boy instead of transforming him — the likeness went with
it, and the plain `convert the boy into a demon version of himself` kept more of it. Both
rendered, Fabio, 2026-09-22.

So for the edit family: a **verb** and a **target**. Add a detail only when the user named
that detail themselves.

## The shape depends on the op

Three ops, three ways of writing the same ask. Using one op's shape on another wastes the
run — ask what the model is looking at, and what it is being asked to do with it.

**`edit` / `kleinEdit` / `krea2Edit` / `qwenEdit` — an instruction.** A verb, on what is
already there. It re-renders the mask, so tell it what to make of it.

> convert the boy into a demon version of himself

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

### When it comes back wrong

Nothing about the graph predicts which op wins on a given picture. `inpaint` beat `kleinEdit`
on the reflection above, which `kleinEdit` was the obvious choice for (Fabio, 2026-09-22).

So the next move after a bad result is a **different op**, or a **simpler prompt** — never
more adjectives on the same one. Piling detail onto a prompt that already missed is how a
run gets spent twice for one answer.

A masked **add** that misses usually wants the **mask** changed, not the model. Fabio,
2026-09-24: "people sitting in the chairs" under a mask that also covered part of the pool
came back poor. What fixed it was painting only the chairs, and the instruction

> add people sitting in the chairs

with a verb, as edit takes. So recommend that first, in one line: paint ONE area, only where
the new things go. Adding and removing also vary run to run, so say another try on the same
mask can land too. A result that comes back **unchanged** is the several-areas failure below:
ask whether they painted more than one area.

### Several separate areas: detail only

The user can paint several separate areas, say a face, a hand and a chair. How that goes
depends on the op:

- **detail** works each area on its own crop, all in one run. The prompt is ONE list, a
  noun phrase per area (Fabio, 2026-09-24):

  > cute girl with freckles, wooden chair, lady hand

- **edit and inpaint** crop ONE box around every painted area. Two areas far apart make that
  box the whole picture, squeezed to the model's working size. The model then puts the new
  things where the whole scene suggests, outside the paint, and only the painted pixels are
  kept, so the result comes back **unchanged**. Live 2026-09-24: the chairs masked in both top
  corners, people drawn beside the girl and thrown away. For edit and inpaint: **one area per
  run.**

### A mask keeps the pixels

A whole-picture edit comes back at the model's working size (about one megapixel on Klein).
A masked op keeps the source's own size and every pixel outside the paint. So a mask is the
answer when the picture is a big photo, or when they say an edit lost quality or "crushed"
their pixels: offer it then. An ordinary add ("put people in the chairs") on an ordinary
picture is a whole-picture edit, faster and usually better (Fabio, 2026-09-24).

## The flow

1. The user asks for a change to part of a picture. Settle the route first (**Which route**):
   a mask, or the whole picture. If it is theirs to choose, offer it in one line and wait.
2. Once a mask is the route: name the op you will run, say what to paint over, and tell
   them the way there in the app's own words: click the card in the gallery to open it, then
   pick the Mask tool from the toolbar down the left. If they are already looking at the card
   (the App state line says so), skip the first half. Never say "History" or "the History
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
