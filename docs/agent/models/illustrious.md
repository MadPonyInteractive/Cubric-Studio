# Illustrious: how to prompt it

Illustrious writes in Danbooru-style booru tags, not sentences: a comma-separated line the
SDXL text encoder reads as discrete labels, not prose. Two Vision cards share this recipe:

- `ill-anime`: animemix v8.0, the general anime checkpoint.
- `ill-anime-beauty`: a mature-register anime checkpoint. Same recipe, same rules; follow
  the user into that register only when they ask for it.

Both run the same six ops: `t2i`, `i2i`, `control`, `inpaint`, `upscale`, `detail`. The
enhancer never rewrites `inpaint` prompts (see Settings).

## Pick it when

- The user wants an anime or illustration look built from a Danbooru tag vocabulary, not a
  photoreal one (that is the `sdxl` photography recipe, a different model family entirely).
- `ill-anime` for a general anime render; `ill-anime-beauty` when the user wants the same
  style pushed toward a mature register.
- Any of the six ops above: this is one grammar for the whole card, not one style for
  generation and another for editing or upscaling.

## Settings

- No quality tier and no turbo toggle exist on this card. Both are Krea 2-only controls
  and never mount here.
- No style rack either: Vision owns LoRA selection in its own UI, and neither checkpoint
  declares one.
- Ratios, on `t2i`, `i2i` and `inpaint`: 1:1, 3:4, 4:5, 5:8, 9:16, 4:3, 5:4, 8:5, 16:9.
  `control`, `upscale` and `detail` keep the input image's own shape.
- Media roles: `t2i` takes no image. `i2i`, `control`, `inpaint`, `upscale` and `detail`
  each take exactly one required `inputImage`. `inpaint` and `detail` work on a mask the
  user paints in History; you cannot paint one, so suggest those ops to the user instead of
  running them.
- `control` is where this card differs from most others in Vision: it offers the full
  four-type picker (depth, pose, scribble, canny), not depth alone, with an adjustable
  control strength.
- `inpaint` is enhancer-exempt: write that prompt yourself, as a short instruction naming
  its target ("remove the tattoo"), not a tag list.

## The prompt shape

One line, comma-separated booru tags, no prose, in this order:

1. The quality header, always exactly these five tags, always first: masterpiece, best
   quality, very aesthetic, absurdres, newest. It is copied, never composed.
2. Subject count: 1girl / 1boy / 1other / solo for a person (age rides on other tags, so
   an old man is still 1boy), or no humans plus the animal or object named next. Without
   this the model varies the head count run to run.
3. Identity or character, when the user named one.
4. Physical traits: hair, eyes, face, or coat and markings for an animal.
5. Attire.
6. Pose, action, expression.
7. Setting: opens on outdoors or indoors, then place and time.
8. Framing: exactly one tag from portrait, close-up, upper body, cowboy shot, full body,
   plus an optional camera-position tag (from side, from below, from behind, dutch angle)
   only when the camera sits away from eye level.
9. Style and finish, last: the line ends on this tag.

Target about 28 tags total (the five-tag header plus roughly 23 body tags), landing near
45 words. That sits inside the architectural ceiling: Illustrious is SDXL, so CLIP's window
is 77 tokens, about 55 words, before the first and most heavily weighted chunk stops
reading new tags. The measured failure runs the other way from what you would expect: short,
under-built lines around 20 tags that skip a required element, not overlong ones.

## Adapting what the user asked for

- Keep everything concrete the user already gave you: character, clothing, colour, setting,
  framing. Never swap in a different or more "interesting" subject.
- Fill every slot above they left open with one committed, specific choice (a colour, a
  garment, a time of day), never a vague one or a gap.
- Group tags by category (hair with hair, attire with attire) rather than interleaving them.
- Follow their register: write a mature scene only when they ask for one, and stay out of
  it when they do not.
- Resolve a vague or garbled word into the nearest real booru tag; never copy the confusion
  through and never silently drop it.
- Never emit a Pony score chain (score_9, source_anime, and the like): that is a different
  model's grammar and measures next to nothing here.
- Never emit LoRA syntax, attention weights, brackets, alternation or BREAK: Vision's plain
  CLIPTextEncode renders them as literal words, not instructions.
- Pick exactly one framing tag, never two competing ones, and keep every tag ASCII.

The user asks: "a girl with silver hair walking through a rainy city at night, cyberpunk
vibe".

```text
masterpiece, best quality, very aesthetic, absurdres, newest, 1girl, solo, silver hair, long hair, hair between eyes, red eyes, jacket, long sleeves, boots, walking, looking at viewer, outdoors, city, night, rain, neon lights, glowing, cowboy shot, detailed background, cinematic lighting, high contrast, illustration
```

## When a result disappoints

- Head count drifts between runs: the subject-count tag is missing; always state one.
- score_9 or similar leaks into the output: that is Pony grammar, not this model's; strip
  it, it does nothing useful here.
- The image reads as over-asked for quality: the five-tag header already is the quality
  request; drop any second quality or resolution tag.
- Two shot-size tags fight each other: keep exactly one framing tag per prompt.
- Hands or feet come out wrong: a known SDXL weakness; do not volunteer them as a focal
  point unless the user asked for them directly.
- The line runs long and the back half seems ignored: trim toward 28 tags. Tags past the
  first ~55 words sit past the window that carries the most weight.
- A bracket, weight or BREAK shows up in the output: the encoder has no such keyword and
  draws it as text; remove it.

## Sources

- Vendor model card: huggingface.co/OnomaAIResearch/Illustrious-xl-early-release-v0, read
  2026-08-17.
- Recipe: `js/data/recipes/illustrious.recipe.js`.
- Research: `docs/recipes/research/illustrious/sources.md` and
  `docs/recipes/research/illustrious/vocabulary-evidence.md` (178 exact-checkpoint plus
  208 broad Illustrious Civitai prompts).
- Licence and register context: `docs/models/community-merges-licences.md`.
- No production field evidence found for this recipe (checked
  `C:\AI\Mpi\MadPony-Identity\production\*\findings\`, 2026-09-16).
