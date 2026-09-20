# Seedance 1.5: how to prompt it

Seedance 1.5 Pro ships as one Vision card, `seedance-15-pro-cloud`. It is a **cloud** card (MPI-853): there are no weights, no ComfyUI graph and no engine. It runs at DeepInfra on the user's own API key, and DeepInfra bills them directly for every clip. Nothing downloads and nothing installs, so "is it installed?" means "is a key saved?".

Two ops: `t2v` (text to video) and `i2v` (image to video). The recipe defines a `t2v` mode only, so write the same four-layer prompt for either op. For `i2v`, treat the supplied still as already fixing the cast, the setting and the opening framing, and spend the words on what happens next and on the sound.

The model is a dual-branch diffusion transformer: it renders audio and video **simultaneously, in one latent space**. That is the whole reason to pick it, and it is why the audio layers below are not optional decoration.

## Pick it when

- The clip needs sound that lands on the picture: lip-sync, frame-exact foley, a layered ambient bed. This is its headline capability, not an add-on.
- The user has no GPU, or does not want a 30 GB download. Nothing local is touched.
- Cost matters more than absolute quality among the cloud video models. At roughly $0.30 for five seconds at 1080p it is around seven times cheaper than Seedance 2.0 for the same clip, and cheaper than Wan 3.0 or either Veo.
- Not when the user wants a purely silent clip and already has a local video model installed, because a local generation costs them nothing.

## Settings

- Ratios: `1:1`, `3:4`, `4:3`, `9:16`, `16:9`, `21:9`. The provider also offers `adaptive`, which Vision deliberately never sends: it hands the frame size to the model.
- Quality tiers: `480p`, `720p`, `1080p`. These are the provider's own resolution tiers, not a local sampler setting, and the price scales with them.
- Duration: 4 to 12 seconds, which is the provider's published range. Ask for more and Vision clamps to 12 rather than letting the call fail.
- No batch. The endpoint generates one clip per call, so the batch control is off on this card. Four clips means four calls and four bills.
- **No negative prompt field.** The model has none, and the prompt box hides the toggle. Every constraint has to be written positively inside the prompt itself.
- Billed per token, which is why the estimate moves with both duration and tier. Dropping from 1080p to 720p is a real saving, not a rounding difference.

## The prompt shape

Four layers, comma separated, in this fixed order. Output one prompt string.

```text
[Layer 1: primary subject and physical action], "[Layer 2: dialogue or key sound event]", [Layer 3: environmental audio cues], [Layer 4: visual style, lighting and mood]
```

1. **Subject and action.** Be concrete about who or what, and what they physically do. Comma separated verbs carry time inside the clip ("pivots, raises an arm, releases"). "A business professional striding down a rain slicked sidewalk" works; "a person walking" does not.
2. **Key sound event, in double quotes.** The quotes are the signal that tells the model to synchronise audio with the picture at frame level. This is either a line of dialogue or the one sound that matters ("heels clicking rhythmically"). Never leave it out: an empty Layer 2 wastes the only thing this model does better than its neighbours.
3. **Environmental audio cues.** Two to four comma separated background sounds that fill the space around the key event: traffic, a jury shifting in their seats, birds starting the morning chorus. Skip these and the soundscape comes back hollow.
4. **Visual style and mood.** Lighting and feel, last: golden hour cinematography, Gothic atmosphere, lightning flashes, mist rising.

Length: no hard ceiling. Specificity matters more than word count, and a vague prompt at any length produces generic output with the audio drifting off the picture.

## Adapting what the user asked for

Keep their subject and intent, and add the layers they did not think to specify. If the input is one line, invent cohesive sound cues, action detail and mood to fill all four layers rather than submitting two of them. If the input is long or contradictory, distil to one dominant action, one key sound, the two or three most important ambient cues, and one style statement.

Camera language has no documented effect on 1.5. Camera control lives in the API parameters (`camera_fixed`, the aspect ratio), not in the prose, so do not spend the prompt on dolly moves and crane shots the way you would for Seedance 2.0 or Kling.

Example. The user asks: "a chef cooking something."

```text
Chef's hands chopping vegetables rapidly then sweeping them into a pan, "knife striking cutting board rhythmically", sizzling as ingredients hit oil, extractor fan hum, steam rising, professional kitchen energy, culinary precision.
```

## When a result disappoints

- The audio and the picture do not line up: Layer 2 was missing, or it was not in double quotes. The quotes are the sync signal.
- The soundscape feels thin or artificial: Layer 3 was skipped, or carried one cue instead of two to four.
- The clip looks generic: the prompt was vague. This model punishes "a person in a city" harder than most.
- Strange artefacts rather than an error: the prompt asked for two incompatible things at once, such as a peaceful garden and a loud rock concert. The model does not refuse, it blends them badly. Pick one intent.
- A negative typed anywhere did nothing: there is no negative field on this endpoint. Rewrite it as a positive description of what should be there instead.
- The generation failed and no clip arrived: nothing was billed. A refused or failed call at DeepInfra does not charge.

## Status and caveats

This recipe is `draft`, synthesised from research rather than validated on real output. Two of its three open questions still stand: the hard token ceiling, and whether cinematic camera vocabulary does anything.

The third is now answered. The recipe recorded 1.5 as text to video only and flagged "does it accept a reference image" for validation; DeepInfra's own published input fields carry `first_frame_image` and `last_frame_image`, so the `i2v` op on this card is real. That is why the card declares both ops.

## Sources

- The enhancer recipe `js/data/recipes/seedance-1.5.recipe.js`, and its research under `docs/recipes/research/seedance-1.5/`.
- The model's own published input fields, captured into `dev_configs/deepinfra-prices.json` by `scripts/sync-deepinfra-prices.mjs`: the ratio list, the tier list and the 4 to 12 second duration range above are copied from there, not hand written.
- `docs/proprietary-models-research/01d-deepinfra-image-video.md` section 2c, for the measured token formula behind the price.
- `js/data/modelConstants/models.js` (`seedance-15-pro-cloud`) and `js/data/modelConstants/deepinfraSizing.js`, for what the app actually sends.
