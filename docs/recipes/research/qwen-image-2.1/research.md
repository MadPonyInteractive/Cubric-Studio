# Research — Qwen-Image 2.1

Answers to the seven questions of playbook 01 § 1.3, each with its source number from
[`sources.md`](sources.md). The vendor rewriter prompts (#1, #2) are the specification; the rest
confirm, constrain or are rejected there.

## Why this recipe exists

Qwen-Image 2.1 shipped (MPI-936) borrowing `enhanceRecipe: 'flux'`, which resolves to `flux-2`:
Klein's recipe, 35-120 words, five slots, condense-first because Klein's encoder weights early
tokens. The vendor's own rewriter does the opposite: it EXPANDS every brief, three words or three
hundred, into a ~450-word observational paragraph (#1). The borrowed recipe was cutting Qwen
prompts towards the length its maker rewrites them away from.

## The rewriter prompts are not part of the encoder

Asked by Fabio 2026-10-09. They belong to two separate 9B rewriter checkpoints (PE-T2I, PE-I2I,
~20 GB each in bf16) that Vision does not ship (`docs/models/qwen-image-2/README.md` § Skipped).
The encoder's template is one fixed line, "Comprehend and analyze the provided prompt.", and the
user's text goes in raw (#4). Nothing between the Prompt Box and the model rewrites a prompt, so
this recipe is the only rewriter a Vision user gets.

## 1. Output format and length

- One English prose paragraph, present tense, third person, describing the FINISHED image as an
  observer would; never instructions (#1). Edits are the exception: an instruction (#2), but
  edits never reach the enhancer.
- **Length (#1): "about twenty sentences and four to five hundred words, roughly twenty-five
  words a sentence", the same size for any brief; a dense multi-region frame runs longer, a
  quiet single subject shorter.**
- No hard limit from the encoder side: Qwen3-VL-8B, no prompt token cap in ComfyUI (#4). The
  app's enhancer generates up to 2048 tokens (`Input_Text_Gen.max_length`), ~1500 words.
- **Draft number: stated 250-350, checked 200-400.** Reason: the harness `overlong` tier is a
  410-word brief and `condensed` requires a shorter output, so a 400-500 target fails the condense
  job by construction. Playbook 2.5 takes the more restrictive constraint; #6 (other model) and
  #7 (short bench prompts render) both point shorter. The vendor's STRUCTURE is kept whole; only
  the per-region sentence count shrinks. Stage 2 question: does the full 450-word form render
  better at 25 steps int8?

## 2. Structure order (#1, steps 3-8)

1. Opening sentence, ~20 words: medium (never omitted), style word, subject, background and
   palette. `The image is a <style> <medium> of <subject>, <background and palette>.`
2. The background and the surface it sits on, straight after the opening.
3. Walk the frame. Divided frame (poster, layout, wide scene): top band, then left, centre,
   right of the body, then bottom band. Single subject: background falloff, pose and placement,
   head and face, body and each garment or surface, what is held, the edges. About a third of
   sentences open on a positional phrase; 8-14 positional phrases reaching corners and edges.
4. Every legible string, in reading order: position, look (weight, colour, case, size), and the
   text in straight double quotes, character for character, in its own script. Skipped when the
   picture has no text; never invent signage.
5. A lighting sentence: source, direction, quality, shadows and highlights.
6. ONE closing sentence on the whole frame: balance, palette, style, mood.

## 3. Vocabulary (#1, confirmed by #5)

- Colours always carry a modifier: deep navy, muted olive, pale cream, warm terracotta.
- Materials, not bare nouns: brushed metal, matte plastic, glossy ceramic, coarse linen,
  weathered wood, frosted glass, visible brush strokes.
- Photographic and design terms welcome: shallow depth of field, bokeh, backlit, close-up,
  negative space, grid, drop shadow.
- Style words: realistic, photorealistic, minimalist, flat-vector, cinematic, watercolour,
  isometric, editorial, hand-drawn, 3D-rendered, retro.
- Not corpus-measured (no Qwen-Image 2.1 corpus exists). These are the vendor's own words in its
  own rewriter prompt, i.e. the words its training captions were written in, so they are carried
  as vendor vocabulary, not as a measured register. No `styleVocabulary`.

## 4. Failure modes, dos and don'ts

- No quality boosters: masterpiece, 8K, highly detailed, award-winning (#1, #5).
- No ratio, resolution or pixel count in the prose (#1, #2): the canvas is a separate field.
- No "you", "create", "make sure": describe, never instruct (#1).
- Enumerate, never summarise ("several items" is not a description); small counts as words (#1).
- People: build, posture, gaze, expression, hair, skin tone, each garment's colour and
  material; age as a life stage, never a number of years (#1).
- Objects by class, not brand, unless the user named one (#1).
- An instruction about the job ("4K", "make the text sharp", "use double quotes") is obeyed
  silently and never echoed (#1).
- Physically coherent: shadows away from the light, consistent scale (#1).
- Hedging ("appears to be", "likely") is the rewriter's native register for invented detail
  (#1); kept as permitted, not required, since the user's own choices must stay definite.

## 5. Negatives

None. Vision runs cfg 1, where the negative conditioning is inert (#7); the vendor rewriter
always emits an empty negative (#3). `negativeHandling: 'none'`. A user's exclusion becomes a
positive description of what is there.

## 6. What is unique

- Text rendering with exact strings in any script (#1, #3): the prose is English, quoted text
  stays in its own script.
- **Native transparency (#3, #7):** asked for in the prompt only. Official template: open with
  "This is an RGBA image with transparency." and end with "The image has alpha channel and the
  background is transparent." Survives only on t2i and edit in Vision (#7).
- References are labelled `<image1>`, `<image2>` by the encoder itself (#4) and the edit
  rewriter mandates those tags (#2): a guide fact, not a recipe one.
- Ratio inference belongs to the rewriter in the vendor pipeline; in Vision it is the user's
  ratio picker, so the recipe never names an orientation the user did not (sources Conflict 2).

## 7. Examples

Official short prompts (#3), verbatim:

- `A neon shop sign that reads "QWEN IMAGE 2.1", rainy night, reflections on wet pavement`
- `This is an RGBA image with transparency. A cute cartoon dragon sticker. The image has alpha channel and the background is transparent.`
- `A capybara reading a book by candlelight`

The long form is described by #1's eight steps rather than shown; the rewriter's outputs are not
published, so no long official example exists to copy.
