# FLUX.2 Klein: how to prompt it

Five Vision cards resolve to this recipe through the `flux` alias, and they do
different jobs:

- `klein-4b`, `klein-9b` (FLUX.2 Klein, two sizes, one graph): a generator (`t2i`,
  `i2i`), a structure copier (`control`), an instruction editor (`kleinEdit`), and two
  masked ops (`inpaint`, `detail`) that run on a mask the user paints. Ask for one,
  then dispatch (`app:masking`).
- `boogu-edit-high`, `boogu-edit-balanced` (Boogu Image Edit): an instruction editor
  only, one op, `edit`.
- `qwen-edit` (Qwen Image Edit): an instruction editor, `qwenEdit`, plus a structure
  copier, `control`.

## Pick it when

- A fresh image from a description, or a description-level reshape of one: `klein-4b`
  / `klein-9b` `t2i` / `i2i`, the fastest image model Vision ships.
- One clear, describable change on a single image: Boogu `edit` first. Production
  rated it the best understanding of the three editors here, precisely because it only
  takes one reference.
- Something has to be copied out of a second or third image (a garment, a face, an
  object) into a first: Qwen `qwenEdit`, then a Krea 2 `i2i` pass to recover the
  quality Qwen's edit costs. Qwen's own single-image instruction edits are weak: a full
  scene rewrite ("replace the dinosaur with a chicken") measured as ignored. Send that
  to Boogu or `kleinEdit` instead.
- Copying pose or composition off a reference: `control`. Klein and Qwen both offer
  depth; Qwen alone also offers pose (OpenPose).
- Removing an object or a head cleanly: suggest Klein's `inpaint`, but only as
  something the user runs (see Settings). Production measured Qwen unable to remove a
  head and leave the clothing behind; Klein does, reliably.

## Settings

- Klein ships ONE tier on both sizes: cfg 1.0, 4 steps, fixed. No turbo toggle, no
  `qualityTier` on any op. More steps measurably overcooks it.
- `inpaint` and `detail` need a mask painted in History on Klein, exactly as on Krea 2.
  You cannot paint one, so ask the user to, naming the area, and dispatch once they say it
  is drawn; the mask reaches your call on its own. Dispatched with none, both are refused
  (`MASK_UNSUPPORTED`) and told to ask. `kleinEdit` and `i2i` honour a mask too and do NOT
  refuse without one, so a localised ask with no mask painted repaints the whole picture.
  `control` ignores a mask entirely. Full model: `app:masking`.
- Ratios, per op, not a blanket set. Klein's `t2i`, `i2i`, `inpaint`, `detail` and
  `upscale` all offer the nine standard labels (`1:1`, `3:4`, `4:5`, `5:8`, `9:16`,
  `4:3`, `5:4`, `8:5`, `16:9`). `control` and `kleinEdit` offer none: both keep the
  input image's shape. Boogu's `edit` lists the same nine labels too, but production
  measured its actual output as a fixed 1360x768 regardless, so treat the ratio as
  unproven and plan on an upscale afterward if the source resolution mattered. Qwen's
  `qwenEdit` and `control` offer no ratio at all; output follows the source.
- 4B and 9B do not share a style rack. 4B: `None` plus Muppets, Cartoon, Jojo, Anime,
  Chibi, Doodle, Vintage, Aesthetic. 9B: `None` plus Storybook, Comic, Anime, Chibi,
  Doodle, Vintage, Watercolour, different creators behind several of the same-sounding
  labels, so do not expect parity between the two sizes. Boogu offers no style rack at
  all. Qwen offers its own: `None` plus Illustration, Anime 3D, Anime 2D, Anime
  Zankuro, 3D, Caricature, SnapShot.
- Negative prompt: Klein has none (cfg 1.0, bit-identical either way). Qwen has one.
  Boogu differs by tier: `boogu-edit-high` carries a working negative field,
  `boogu-edit-balanced` does not.
- Media roles. Klein's `t2i` takes no image; `i2i`, `inpaint`, `detail`, `upscale`:
  `inputImage` only. `control`
  on Klein and on Qwen: `inputImage` (the depth or pose map) plus up to two more
  optional images. `kleinEdit`: `inputImage` plus up to two more optional references,
  chainable, proven compositing two subjects at correct scale and lighting. `qwenEdit`:
  the same three-image shape. Boogu's `edit`: `inputImage` only, so no reference
  addressing ever applies.

## The prompt shape

Two different shapes, and the op tells you which one you are in.

Generation and structure ops (`t2i`, `i2i`, `control`, `detail`, `upscale`, all
enhanced through this recipe): one paragraph, the subject in the opening words, this
model weights what it reads first. Around 55 words. State the lighting's source,
quality, direction and colour every time; it is the strongest lever this model has.
Name real materials ("brushed aluminium," not "metal") and real camera gear for a
photoreal target.

Every edit op (`kleinEdit`, `edit`, `qwenEdit`) is an instruction, and the enhancer
never touches any of them; you write the final text. Say what changes, not what the
picture already is. Qwen alone understands numbered addressing: point the verb at the
image that should change (an instruction to edit image 1 to match image 2 edited image
1; aiming the verb at image 2 instead edited image 2). Klein's edit names a reference
inside the sentence instead ("the fox from Image 2 sits beside her"), never bare
numbers alone. Boogu needs no addressing at all: there is only ever one image.

## Adapting what the user asked for

Translate a described effect into its real technical name rather than listing its
symptoms. A drag-shutter blur, described piece by piece as streaks and ghosting, cost
two rolls on a Klein edit; naming the actual technique in one sentence produced both
the sharp subject and the light trails at once, because it came from one coherent idea
instead of two competing instructions.

On an edit, decompose a multi-part request into that many short verbs. On Boogu
specifically, fold a relight and a recolour into ONE instruction rather than two
passes: a correction pass on top of an edit tends to overshoot. A single combined
instruction that also states the unwanted cast ("never blue, never grey") took one
generation where two sequential ones took three.

Example. The user asks: "put the leather jacket from my second photo on the woman in
the first one."

```text
Put the jacket from image 2 onto the woman in image 1. Keep her pose, her face and the background of image 1 unchanged; take only the jacket's cut, colour and leather texture from image 2.
```

## When a result disappoints

- Skin shows invented moles, freckles or spots on a Klein generation: name the
  exclusion in the prompt itself ("no moles, no freckles, no blemishes, no spots"),
  measured cutting invented marks by a fifth. There is no negative field to reach for
  instead.
- A reference person or object goes missing, or the wrong one lands, with no error:
  known and silent, measured missing about one in three multi-reference placements on
  9B. Retry rather than assume the prompt was wrong.
- A style that changes anatomy (Muppets, Chibi, Doodle, Jojo) does nothing useful under
  `control`: depth clamps the silhouette to the source, so a transforming style can
  only repaint inside a human outline. Push the transformation into the noun instead
  ("a Muppet woman"), or use a palette style (Vintage, Aesthetic) under control.
- Two people in one Qwen edit both come out wrong: a known weak spot. Edit one subject
  at a time.
- An edit or an upscale looks softer than the source: both measurably lose fine texture
  on every pass rather than restoring it. Generate fresh at the framing you need
  instead of trying to sharpen a pass that already happened.
- Boogu drifts across a second corrective pass (a colour cast overshoots the other
  way): fold the fix into the first instruction instead of chaining a second one, and
  use the negative field on `boogu-edit-high` for a cast you can predict in advance.

## Sources

- BFL's official skills repo (`black-forest-labs/skills`, the `[klein]`-specific
  section) and `docs.bfl.ml`'s prompting guide, recorded in
  `docs/recipes/research/flux-2/sources.md`.
- The enhancer recipe: `js/data/recipes/flux-2.recipe.js`.
- `docs/models/klein/` (`README.md`, `9b.md`, `refcontrol.md`) and
  `docs/models/qwen-edit/` (`README.md`, `tiers-and-loaders.md`).
- Mad Pony's western and Badoxa production findings:
  `C:\AI\Mpi\MadPony-Identity\production\cubric-western\findings\costs.md`,
  `...\h3-prompting.md`, `...\production\badoxa\findings\camera-moves.md`.
