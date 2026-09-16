# SDXL: how to prompt it

SDXL renders a photography-style still from one dense line of comma-separated tags, not
prose: its two CLIP text encoders read only the first ~75 tokens, so the whole prompt has to
land inside a fixed ten-part structure rather than unfold as a sentence. Three Vision cards
use this guide:

- `sdxl-realistic` and `sdxl-nsfw`: the same recipe, the same rules below apply to both,
  named once here. Both offer `t2i`, `i2i`, `control`, `inpaint`, `upscale`, `detail`.
- `nvidia-pid`: the NVIDIA PiD generative upscaler (op `pid`). Its own `type` is `pid`, but
  its ModelDef sets `enhanceRecipe: 'sdxl'` (`js/data/modelConstants/models.js`) because PiD
  has no recipe of its own. Its prompt is not a new scene: PiD denoises a blank canvas
  steered by the source image's own latent, so the prompt only tells it what detail to
  invent while rebuilding what is already there (`docs/models/pid/upscaler.md`). Reuse the
  original generation prompt, or describe the image, rather than writing a fresh subject.

## Pick it when

- The user wants a photoreal or documentary look rather than an illustration: SDXL's
  "documentary photography" and "candid photography" tags reach convincing skin texture and
  grounded lighting without a LoRA.
- The user names a camera body or film stock: SDXL renders Sony A7 III, Agfa Vista, Ilford
  HP5 Plus and similar as visually distinct looks. It does not respond to generic optics
  ("50mm", "f/2.8") as camera settings, only as a weak realism cue.
- The request calls for mature content: pick the NSFW card rather than the realistic one.
- The job is structural (copy a pose, a depth map, a scribble or an edge map onto a new
  subject) or an upscale on an existing SDXL-family image: the same recipe drives every op.
- The user wants a masked fix (`inpaint` or `detail`): both need a mask painted in History
  first, which the agent cannot do itself. Suggest that step rather than calling the op with
  no mask.
- The user wants a 4x upscale that invents plausible new detail rather than a faithful
  resize: `nvidia-pid`. For a resize with nothing invented, point them at the plain Upscale
  tool in the tool rail instead; it uses no model and is far faster.

## Settings

Auto mode has little to pick for this family: no quality tiers, no turbo toggle and no style
rack are offered on any op (`tests/fixtures/agent/connector-models.json` lists empty
`qualityTiers`/`styles` and `turbo: false` throughout), so the only real choice is the ratio.
`t2i`, `i2i` and `inpaint` offer the full ratio set (`1:1, 3:4, 4:5, 5:8, 9:16, 4:3, 5:4, 8:5,
16:9`); `control`, `upscale` and `detail` follow the source image's own size instead and show
no ratio picker.

Media roles (one required image per op that takes one; `t2i` takes none): `i2i`, `control`,
`inpaint`, `upscale` and `detail` each take a single required `inputImage`, and nothing more
(SDXL does not carry the extra reference slots some other models get on `control`).

- `inpaint` and `detail` both require a mask (`requiresMask: true`) painted onto the image in
  History. The in-app agent cannot paint one, so when a request calls for either op, suggest
  the user mask the area first rather than trying to run the op with none.
- `control` also exposes a `controlType` picker (depth, pose, scribble, canny, one shared
  ControlNet-Union checkpoint) and a strength slider. Never restate what the chosen control
  type already carries (a pose, an edge map) in the prompt; describe the subject and scene it
  should be painted into instead.
- `i2i` (denoise default 0.30) and `upscale` / `detail` (0.20 / 0.30): describe the image you
  want to end up with, not the change to make. The fuller that description, the more the
  composition survives as denoise climbs; an empty prompt is fine at 0.20 and under.
- `inpaint` needs an actual instruction once a mask is in place. To remove something, name it
  ("remove the tattoo"), never the bare word "remove".
- `nvidia-pid`'s `pid` op takes one `inputImage`. The fixture lists the standard ratio set for
  it too, but PiD's own output is always a fixed 4x the input on both axes
  (`docs/models/pid/upscaler.md`), so there is nothing for a ratio choice to change; treat it
  as locked to the source image's shape. Its denoise slider maps to PiD's own `degrade_sigma`
  (default 0.0, faithful; raise it for more invented detail). The prompt is optional there and
  stays empty comfortably at 0.0.

## The prompt shape

One line of comma-separated tags, ten slots in a fixed order: photo style, subject, physical
traits plus a one-word mood, pose or action, framing, setting, lighting, camera angle, camera
body or film stock, and an optional photographer credit last. Every required slot gets filled
even when the user did not mention it. It is not padding: a slot the model was tuned to read
and does not get is a slot SDXL fills with its own generic default, which is how a prompt
with no lighting or no camera named ends up flat.

SDXL has a real negative field, so a prompt is two parts: the tag line goes in `generate`'s
`prompt`, and the negative baseline (`bad hands 5, bad dream, unrealistic dream:1.4, big eyes,
camera`) goes in `negative`. The Prompt Box enhancer writes the two as labelled blocks and the
app splits them; you fill the two fields directly, so never write `POSITIVE PROMPT:` or
`NEGATIVE PROMPT:` into either. Target length is 30 to 90 words for the two together (checked),
which in practice is nine short comma phrases plus the baseline. Going long is a real failure:
a past sweep appended a note explaining its own slot logic and landed at 116 words. The tag
line and the baseline are the whole answer.

## Adapting what the user asked for

- Keep the user's subject, setting and any technical choice they already made (a named
  camera, a film stock, a mood word); slot it into the structure rather than replacing it.
- A sparse request ("a cat") still gets all ten slots. Choose a style, a setting, a light and
  a camera that suit the subject instead of leaving them for SDXL to guess.
- A long or rambling brief gets condensed to what actually changes the picture, then
  rewritten from those notes in the ten-slot order. Do not walk it clause by clause into more
  and more tags; quality spam like "8k" or "trending on artstation" is dropped, not
  translated.
- Do not make hands or feet the focal point unless the user asked for them; SDXL still
  struggles with extremities. Honour the request fully when they do ask.
- Do not list every item in the background; a contextual cue reads better than an inventory.
- Camera settings only work as named hardware. If the user gives you an f-stop or a focal
  length, fold it into a camera body or film stock choice rather than passing the number
  through; it will do nothing on its own.

The user asks: "a photo of a woman reading in a sunny cafe."

`prompt`:

```text
candid photography, young woman, freckles and loose auburn hair, absorbed, reading a paperback, seated at a small marble table, corner cafe with plants along the window, warm morning window light, eye level, Sony A7 III
```

`negative`:

```text
bad hands 5, bad dream, unrealistic dream:1.4, big eyes, camera
```

## When a result disappoints

- Skin looks flat or plastic: the style-of-photo slot is missing or weak. Lead with
  "documentary photography" or "candid photography".
- Hands or feet come out wrong: they were made the focal point. Keep them incidental unless
  asked for directly, and suggest the user fixes a bad result with Detail on a mask rather
  than a longer prompt.
- The same face keeps recurring across a batch: that is A-Detailer, not this recipe. Suggest
  the user masks the face and runs Detail instead.
- A physical camera shows up in the subject's hands: this is exactly what "camera" in the
  negative baseline exists to stop; check it survived into the request.
- Background reads as cluttered or incoherent: too many background elements were listed. Cut
  it to one contextual cue.
- No visible depth-of-field or focal-length effect: SDXL does not read "50mm" or "f/2.8" as
  optics, only as a weak realism cue. Name a camera body or film stock instead.
- On `nvidia-pid`, the result barely changes or invents the wrong thing: denoise
  (`degrade_sigma`) is the one real strength control. 0.0 stays faithful; raise it in small
  steps for more invented detail, and add a short description of the image once you do.

## Sources

- `docs/recipes/research/sdxl/sources.md`: a single community deep-dive (a YouTube 1000-hour
  prompting study) plus the official Stability AI model card, read 2026-08-17. No vendor
  prompting skill exists for SDXL (`docs/recipes/playbook/08-vendor-prompt-skills.md`).
- `js/data/recipes/sdxl.recipe.js`.
- `docs/models/sdxl/depth-control.md` (the `control` op's four types and mechanism).
- `docs/models/pid/upscaler.md` (`nvidia-pid`'s architecture, `degrade_sigma`, and why the
  prompt is optional guidance rather than a scene).
- `docs/models/community-merges-licences.md` (checkpoint identity and licensing for both
  photography cards).
- No dedicated field-evidence findings exist yet for any of the three cards above in
  `MadPony-Identity/production/*/findings/` (checked 2026-09-16).
