# Agent prompt samples (MPI-774)

Written by `npm run agent:test -- --samples` on 2026-09-16 with deepseek-ai/DeepSeek-V4-Flash-0731, Auto mode, the fixture model list.
Each prompt is the one the agent sent to `generate`, checked against the enhancer recipe of the model it picked (`scripts/recipe-test.mjs` `runChecks`).

**Findings (orchestrator, same day):** the three image prompts pass every mechanical check, and the models
and settings are sensible (SDXL for photo work, Illustrious for anime, only params the op offers). **Both
H3 video prompts are under the recipe's 50-word floor** (44 and 46) and read like image captions: no
shot structure, no sound, although H3 generates audio. In these runs the agent did not open the
`minimax-h3:t2v` knowledge entry before writing. The likely fix is to make that read structural: give each
model in `list_models` its recipe knowledge id and require a read before the first prompt for a model.
Not done here; it is Fabio's call whether prompt quality matters before the live pass (Phase 4).

## Make an image of an old fisherman mending a net on a foggy pier.

**sdxl-realistic / t2i** · ratio "16:9" · recipe `sdxl` (t2v)

```text
An old weathered fisherman sitting on a foggy wooden pier, hands carefully mending a fishing net, wearing a thick worn coat and woolen hat, dense morning fog over the sea in the background, soft diffused light, moody atmospheric maritime scene, photorealistic, highly detailed
```

Checks: **6/6 pass**

- pass non-empty: 43 words
- pass no preamble/wrapper: An old weathered fisherman sitting on a foggy wo
- pass not an echo: output differs from input
- pass no reasoning: no self-correction or commentary
- pass no list markers: no numbered slots in the output
- pass word budget: 43 (want 30-90)

## Make an anime-style image of a girl on a rooftop at night, city lights behind her.

**ill-anime / t2i** · ratio "9:16" · recipe `illustrious` (t2v)

```text
anime style illustration of a young girl standing on a rooftop at night, city skyline with twinkling city lights behind her, long flowing hair blowing in the wind, night sky with stars, dramatic atmospheric lighting, detailed anime art
```

Checks: **13/13 pass**

- pass non-empty: 38 words
- pass no preamble/wrapper: anime style illustration of a young girl standin
- pass not an echo: output differs from input
- pass no reasoning: no self-correction or commentary
- pass no list markers: no numbered slots in the output
- pass word budget: 38 (want 26-75)
- pass forbidden: bracketed placeholder, LoRA syntax, attention weight or alternation: absent
- pass forbidden: sentence punctuation welded to the last tag: absent
- pass forbidden: Pony grammar on an Illustrious model: absent
- pass forbidden: invented count tag, malformed count, or resolution spam: absent
- pass forbidden: non-ASCII character (emoji or smart punctuation): absent
- pass forbidden: near-miss of a closed picker label (booru has the plural / the from-* form): absent
- pass forbidden: A1111 keyword Vision's CLIPTextEncode cannot execute: absent

## Make a product shot of a glass perfume bottle on wet black stone.

**sdxl-realistic / t2i** · ratio "4:5" · recipe `sdxl` (t2v)

```text
Professional product photography of an elegant glass perfume bottle standing on wet black stone. The bottle is sleek, transparent glass with subtle amber liquid inside, a minimalist design with a polished cap. Wet reflective black stone surface beneath, water droplets and reflections visible. Dramatic moody lighting with soft highlights on the glass, dark background, cinematic product shot, high-end luxury advertising photography, sharp focus, shallow depth of field, photorealistic
```

Checks: **6/6 pass**

- pass non-empty: 68 words
- pass no preamble/wrapper: Professional product photography of an elegant g
- pass not an echo: output differs from input
- pass no reasoning: no self-correction or commentary
- pass no list markers: no numbered slots in the output
- pass word budget: 68 (want 30-90)

## Make a 5 second video of a hummingbird hovering at a red flower.

**minimax-h3 / t2v_ms** · ratio "16:9" · qualityTier "medium" · turbo true · recipe `minimax-h3` (t2v)

```text
A tiny iridescent hummingbird hovering in mid-air beside a vivid red flower, its wings beating rapidly and blurred with motion, its long beak dipping toward the bloom. The flower sways gently. Soft green foliage bokeh in the background, warm natural daylight. Slow, stable camera.
```

Checks: **10/11 pass**

- pass non-empty: 44 words
- pass no preamble/wrapper: A tiny iridescent hummingbird hovering in mid-ai
- pass not an echo: output differs from input
- pass no reasoning: no self-correction or commentary
- pass no list markers: no numbered slots in the output
- **FAIL** word budget: 44 (want 50-400)
- pass forbidden: the literal placeholder [Shot N] instead of a number: absent
- pass forbidden: a [0s-5s] span — H3 marks a cut instant, not a range: absent
- pass forbidden: [Shot 1] carrying a time it must never have: absent
- pass forbidden: a cut time not in the documented MM:SS.mmm form: absent
- pass forbidden: the caller's settings line echoed back into the prompt: absent

## Make a 5 second video of a street market in the rain at dusk.

**minimax-h3 / t2v_ms** · ratio "16:9" · qualityTier "medium" · turbo true · recipe `minimax-h3` (t2v)

```text
A bustling street market at dusk in the rain. Warm glowing vendor lights and neon signs reflected on wet cobblestones. Colorful awnings and market stalls with strings of bulbs. Rain falling, puddles rippling, people with umbrellas walking through the market. Atmospheric, cinematic, moody evening lighting, detailed.
```

Checks: **10/11 pass**

- pass non-empty: 46 words
- pass no preamble/wrapper: A bustling street market at dusk in the rain. Wa
- pass not an echo: output differs from input
- pass no reasoning: no self-correction or commentary
- pass no list markers: no numbered slots in the output
- **FAIL** word budget: 46 (want 50-400)
- pass forbidden: the literal placeholder [Shot N] instead of a number: absent
- pass forbidden: a [0s-5s] span — H3 marks a cut instant, not a range: absent
- pass forbidden: [Shot 1] carrying a time it must never have: absent
- pass forbidden: a cut time not in the documented MM:SS.mmm form: absent
- pass forbidden: the caller's settings line echoed back into the prompt: absent
