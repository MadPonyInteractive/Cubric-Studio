# Seedance 2.0: how to prompt it

Seedance 2.0 ships as one Vision card, `seedance-2-cloud`. It is a **cloud** card (MPI-853): no weights, no ComfyUI graph, no engine. It runs at DeepInfra on the user's own API key, and DeepInfra bills them directly. "Installed" means a key is saved.

Two ops, and unlike its 1.5 sibling the recipe has a distinct mode for each: `t2v` uses the eight part director order, `i2v` uses the timeline multi-shot format with `@tag` references.

It is a physics aware dual-branch transformer with native audio. It is also **the dearest model in the catalogue that is not a Veo**, several times Seedance 1.5 Pro for the same clip.

## Pick it when

- The shot needs believable physics: weight, momentum, friction, something shattering or fabric moving. That is what separates it from 1.5.
- The user wants several shots in one clip, cut on a timeline, rather than one continuous take.
- There are reference assets to honour: up to nine images, three videos and three audio clips, each given an explicit job.
- Not for exploring. At this price, iterate on Seedance 1.5 Pro or Wan 3.0 and come here for the final.

## Settings

- Ratios: `1:1`, `3:4`, `4:3`, `9:16`, `16:9`, `21:9`. `adaptive` is offered upstream and never sent: it hands the frame size to the model.
- Quality tiers: `480p`, `720p`, `1080p`, the provider's own. Price scales with the tier, so a draft pass at 480p costs a fraction of the same clip at 1080p.
- Duration: 4 to 15 seconds, the provider's published range. Two to five seconds per timeline segment, three to five segments.
- No batch: one clip per call. Four variations means four calls and four bills.
- **No negative prompt field.** Constraints go inline, positively, in part 8.
- Vision sends one reference image per generation (the first staged asset, as `first_frame_image`). The wider `@tag` system below is the model's own; the extra slots are not wired into the app yet, so do not promise nine references.

## The prompt shape, t2v

Eight parts, in this exact order.

1. **Subject.** Who or what, with physical detail: age, clothing, material.
2. **Action.** One physics aware verb per shot. "Tires smoke as the car drifts ninety degrees", "glass shatters on impact, fragments scattering outward", "silk billows and ripples". Never "moves" or "becomes".
3. **Scene and atmosphere.** Location, time of day, environment.
4. **Camera.** One shot size, one movement, one angle. Never stack two moves in a shot, and never write a contradiction like "close-up wide shot" or "static tracking shot".
5. **Lighting and style.** Film grain, teal and orange grade, golden hour, cyberpunk neon.
6. **Audio.** Specific adjectives, because they are what trigger the native audio engine: reverb, a metallic clink, boots on grass, crowd murmur.
7. **Quality suffix.** Append this string verbatim, every time. Its absence measurably degrades consistency and stability:

```text
4K ultra HD, rich detail, sharp clarity, cinematic textures, stable picture. Maintaining face and clothing consistency without distortion or high detail. Generate the video without subtitles.
```

8. **Constraints.** Behavioural limits inline: no zoom, no warping, tripod stable, avoid hair lift.

## The prompt shape, i2v

Same model, different shape: asset assignments first, then a timeline, then one global style block, then the same quality suffix.

```text
@Image1 as the first frame. @Video1 for camera movement reference.
[0s-4s] Medium tracking shot, slow push-in, the boy dribbles forward, boots on grass.
[4s-8s] Cut to a low angle, static, he strikes the ball, crowd murmur swells.
Global style: warm afternoon sunlight, cinematic texture with film grain.
4K ultra HD, rich detail, sharp clarity, cinematic textures, stable picture. Maintaining face and clothing consistency without distortion or high detail. Generate the video without subtitles.
```

Every uploaded asset gets a named job. One camera movement per segment. One primary action per segment, or the result reads as a slideshow. Use timestamps for anything over about five seconds.

## Adapting what the user asked for

Keep their subject and intent, and invent one to three cinematic details per section when the input is thin. When it is long or contradictory, distil to one dominant subject, one action beat and one camera direction.

Do not over describe a face in words when a character reference image is staged: the model then matches the text category rather than the face. For character consistency across clips, a three still reference pack (front, three quarter, profile) with neutral expressions and consistent lighting is the documented approach, even though the app currently sends only the first.

Example. The user asks: "someone slams papers down at work."

```text
A bearded employee in a grey sweater sits at a modern brutalist office desk. He slams a stack of papers on the counter, motion weight with paper scattering outward. Static medium shot, overhead fluorescent lighting, cold blue tones, realistic gritty texture. Paper scraping sound, distant office hum. 4K ultra HD, rich detail, sharp clarity, cinematic textures, stable picture. Maintaining face and clothing consistency without distortion or high detail. Generate the video without subtitles.
```

## When a result disappoints

- Motion looks weightless or floaty: the action verb was generic. Physics verbs are the whole point of this model.
- The camera wanders or the framing fights itself: two movements were stacked in one shot, or the shot size and the movement contradicted each other.
- Faces or clothing drift between shots: the quality suffix was dropped, or a staged reference face was also described in words.
- The clip reads as a slideshow: more than one primary action was packed into a short segment.
- The audio is flat: part 6 was missing or vague. Adjectives, not nouns, drive the audio engine.
- The bill was larger than expected: check the duration and the tier. This model is priced per token and both axes move it.

## Status and caveats

The recipe is `draft` and community sourced: there were no official ByteDance documents in the research notebook, and its example prompts were reconstructed after a rate limit rather than captured. Treat the shape as sound and the details as unproven until someone hand tests real output.

## Sources

- The enhancer recipe `js/data/recipes/seedance-2.0.recipe.js`, and its research under `docs/recipes/research/seedance-2.0/`.
- The model's own published input fields, captured into `dev_configs/deepinfra-prices.json` by `scripts/sync-deepinfra-prices.mjs`: the ratios, the tiers and the 4 to 15 second range are copied from there, not hand written.
- `docs/proprietary-models-research/01d-deepinfra-image-video.md` section 2c for the measured token formula, and the MPI-849 plan's drift note for why the feed rate is overridden.
- `js/data/modelConstants/models.js` (`seedance-2-cloud`) and `js/data/modelConstants/deepinfraSizing.js`, for what the app actually sends.
