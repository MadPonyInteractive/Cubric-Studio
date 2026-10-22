# MOSS-Image: how to prompt it

One Vision card resolves to this recipe: `moss-image` (MOSS-Image, OpenMOSS). Text to image
only (`t2i`): it has no edit and no image-to-image. Licence Apache-2.0, no gate.

**Its strength is lettering.** Signs, posters, covers, labels and menus come out spelled as
written, even inside long prompts. It was trained on captions that DESCRIBE a finished image, so
the prompt you write is that description, never an instruction.

## Pick it when

- The picture carries words that must be spelled exactly: a sign, a poster, a book cover, a
  label, a menu, a T-shirt slogan, a sticky note. Chinese text renders too.
- The request is long and detailed: it reads prompts of thousands of words.
- A fast draft: Turbo makes an image in about ten seconds.

Not for editing a picture or putting a reference into one: pick an edit model.

## Settings

- **Turbo** (`turbo`) picks the weight: on (default) = a community Turbo merge, 8 steps, about
  ten seconds, no negative prompt; off = the official SFT model, 25 steps, about 30 seconds,
  softer and more natural. "Better quality" is `turbo: false`, never a higher tier.
- Tiers `1k` and `2k`: a tier is only the picture's size. The ratio is a param: never write it
  into the prompt.
- No negative prompt by default. Do not add the vendor's `nsfw, worst quality, ...` list.
- Media roles: none. `t2i` takes no image.

## Boxes (`t2i`)

`boxes` places things: `[{ name, x, y, w, h, desc }]`, with `x, y` the top-left corner and
`w, h` the size, each 0 to 1 of the output picture. Send them when the user says WHERE
something goes. The app turns your prompt and the boxes into MOSS's own layout format: your
prompt becomes the overall description, each box an object with its `desc`. Never write
coordinates, JSON or angle-bracket tags in the prompt yourself, and keep the prompt and each
`desc` saying the same thing. Boxes are fractions of the frame: send the same `ratio`.

## The prompt shape

Plain English prose, one to three paragraphs, usually 80 to 200 words; longer only when there
is a lot of text to place. A description of the finished picture:

1. Open with the medium and the main subject ("Daylight street photograph of a small corner
   bakery ...", "Flat vector illustration of ...").
2. The setting and the composition: framing, viewpoint, and where things are, in words (left,
   right, top, bottom, foreground, background).
3. Lighting, colours, materials and the finer details.
4. Every visible text exactly, in double quotes, with where it sits and how it looks: position,
   reading order, alignment, line breaks, relative size, font style, colour, spacing. Keep the
   user's wording, language, spelling and capitals; never translate it. A line break the user
   wants goes in as a real line break inside the quotes.

Keep everything the user gave: subjects, counts, actions, style, mood, colours, exclusions.
Fill what they left open with concrete choices. A designed image with no text given (a poster,
a menu) gets short, specific copy that fits, never "headline here". Describe only what can be
seen; no sounds, backstory or intentions. No invented dates, prices or names. No quality words
("masterpiece", "8k", "highly detailed"), no lists, headings, JSON or Markdown, no watermark or
signature.

## Adapting what the user asked for

A one-line idea becomes the full description above. A long, rambling request keeps its concrete
content and loses its wording: drop the indecision and the praise, say moods as things that can
be seen, and stay near 200 words. A garbled phrase is written as what it was reaching for.

Example. The user asks: "a bakery sign for Rosa's".

```text
Daylight street photograph of a small corner bakery seen straight on at eye level, its painted wooden shopfront in deep forest green with cream trim. Above the window a long hand-painted sign reads "ROSA'S BAKERY" in tall cream serif capitals, centred, with a thin gold outline, and below it on a smaller line "fresh bread since 1962" in a cream script. The large front window in the lower half shows wicker baskets of round sourdough loaves and a tiered stand of glazed cinnamon buns on a pale marble counter. To the right a narrow glass door carries a small white card in the bottom corner that reads "OPEN" in red block letters. Soft overcast light falls evenly across the facade, the cobblestone pavement in the foreground is still damp, and a potted rosemary bush stands by the door on the right.
```

## When a result disappoints

- A word misspelled or missing: it was not in double quotes, or it was paraphrased. Quote it
  exactly, and say where it sits.
- Text broke onto lines the user did not want: put the line breaks into the quoted text.
- Plain or flat: the prompt was short. Write the full description.
- Too smooth, too sharp, "AI-looking": Turbo is on. Rerun with `turbo: false`.

## Sources

- The Comfy-Org ComfyUI template's prompt-upsampler system prompt (`image_moss_image_t2i.json`,
  MIT), written from OpenMOSS's `moss-image-prompt-enhancer` skill; OpenMOSS `USERGUIDE.md`.
- The enhancer recipe: `js/data/recipes/moss-image.recipe.js`.
- `docs/models/moss/README.md` and the MPI-1180 bench evidence.
