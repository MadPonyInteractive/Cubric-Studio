# MOSS-Image: how to prompt it

One Vision card resolves to this recipe: `moss-image` (MOSS-Image, OpenMOSS). Ops: `t2i`, plus
`i2i`, `inpaint`, `detail` and `upscale` on a picture. It has no `edit`: it cannot read a
reference picture. Licence Apache-2.0, no gate.

**Its strength is lettering.** Signs, posters, covers, labels and menus come out spelled as
written, even inside long prompts. It was trained on captions that DESCRIBE a finished image, so
the prompt you write is that description, never an instruction.

## Pick it when

- The picture carries words that must be spelled exactly: a sign, a poster, a book cover, a
  label, a menu, a T-shirt slogan, a sticky note. Chinese text renders too.
- The request is long and detailed: it reads prompts of thousands of words.
- A fast draft: Turbo makes an image in about ten seconds.

Not for an instruction edit or putting a reference into a picture: pick an edit model. Its
`inpaint` is the way to put new lettering onto an existing picture: mask the area, describe it.

## Settings

- **Turbo** (`turbo`) picks the weight: on (default) = a community Turbo merge, 8 steps, about
  ten seconds, no negative prompt; off = the official SFT model, 25 steps, about 30 seconds,
  softer and more natural. Always send `turbo: true`, also for "beautiful" or "best quality":
  Turbo makes the cleaner picture and SFT adds detail it leaves messy. `turbo: false` only when
  the user asks for it (turbo off, SFT, the slower model) or a Turbo result looks too smooth.
- One size, about 1 MP (MOSS is trained there; 2K bent limbs). A bigger picture = render, then
  the `upscale` op. The ratio is a param: never write it into the prompt.
- No negative prompt by default. Do not add the vendor's `nsfw, worst quality, ...` list.
- Media roles: `t2i` takes none. `i2i`, `inpaint`, `detail` and `upscale` take one picture
  (`inputImage`); `inpaint` and `detail` run only on a painted mask, and their prompt describes
  only the masked area.
- `i2i` restyles the whole picture: `denoise` says how far it may move. `upscale` is a single
  pass by default; `tiles: true` redraws it in tiles, each named by the app, and then the prompt is only
  the look ("sharp photograph, fine film grain"), never the scene.
- Style rack: `None` plus four LoRAs (Anime, Gouache, Psychedelic Pop, Pixel Art), offered on
  every op. Each appends its own trigger phrase after the prompt automatically: never write
  one into the prompt. Prefer Turbo with a style: SFT adds more detail but leaves it messy.
  The prompt still names the medium ("A pixel art illustration of ..."), so the words and
  the LoRA pull the same way.

## Boxes (`t2i`)

`boxes` places things: `[{ name, x, y, w, h, desc }]`, with `x, y` the top-left corner and
`w, h` the size, each 0 to 1 of the output picture. Send them when the user says WHERE
something goes. The app turns your prompt and the boxes into MOSS's own layout format: your
prompt becomes the overall description, each box an object with its `desc`. Never write
coordinates, JSON or angle-bracket tags in the prompt yourself, and keep the prompt and each
`desc` saying the same thing. Boxes are fractions of the frame: send the same `ratio`.

## The prompt shape

Plain English prose, one to three paragraphs, usually 80 to 200 words; up to about 250 for a
long, detailed request or a lot of text to place. A description of the finished picture:

1. Open with the medium and the main subject ("Daylight street photograph of a small corner
   bakery ...", "Flat vector illustration of ..."). No medium or style asked for: a photograph.
2. The setting and the composition: framing, viewpoint, and where things are, in words (left,
   right, top, bottom, foreground, background).
3. Lighting, colours, materials and the finer details.
4. Every visible text exactly, in double quotes, with where it sits and how it looks: position,
   reading order, alignment, line breaks, relative size, font style, colour, spacing. Keep the
   user's wording, language, spelling and capitals; never translate it. A line break the user
   wants goes in as a real line break inside the quotes.

Where the user says the picture is taken from, the camera stands there: a photograph taken from
a plane as someone jumps shows them from behind, in the open door. An action keeps its moment.
Say how much of the frame the main subject fills, and keep it large unless the user asked for
it small or far away. End on something visible, never on what the picture conveys or evokes.

Keep everything the user gave: subjects, counts, actions, style, mood, colours, exclusions.
Fill what they left open with concrete choices. A designed image with no text given (a poster,
a menu) gets short, specific copy that fits, never "headline here". Describe only what can be
seen; no sounds, backstory or intentions. No invented dates, prices or names. No quality words
("masterpiece", "8k", "highly detailed"), no lists, headings, JSON or Markdown, no watermark or
signature.

## Adapting what the user asked for

A one-line idea becomes the full description above. A long, rambling request keeps its concrete
content and loses its wording: drop the indecision and the praise, say moods as things that can
be seen, and stay under 250 words. A garbled phrase is written as what it was reaching for.

Example. The user asks: "a bakery sign for Rosa's".

```text
Daylight street photograph of a small corner bakery seen straight on at eye level, its painted wooden shopfront in deep forest green with cream trim. Above the window a long hand-painted sign reads "ROSA'S BAKERY" in tall cream serif capitals, centred, with a thin gold outline, and below it on a smaller line "fresh bread since 1962" in a cream script. The large front window in the lower half shows wicker baskets of round sourdough loaves and a tiered stand of glazed cinnamon buns on a pale marble counter. To the right a narrow glass door carries a small white card in the bottom corner that reads "OPEN" in red block letters. Soft overcast light falls evenly across the facade, the cobblestone pavement in the foreground is still damp, and a potted rosemary bush stands by the door on the right.
```

## When a result disappoints

- A word misspelled or missing: it was not in double quotes, or it was paraphrased. Quote it
  exactly, and say where it sits.
- Text broke onto lines the user did not want: put the line breaks into the quoted text.
- Plain or flat: the prompt was short. Write the full description.
- The subject came out small, far away or seen from the wrong side: the prompt never said where
  the camera is or how much of the frame the subject fills. Say both.
- Too smooth, too sharp, "AI-looking": Turbo is on. Rerun with `turbo: false`.

## Sources

- The Comfy-Org ComfyUI template's prompt-upsampler system prompt (`image_moss_image_t2i.json`,
  MIT), written from OpenMOSS's `moss-image-prompt-enhancer` skill; OpenMOSS `USERGUIDE.md`.
- The enhancer recipe: `js/data/recipes/moss-image.recipe.js`.
- `docs/models/moss/README.md` and the MPI-1180 bench evidence.
