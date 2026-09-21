# PONY Mix: how to prompt it

Pony Mix reads booru tags, not prose: one comma-separated line built around a fixed four-tag
header, on a Pony Diffusion V6 XL base (an anime merge). One Vision card uses this guide:
`pony-mix`, offering `t2i`, `i2i`, `control`, `inpaint`, `upscale`, `detail`. Its `type` is
`sdxl`, the same family as the photography
cards, but `js/data/modelConstants/models.js` sets `enhanceRecipe: 'pony'` explicitly:
without that line it would silently fall onto the SDXL photography recipe and hand back
film-stock prompts with no score chain at all, so the two recipes are not interchangeable
even though they share an architecture.

## Pick it when

- The user wants an anime or illustrated look rather than a photograph: `pony-mix` is
  Vision's stylized anime card; photoreal requests belong to the `sdxl` guide instead.
- A single clean character illustration, cel-shaded or painterly, is the goal: this
  checkpoint's own training leans that way.
- The request calls for mature content: this checkpoint produces it readily, so match the
  user's own register rather than holding back or pushing further than asked (see Adapting).
- The job is structural (copy a pose, depth map, scribble or edge map onto a new subject) or
  an upscale on an existing `pony-mix` image: the same recipe drives every op, the same as
  SDXL.
- The user wants a masked fix (`inpaint` or `detail`): both need a mask painted in History
  first, which you cannot do yourself. Ask for it, naming the area, then run the op once
  they say it is drawn; the mask reaches your call on its own.

## Settings

No quality tiers, no turbo toggle and no style rack on any op
(`tests/fixtures/agent/connector-models.json`). `t2i`, `i2i` and `inpaint` offer the full
ratio set (`1:1, 3:4, 4:5, 5:8, 9:16, 4:3, 5:4, 8:5, 16:9`); `control`, `upscale` and `detail`
follow the source image's size instead.

Media roles (one required image per op that takes one; `t2i` takes none): `i2i`, `control`,
`inpaint`, `upscale` and `detail` each take a single required `inputImage`.

- `inpaint` and `detail` both require a mask (`requiresMask: true`) painted onto the image in
  History. You cannot paint one, so ask the user to and dispatch once they say it is drawn;
  called with none, both are refused and told to ask. `i2i` takes the same mask and does NOT
  refuse without one, so a localised ask with no mask repaints the whole picture. `control`
  ignores a mask. Full model: `app:masking`.
- `control` also shows a `controlType` picker (depth, pose, scribble, canny) and a strength
  slider; describe the subject and scene, never the pose or edges the control map already
  supplies.
- `i2i` (denoise default 0.30) and `upscale` / `detail` (0.20 / 0.30) work the same way here
  as on the photography cards: describe the finished picture, not the edit, and lean on it
  harder as denoise climbs. `detail` takes bare nouns per mask when several areas are marked
  ("hair, sword, boots") and is happy with an empty prompt at a low denoise.
- `inpaint` needs an actual instruction once a mask is in place; to erase something, name it.

The model needs clip skip 2 in the workflow to avoid low-quality output; that is Vision's job,
not the prompt's, so it is never something to fix by padding the tag line.

The negative field is live (`pony-mix` never sets `negativePrompt: false`), but this recipe
writes the positive line only. The useful negative here is a fixed constant, the score floor
`score_1` through `score_6`, which needs no rewriting per request; it belongs in Vision's own
negative default rather than in anything generated per prompt.

## The prompt shape

One line of comma-separated booru tags, about 24 of them, 25 to 75 words end to end (checked).
It opens on a fixed four-tag header that is copied exactly, never composed: `score_9,
score_8_up, score_7_up, source_anime`, always in that order, always first. Everything else
follows in order: a subject-count tag, identity or character, physical traits (hair, eyes,
face), attire, pose and expression, background and setting, framing and camera angle, and a
style or finish tag that is also the last tag in the line.

The subject-count tag is chosen, not written freely: `1girl`, `1boy`, `1other`, `2girls`,
`2boys` and so on for a person (age is not what the count tracks; an old man is still
`1boy`), plus `solo` when exactly one figure is in frame, or `no humans` followed immediately
by naming the animal or object when there is no person at all. Skipping it is why head count
drifts between otherwise identical runs.

The line stops at the finish tag; there is no separate `NEGATIVE PROMPT:` block here despite
the recipe's negative-capable schema (see Settings), and no sentence punctuation, brackets or
A1111 syntax (`BREAK`, `<lora:...>`, `[a, b|c, d]`) anywhere in it. These are measured
failures, not style preferences: a two-out-of-two judge pass let every one of them through
repeatedly in testing, so treat them as fixed syntax rules rather than something you can catch
by reading the line back.

## Adapting what the user asked for

- Translate the request into tag nouns and short phrases, not sentences: "a girl with pink
  hair in a school uniform" becomes `1girl, solo, pink hair, school uniform`, slotted into the
  order above, not restated as a clause.
- Resolve the subject count before anything else: decide whether a person is in the picture
  at all, then pick the one count string that fits.
- Fill every slot even where the user left it open. An unstated hair colour, setting or finish
  is still a decision you make and write down as a tag, not a gap left for the model.
- Whatever the user already decided (character, colour, clothing, setting) is written in
  before anything you invent yourself; when the tag budget is tight, trim your own additions
  first.
- Match the user's own register. Go mature only as far as they asked, and never volunteer a
  `rating_` tag on your own.
- Leave photography vocabulary (camera bodies, film stock, f-stops) to the `sdxl` guide; it
  means nothing to this anime checkpoint.
- Group related tags together (hair with hair, clothing with clothing) instead of
  interleaving them; that is the measured convention on this checkpoint, not a preference.

The user asks: "make a picture of a knight girl with silver hair standing in a ruined castle
at night."

```text
score_9, score_8_up, score_7_up, source_anime, 1girl, solo, knight, silver hair, long hair, blue eyes, ornate armor, cape, standing, holding a sword, determined, ruined castle, night, moonlight, detailed background, full body, dynamic pose, illustration
```

## When a result disappoints

- Head count drifts between runs, or extra figures appear: the subject-count tag was missing.
  State one every time.
- The image reads as a toy-horse or MLP style: `source_pony` slipped in somewhere; use
  `source_anime` only. `source_pony` / `source_furry` / `source_cartoon` all measure at zero
  on this checkpoint.
- Colours or finish look generic rather than this checkpoint's own look: the header was
  dropped, reordered or diluted with other tags ahead of it. It has to lead, in exactly that
  order.
- A literal word like "BREAK" gets drawn, or stray brackets show up: A1111 syntax leaked into
  the line; this encoder has no such keyword and draws it as text.
- A count reads oddly, like a number welded to an unrelated noun: write it in words instead
  ("two cats"); the digit-led forms are reserved for the fixed count tags.
- Output looks soft or blobby even with a clean prompt: check clip skip is 2 in the workflow
  before touching the prompt at all.
- Content goes further than the user asked: a `rating_` tag was volunteered, or implied by
  other tags reaching past their actual register. Pull back to what they asked for.
- The reply trails a sentence or ends in punctuation: it should end on the last letter of a
  style tag, nothing after it.

## Sources

- `docs/recipes/research/pony/sources.md`: no vendor prompting skill exists for Pony
  (`docs/recipes/playbook/08-vendor-prompt-skills.md`); primary sources are AstraliteHeart's
  own Pony V6 XL model card (HF mirror), the Siberpone `lazy-pony-prompter` template, and a
  community booru-tagging guide.
- `docs/recipes/research/pony/vocabulary-evidence.md`: the measured corpus (32 prompts on this
  exact checkpoint, 209 on base Pony) behind the three-tag score chain and the per-slot
  vocabulary.
- `js/data/recipes/pony.recipe.js`.
- `docs/models/community-merges-licences.md`: `pony-mix`'s checkpoint identity and licensing,
  and why every SDXL-family merge here, this one included, is non-commercial regardless of its
  own base licence, through the DMD2 LoRA in the merge recipe.
- No dedicated field-evidence findings exist yet for `pony-mix` in
  `MadPony-Identity/production/*/findings/` (checked 2026-09-16).
