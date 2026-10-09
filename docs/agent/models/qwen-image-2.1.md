# Qwen-Image 2.1: how to prompt it

One Vision card resolves to this recipe: `qwen-image-2-1` (Qwen-Image 2.1). One model
for seven ops: a generator (`t2i`, `i2i`), a structure copier (`control`), an
instruction editor (`edit`, up to eight references), two masked ops (`inpaint`,
`detail`) and `upscale`. It is NOT Qwen Image Edit (`qwen-edit`, whose guide is
`guide:flux-2`): a different model, nothing shared, and its prompts do not carry over.

Its licence is research or evaluation only, and it covers the IMAGES: tell the user the
result is not for commercial use, and never pick it when another model can do the job.

## Pick it when

- A transparent background (a sticker, a product cut-out, a character to composite):
  `t2i`, or `edit` on an existing picture ("remove the background, keep only the
  woman"). The only model here that generates alpha; measured 59-64% of the frame
  cleared with the subject untouched. Every other op returns an opaque picture.
- More than three pictures in one edit: `edit` takes up to eight.
- Exact words in the picture, in any script: its maker leads with typography, and its
  own rewriter copies quoted text character for character. Not yet measured here.
- Copying a pose, depth, scribble or edges off a reference: `control`.

## Settings

- One tier: 30 steps (`detail` and `upscale` 15), cfg 1. No negative field.
- A style rack on every op (`styleSelect`, Stylization 0.7): five photo looks (Lenovo,
  Canon, Samsung, Film Stills, Grainscape), Detail Fix, Natural Exposure and Clay. The
  style's trigger words are appended for you: never write them into the prompt. An `edit`
  with an empty prompt and a style restyles the photo like a filter (a photo look may also
  reframe it). With NO style an empty `edit` is not a no-op (a yellow raincoat came back
  beige): give it a task.
- Ratios in two size classes (`1k`, `2k`) on `t2i` and `i2i`. `edit`, `control`,
  `detail` and `upscale` follow the source; on `edit` the first image sets the output's
  size. The ratio is a param: never write it into the prompt.
- `control` offers depth, pose, scribble and canny, one ControlNet behind all four.
- `i2i` holds a photo until about 0.8 denoise: at 0.65 a "watercolour" prompt stayed a
  photo, at 0.85 it became a painting, with the face drifting further.
- `inpaint` and `detail` need a mask painted in History; you cannot paint one, so ask
  the user to, naming the area, and dispatch once they say it is drawn (`app:masking`).
  `inpaint` and a masked `edit` share one path (LanPaint over a crop round the mask), so
  a localised `edit` needs a mask too; without one, `edit` changes the whole picture.
- Transparency survives `t2i` and `edit` only.
- Media roles: `t2i` takes no image; `i2i`, `inpaint`, `detail`, `upscale` take
  `inputImage`; `edit` takes `inputImage` through `inputImage8`, the first the one
  being changed.

## The prompt shape

Two shapes, and the op tells you which.

**Generation ops (`t2i`, `i2i`, `control`, `detail`, `upscale`; Enhance uses this
recipe).** One long English paragraph describing the FINISHED picture as someone looking
at it would, never instructions to a renderer. Its maker's own prompt rewriter turns any
request, three words or three hundred, into a description of about 400 to 500 words; aim
for about 300. In order:

1. An opening sentence naming the medium (photograph, poster, illustration, close-up),
   a style word, the subject, and the background and its palette: "The image is a
   realistic photograph of ..."
2. The background and the surface the subject sits on.
3. A walk round the frame with positional phrases (in the upper-left corner, across the
   lower third, on the far right), reaching the edges as well as the centre. One subject:
   pose and placement, then face, then body and each garment, then what it holds. A
   person: where each arm and each leg is and what each hand does.
4. Any words in the picture, each in straight double quotes, character for character, in
   its own script, with where it sits and how it looks: a bold black headline across the
   top reads "OPEN LATE". No words wanted: write none.
5. A lighting sentence: source, direction, quality, shadows.
6. One closing sentence on the whole frame: balance, palette, style, mood.

Colours carry a modifier (deep navy, pale cream), surfaces a material (brushed metal,
coarse linen), counts are words (three), ages are life stages (in her thirties). No
quality words (masterpiece, 8K, highly detailed), no ratio, no "create" or "make sure".

On `detail`, describe only what is inside the mask, as a close-up of it. On `upscale`,
describe the picture as it already is. On `i2i`, describe the picture you want, not the
change.

**A transparent background** is asked for in the prompt and nowhere else. Open with
"This is an RGBA image with transparency." and end with "The image has alpha channel and
the background is transparent.", describing no background between them. The shorter
"transparent background, alpha channel" also measured working.

**`edit` is an instruction**, and the enhancer never touches it; you write the final
text. From its maker's own edit rewriter:

- Lead with the operation and say exactly what changes, strongly enough that nobody
  could mistake the result for the input.
- Hold everything else with one clause naming what stays by type and place ("keep her
  face, pose and the background unchanged"). Do not re-describe what you keep: a kept
  thing described in detail reads as something to redraw, and drifts.
- Identity from a reference: point at the image, never describe the face in words.
- Two or more images: name each by its tag, `<image1>`, `<image2>`, in load order,
  which is how the model itself labels them, and say each one's role (the picture being
  changed, the one giving the jacket). One image: no tag, "the image". Plain "image 1"
  also landed ("dress the woman in image 1 in the jacket from image 2", first try).
  Point the verb at the image that should change.
- Words in the picture: quote the exact characters. Keep the language the picture
  already uses unless the user names one, and never mix two languages in one string.
- One paragraph, stated as what to keep rather than what not to change.

## Adapting what the user asked for

A one-line idea is not a one-line prompt here: decide what the user left open (the
setting, what sits at each edge, the light) and describe it. Keep every choice they did
make, word for word where it is a term (anamorphic, low angle), said as something
visible. An instruction about the job ("4K", "make the text sharp") is obeyed and never
written into the prompt.

Example. The user asks: "a poster for a jazz night".

```text
The image is a minimalist editorial poster for a jazz night, set on a deep navy background with accents of warm brass and pale cream. The navy field is smooth and matte, with a faint paper grain across the whole surface. Across the top, a bold cream headline in a tall condensed typeface reads "BLUE NOTE NIGHTS", spanning nearly the full width. Below it, in the centre of the frame, a stylised brass saxophone rises diagonally from the lower left toward the upper right, drawn in flat shapes with a single thin highlight along its bell. On the left side, three small cream circles suggest stage lights, fading in size toward the top. On the right edge, a column of smaller cream text reads "FRIDAY 9 PM" above "LIVE QUARTET". Across the lower third, a thin brass line separates the artwork from a footer that reads "THE CELLAR, 12 DOCK STREET" in small spaced capitals. In the lower-right corner, a tiny cream note symbol sits alone in the navy space. The lighting is flat and even, as on printed paper, with a soft sheen only on the brass shapes. The overall composition is calm and vertical, built on generous negative space, a restrained palette and a warm late-night mood.
```

Example. The user asks: "put the leather jacket from my second photo on the woman in the
first one."

```text
Replace the t-shirt the woman wears in <image1> with the leather jacket from <image2>, keeping the jacket's cut, colour and leather texture exactly and fitting it to her pose and the light of <image1>. Keep her face, hair, pose and the whole background of <image1> unchanged.
```

## When a result disappoints

- A transparent request came back opaque: only `t2i` and `edit` keep alpha. Rerun there
  with the RGBA sentences.
- `i2i` ignored a style change: the denoise is under about 0.8.
- An edit landed faintly: say the change more strongly. The keep clause holds content,
  not the strength of the edit.
- An edit changed something it should not have: name what stays by type and place, and
  stop describing it in detail.
- A short prompt came back plain or generic: write the full description above rather
  than a phrase; the model was trained on long ones.
- Bent, extra-long or tangled arms and legs: the prompt left the limbs unplaced. Rewrite it
  long and say where each limb is. On the same seed, the long form fixed both such
  failures tested.

## Sources

- Its maker's own prompt rewriters (`QwenLM/Qwen-Image-2.1`, `prompt_rewrite/prompts/`),
  recorded in `docs/recipes/research/qwen-image-2.1/sources.md`.
- The enhancer recipe: `js/data/recipes/qwen-image-2.1.recipe.js`.
- `docs/models/qwen-image-2/README.md` and its bench evidence.
