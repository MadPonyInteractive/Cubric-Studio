# Kling 3.0: how to prompt it

This recipe is currently reached by **two Vision cards, and neither of them is Kling**: `veo-31-cloud` and `veo-31-fast-cloud`, the two Google Veo 3.1 cloud models added in MPI-853. Kling 3.0 itself is not shipped as a card yet; the recipe was authored ahead of it.

That is a deliberate stand-in, not an accident. A Vision model whose `type` resolves to no recipe does not fall back harmlessly, it falls through to `chroma`, a tag-soup SDXL-era recipe that would be actively wrong for a cinematic video model. Of everything shipped, Kling 3.0 is the closest match for Veo: a cloud video model, prompted in cinematic natural language rather than tags, with native audio and a **real separate negative prompt field**, which Veo also has and almost nothing else in the cloud catalogue does. Veo deserves its own recipe through `/create-enhancer-recipe`; until it has one, write Veo prompts to the shape below and read the Veo section for where the two models differ.

## Pick it when

- Veo 3.1 is the best video model in Vision's cloud catalogue, and the dearest; `veo-31-fast-cloud` costs a fraction of `veo-31-cloud`. Explore on Fast, finish on the full model.
- The clip needs dialogue or synchronised sound. Both carry native audio.
- Not for iteration at volume: a batch multiplies the dearest price in the catalogue.

## Settings, and where Veo differs from Kling

- **Ratios: `16:9` and `9:16` only.** This is Veo's own published list and it is much narrower than Kling's. There is no square and no 21:9, so a request for either has to be reframed rather than approximated.
- Quality tiers: `720p` and `1080p`. Two tiers, not the three the other cloud video models carry.
- **No duration control at all.** Veo has no duration field: clips are a fixed eight seconds. Do not write a prompt that depends on a length the user can choose, and do not promise a four second cut.
- **A real batch.** Veo is the only clip model in the catalogue with a native one, `sample_count`, up to 4. One call, one bill, four clips. Kling has no equivalent.
- **A real negative prompt field.** Both models have one, so a constraint can go there rather than inline. This is the exception among the cloud models, most of which have no negative field at all.
- `person_generation` gates whether adults may be depicted. Nothing else in the catalogue has such a gate.
- Kling's own motion intensity scale (0.1 to 1.0) and its multi-shot timecode format have no Veo equivalent. Ignore both when writing for a Veo card.

## The prompt shape, t2v

Five layers of cinematic prose, not tags. 150 to 250 words.

1. **Scene.** Location, time of day, atmospheric lighting.
2. **Characters and elements.** Give each a unique label and fixed physical traits, and reuse those exact words later rather than paraphrasing them.
3. **Action.** Sequential steps with a beginning, a middle and an end, in cinematic verbs.
4. **Camera.** One shot type and one movement. Dolly push-in, slow tracking shot, whip-pan, crane shot. Never two moves in one shot.
5. **Audio and style.** Dialogue with speaker labels, sound effect cues, the filmic look.

For a Veo card, write it as one continuous eight second shot. Kling's multi-shot mode (two to six scenes, up to fifteen seconds) does not apply.

## The prompt shape, i2v

Camera first, and much shorter: 80 to 150 words.

Describe **only what evolves from the anchor image**. Never restate the subject the picture already shows. The still fixes the cast, the wardrobe, the set and the opening framing; the prompt's whole job is the motion, the camera's move from that framing, and the sound. Restating the subject is the most common way to make an i2v result drift away from the image it was given.

Example. The user asks: "make my photo of a lighthouse come alive."

```text
The camera begins tight on the lighthouse lamp and pulls back in a slow crane move, revealing the full tower against the sky. Waves build against the rocks below, spray rising and falling in the wind. The beam sweeps once across frame, left to right. Gulls cross the upper third. Audio: heavy surf, wind buffeting the microphone, the low mechanical turn of the lamp housing. Overcast late afternoon light, cold blue grade, filmic grain, no camera shake.
```

## Adapting what the user asked for

Keep their subject and intent, and supply the layers they did not think of. Use the negative field for exclusions rather than writing them into the prose, because unlike most of the cloud catalogue this endpoint genuinely reads one.

A request for a square clip, or for anything other than eight seconds, needs saying out loud rather than silently approximating: Veo cannot do either, and the app will pick the nearest legal shape on the user's behalf if the prompt does not address it.

## When a result disappoints

- The subject drifts from a staged image: the i2v prompt restated what the picture already showed instead of describing only the change.
- The camera does two things at once: two movements were written into one shot.
- A character changes between beats: the fixed physical traits were paraphrased the second time rather than repeated word for word.
- The clip is not the length the user asked for: expected. Veo clips are a fixed eight seconds and there is no field to change that.
- The aspect is not what was picked: Veo takes only 16:9 and 9:16, and anything else resolves to the nearest of the two.
- A batch cost four times the estimate for one: that is correct. `sample_count` bills per sample, which is why the agent's confirm shows a batch total.

## Status and caveats

The Kling recipe is `draft` and **entirely community sourced**: there was no official Kuaishou documentation in the research notebook. Applying it to Veo adds a second layer of uncertainty on top of that, so treat everything here as a sensible starting shape rather than proven behaviour, and prefer what a real generation shows over what this file says.

## Sources

- The enhancer recipe `js/data/recipes/kling-3.0.recipe.js`, and its research under `docs/recipes/research/kling-3.0/`.
- Veo's own published input fields, captured into `dev_configs/deepinfra-prices.json` by `scripts/sync-deepinfra-prices.mjs`: the two ratios, the two tiers, the absent duration field and the `sample_count` maximum above are all copied from there, not hand written.
- `js/data/modelConstants/models.js` (`veo-31-cloud`, `veo-31-fast-cloud`) and `js/data/modelConstants/deepinfraSizing.js`, for what the app actually sends.
- The MPI-849 plan, for the per second rates behind the clip prices and for why Veo needs a hand held clip length.
