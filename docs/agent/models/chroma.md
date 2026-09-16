# Chroma: how to prompt it

Chroma is a de-distilled FLUX.1 Schnell: a T5-XXL encoder that reads natural-language prose,
not tags, run at CFG 1 and 1 to 4 steps. Two Vision cards share this recipe:

- `chroma-flash`: the balanced tier, a 17GB checkpoint.
- `chroma-hyper`: the faster, lower-VRAM tier, a 9.2GB checkpoint. Same graph, same
  prompting rules; only the diffusion weight differs. There is no High tier: the full
  Chroma weight was tried and rejected for bad LoRA adherence and being very slow.

Both run `t2i`, `i2i`, `control` (depth), `upscale` and `detail`. There is no `inpaint` op
on this card: masked, denoise-driven work runs through `detail` instead.

## Pick it when

- The user wants a photoreal or high-detail render described in plain sentences, not booru
  tags, where naming real camera gear and lens choices should actually move the result.
- The user explicitly asks for mature content: Chroma is the most capable card for it. It
  struggles with hands in any register.
- Pick `chroma-hyper` on tighter VRAM or when speed matters most; pick `chroma-flash` when
  the extra weight is affordable and the better result matters more.
- `control` when the structure, not the colour or identity, of a reference image should
  carry through: it copies depth only, nothing else.

## Settings

- No quality tier and no turbo toggle: both are Krea 2-only controls and never mount on
  this card.
- Ratios, on `t2i` and `i2i` only: 1:1, 3:4, 4:5, 5:8, 9:16, 4:3, 5:4, 8:5, 16:9. `control`,
  `upscale` and `detail` inherit the input image's own shape instead.
- Media roles: `t2i` takes no image. `i2i`, `control`, `upscale` and `detail` each take
  exactly one required `inputImage`. `detail` works on a mask the user paints in History;
  you cannot paint one, so suggest it to the user instead of running it.
- Style rack, live on every op this card supports: None, B&W Sketch, Lenovo, Brushwork,
  Anime. Default strength is 0.6, not Vision's usual 1.0: both checkpoints are heavily
  distilled, and 0.8 to 1.0 breaks the LoRA into artefacts instead of styling it. Model
  strength only, no clip half.
- `control`'s only structure type is depth (no type picker shows), with an adjustable
  strength: the 0 to 1 slider is normalised in-graph to a 0 to 0.5 ceiling, and the image
  visibly degrades as it approaches that ceiling. Chroma has no CLIP-L, so the ControlNet's
  pooled vector is zero-filled and quality falls off faster here than on a true FLUX
  checkpoint.
- `negativeHandling` is none: at CFG 1 the sources are explicit that a negative prompt
  costs generation time for no real gain. Write everything as a positive description.

## The prompt shape

One paragraph of continuous prose, no line breaks, no lists, no tag soup. Loosely in this
order, with every element present even where the prose weaves them together: technical
framework and camera specs first, then the main subject and its action, then environment
(foreground, middle ground, background), then lighting and atmosphere, then texture and
mood. The camera or shot type is the element most often left out, and the one this model
most needs stated in plain words: close-up, wide shot, low angle, eye level, three-quarter
view.

Target about 110 words; 140 is the ceiling the instruction aims for, 160 is the hard stop.
That is deliberately conservative against the vendor's real limit: Chroma's T5 encoder caps
at 512 tokens, roughly 380 words (lodestones/Chroma1-HD's tokenizer config and every
lodestone-rock/flow training config agree on 512). An older note in this repo claimed a
10,000-token window; that was wrong by 20x and has been corrected, and where a source and a
repo measurement disagree the measurement wins. Nothing was ever truncated by the old
figure, since the working budget sits well inside 512, but treat 512 as the real ceiling if
you are ever tempted to write long. Tag order also carries no weight on this model: the
vendor trained its tag-reading branch on shuffled tags, so do not import the front-loading
discipline that matters on the booru recipes.

## Adapting what the user asked for

- Sparse input: expand it with the camera, lighting, environment and texture it did not
  mention, serving the subject the user named, never a swapped-in one.
- Detailed but disordered input: rearrange it into the flow above, keeping every technical
  choice the user made intact.
- Overlong input: note only the subject, medium and the handful of details that actually
  change the image, then write fresh from those notes rather than trimming clause by clause.
- Commit to one medium (photograph, oil painting, digital illustration, 3D render) and hold
  it for the whole paragraph.
- Name real camera gear for photoreal work: Hasselblad X2D 100C with a 100mm macro at f/2.8
  for nature or studio, Sony Alpha 7R IV at 85mm f/1.8 for portraits, GoPro HERO12 Black
  wide-angle for action, iPhone 15 ProRAW with a 35mm film look for candid or street.
- Push texture positively ("highly detailed skin texture, subtle imperfections, film
  grain") instead of negating a flaw, and never write "no blur" or the like.
- Do not reach for "white background" as a default unless the user actually asked for one.
- Resolve a vague or garbled request into concrete visual language; never copy the
  confusion through.

The user asks: "a dog running on a beach at sunset".

```text
Shot on a GoPro HERO12 Black with a wide-angle lens at a low, ground-level angle, a golden retriever sprints along the shoreline, sand kicking up behind its paws as it chases the surf. The beach stretches into a hazy horizon, gentle waves rolling in from the middle ground, gulls scattered near the tideline in the background. Warm sunset light rakes low across the sand, throwing a long amber glow over the dog's fur and catching fine spray in the air. Highly detailed fur texture, sun-bleached grain in the light, an energetic and joyful mood.
```

## When a result disappoints

- Skin or fur looks plastic or waxy: add positive texture ("highly detailed skin texture,
  subtle imperfections, film grain") rather than negating the flaw.
- Repetitive facial structure or a flat, generic face: a known FLUX-family artifact; add a
  specific lighting or camera cue rather than more face description.
- The image looks cluttered or fights itself: too many layered or conflicting details;
  drop the ones that do not serve the main subject.
- The subject drifted into something else: restate the user's literal subject; do not let
  a "better" or more photogenic idea creep in while expanding.
- Rendered text is garbled: it needs the exact words in double quotes, 2 to 5 words, plus
  the font style, colour and material named explicitly.
- A depth `control` result loses detail or shows artefacts: the strength slider is nearing
  its top; pull it back toward the lower half.
- A style LoRA looks broken rather than stylistic: the stylization slider is too high;
  pull it back toward the 0.6 default.
- The paragraph reads as two styles at once: commit to one medium and hold it throughout.

## Sources

- Vendor model card and config: huggingface.co/lodestones/Chroma1-HD, read 2026-08-17.
- Vendor training and inference code: github.com/lodestone-rock/flow, read 2026-08-17.
- Recipe: `js/data/recipes/chroma.recipe.js`.
- Research: `docs/recipes/research/flux-chroma-krea/research.md` and `sources.md` (Chroma's
  own vendor-code read-out lives in `sources.md`; no dedicated `chroma/` research folder
  exists yet).
- Corrected token-window finding: `docs/recipes/playbook/08-vendor-prompt-skills.md`, the
  registry survey row for `chroma`.
- Model docs: `docs/models/chroma/README.md`, `docs/models/chroma/licences.md`.
- No production field evidence found for this recipe (checked
  `C:\AI\Mpi\MadPony-Identity\production\*\findings\`, 2026-09-16).
