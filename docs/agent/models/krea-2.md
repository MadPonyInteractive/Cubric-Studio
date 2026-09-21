# Krea 2: how to prompt it

Krea 2 is Krea's own foundation model, not a Flux derivative: a Qwen3-VL-4B language
encoder reads the prompt as prose, not tags. Two cards use this guide, same rules:

- `krea2`: the SFW card.
- `krea2-nsfw`: the same seven ops. Its NSFW bake is trained heavily on photoreal
  source, so it is weaker at anime or stylised subjects than the SFW card, a bake
  limitation, not a wiring bug. Steer a stylised prompt to `krea2` instead.

Both run `t2i`, `i2i`, `control`, `krea2Edit`, `inpaint`, `detail`, `upscale`.

## Pick it when

- The user wants a fresh, high quality image from a description, or wants an existing
  image reshaped toward a new description (not an instruction): `t2i` / `i2i`.
- A reference should hand over its pose or composition only: `control` (depth is the
  only control type this model has).
- One clear change needs to land on a specific image, with the source's own identity
  and materials otherwise held: `krea2Edit`. Treat it as the third choice, not the
  first: production found it fails more often than Boogu or Qwen Image Edit at the
  same job. Reach for it when those are not installed, or when Krea 2's own bake is
  worth the extra risk.
- The user wants to paint out or regenerate one area of an image: `inpaint` or `detail`.
  Both need a mask painted in History. You cannot paint one, so ask the user to, naming the
  area, and run the op yourself once they say it is drawn; the mask reaches your call on
  its own. Dispatched with none, both are refused (`MASK_UNSUPPORTED`). `krea2Edit` and
  `i2i` take the same mask and do NOT refuse without one, so a localised ask with no mask
  painted repaints the whole picture. Full model: `app:masking`.

## Settings

- Turbo defaults ON. Quality is close to a wash between the two speeds, so the app
  opens on the fast one. Drop to Raw only for a specific reason.
- `qualityTiers`: `1k` / `2k`, offered on every op. Opens on `1k` when nothing is
  saved. `2k` is roughly double the pixels for roughly double the time, at no quality
  cost, so it is worth it whenever the result will be inspected closely.
- Ratios, per op, not a blanket set: `t2i`, `i2i` and `inpaint` offer the nine standard
  labels (`1:1`, `3:4`, `4:5`, `5:8`, `9:16`, `4:3`, `5:4`, `8:5`, `16:9`). `control`,
  `krea2Edit`, `detail` and `upscale` offer none: they keep the input image's shape.
- Style rack: `None` plus ten LoRAs (Dark Brush, Dot Matrix, Kids Drawing, Neon Drip,
  Rainy Window, Retro Anime, Soft Water Color, Sunset Blur, Vintage Tarot, MidJourney),
  offered on every op. Each appends its own trigger phrase after the prompt
  automatically. Keep the rest of the prompt short while one is active: a long prompt
  fights the LoRA.
- Negative prompt: a field exists, but avoid it. It has no working effect at turbo (cfg
  1.0), and production measured it actively costing a named feature its own structure
  even outside turbo: naming "tall bonnet, high roof, domed roof" in the negative cost
  the bonnet its shape, in five separate measured cases. Put required structure in the
  positive prompt instead; the recipe never writes a negative block for this same
  reason. This is not a licence to write the exclusion as a negation in the positive:
  see **Say what is there, never what is not** below.
- Media roles. `i2i`, `upscale`: `inputImage` only. `control`: `inputImage` (the depth
  map) plus an optional `inputImage2` (the subject posed into it). `krea2Edit`:
  `inputImage` plus an optional `inputImage2`, and the order is load bearing: chip 1 is
  the SCENE, chip 2 is the SUBJECT. Swapping them silently degrades the result, and two
  subjects in one pass loses both faces, so edit one subject per pass. `inpaint` and
  `detail` also take `inputImage`, and both run once the user has painted the mask they
  require. See Pick it when.

## The prompt shape

`t2i`, `i2i`, `control`, `detail` and `upscale` all enhance through the same recipe:
one flowing paragraph, the subject named in the opening words, then scale and
perspective, style or medium, lighting and mood, palette, composition, texture. Around
150 words is the target. No comma soup, no `(word:1.5)` weighting: the encoder reads
language, and weighting distorts the whole prompt rather than one token.

`krea2Edit` and `inpaint` are instructions, not descriptions, and the enhancer never
touches either. You write the final text yourself and submit it for both, and for `inpaint`
once the user has painted the mask. Keep it short and imperative, one verb per change,
decomposed rather than narrated. "Change her clothes to explorer clothes and change her
expression to scared" measured as working where "create a photo of this woman wearing
explorer clothes, running scared" measured as failing, on the same reference and seed.
Name any identity trait you want held (hair colour, build), since nothing preserves it
automatically. On this path a removal has a second reason to be positive on top of the
general rule that follows: state it as an instruction ("remove the tattoo"), because the
appearance a reference supplies cancels out of CFG, so a negative cannot touch it at
all.

### Say what is there, never what is not

This holds on every op, and it is the one that costs whole rounds when it is missed.
The encoder has no "not". "not drawn", "never leaves the holster", "both hands empty"
each put `drawn`, `holster`, `hands` into the conditioning and nothing at all to cancel
them, so the wrong thing comes back stronger each time you insist. Rewrite the
exclusion as the presence that replaces it. Not "his gun is not drawn, not held" but
"his open right hand rests palm-down over the grip of a holstered revolver". Not "no
crowd" but "an empty street".

Measured live, 2026-09-19 (Fabio, `t2i`): a standoff prompt asked three times over for a
gun that was "fully holstered, never leaves the holster, not drawn, not held", and came
back holding a drawn revolver all three times. Each retry added more negation, which is
the one move that cannot work. When a regeneration comes back with the thing you asked
to remove, do not restate the removal. Check first whether you phrased it as an
absence, and say what should be in its place instead.

## Adapting what the user asked for

Keep the user's subject, action and colours exactly as stated. Add only what the shape
above requires and they did not say: lighting, palette, composition, texture, a shot
type. On an edit, resist the pull to write a full scene: name the delta only, and if
the request has several parts, decompose it into that many short verbs rather than one
compound sentence.

Name what must be IN frame, not just the change. A bare "a close-up from inside the
wagon" on `krea2Edit` came back with the cargo missing, because the prompt asked for a
shot, not for what was in it. Say what the shot contains.

When a shared prompt block needs different lighting for a new use, replace the light
sentence outright. Do not append a second one: the model tends to obey the later
clause, but the earlier one still reads as noise and sometimes wins anyway.

Example. The user asks: "a fresh photo of an old lighthouse keeper checking his lamp
at night."

```text
A weathered lighthouse keeper in his sixties adjusts the flame of a brass oil lamp, seen from a low three-quarter angle at half length, photographic and lightly cinematic, the lamp's warm firelight the only source against a deep blue-black coastal night, a palette of amber flame-light against cold indigo shadow, framed close around his hands and the lamp with the spiral stair falling into darkness behind him, his weathered skin and the lamp's tarnished brass picked out by the glow.
```

## When a result disappoints

- An unstated attribute (age, ethnicity, clothing) comes back generic or stereotyped:
  state it explicitly rather than leaving it implicit.
- Distant or repeating detail (foliage, gravel, a crowd) renders as a smudged pattern:
  name the failure directly ("each leaf sharp and separate") and confine softness on
  purpose with a shallow depth of field, rather than leaving it to chance.
- An edit opens new space onto a flat grey backdrop: the source is a studio plate on
  grey, and that background rides along by default. State what is actually there
  instead of leaving it to be inferred.
- The negative field seems to do nothing, or a named feature loses its shape: expected,
  see Settings. Move it to the positive prompt.
- `upscale` smooths away fabric weave, grain or pore detail: it is a full generative
  repaint at a higher resolution, not a resolve. Keep denoise at or under 0.20 to add
  resolution without inventing texture.
- An `i2i` or `upscale` pass on a soft source stays soft: both measurably lose detail
  on every pass rather than restoring it. Generate a fresh, tighter `t2i` instead of
  trying to sharpen an existing image through another pass.

## Sources

- Krea's official docs and its own expansion system prompt (`krea-ai/krea-2`), and the
  official `krea-ai/skills` vendor pack (read 2026-08-17, nothing adopted), both
  recorded in `docs/recipes/research/krea-2/sources.md`.
- The enhancer recipe: `js/data/recipes/krea-2.recipe.js`.
- `docs/models/krea2/` (`editing.md`, `conditioning-and-control.md`, `style-loras.md`,
  `resolution.md`, `slot-order.md`).
- Mad Pony's western production findings, 2026-08-11 to 2026-08-13:
  `C:\AI\Mpi\MadPony-Identity\production\cubric-western\findings\costs.md` and
  `...\h3-prompting.md`.
