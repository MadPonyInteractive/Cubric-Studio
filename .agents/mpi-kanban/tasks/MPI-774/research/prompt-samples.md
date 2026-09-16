# Agent prompt samples (MPI-774)

Written by `npm run agent:test -- --samples` on 2026-09-16 with deepseek-ai/DeepSeek-V4-Flash-0731, Auto mode, the fixture model list.
Each prompt is the one the agent sent to `generate`, checked against the enhancer recipe of the model it picked (`scripts/recipe-test.mjs` `runChecks`).

## Make an image of an old fisherman mending a net on a foggy pier.

**krea2 / t2i** · ratio "16:9" · qualityTier "2k" · turbo true · recipe `krea-2` (t2v)

```text
An old fisherman in his seventies mends a weathered fishing net on a wooden pier, seen in a wide cinematic shot that places him small against the vast grey sea and sky, photographic and atmospheric, his calloused hands working the coarse netting and a lumpy knitted sweater and oilskin cap sodden with sea spray, dense fog rolling in across the still water and dissolving the distant horizon, the only warm accents the amber glow of a hanging lantern on a post beside him, a palette of soft greys, misty blues and muted teal, weathered timber planks underfoot with coils of rope and buoys, gentle lapping water against the pilings, the fog muffling all sound and softening every edge, moody, quiet and contemplative, cool diffuse light with no hard shadows, rich tactile texture of wood grain, net twine and fabric weave.
```

Checks: **6/6 pass**

- pass non-empty: 140 words
- pass no preamble/wrapper: An old fisherman in his seventies mends a weathe
- pass not an echo: output differs from input
- pass no reasoning: no self-correction or commentary
- pass no list markers: no numbered slots in the output
- pass word budget: 140 (want 60-220)

## Make an anime-style image of a girl on a rooftop at night, city lights behind her.

**ill-anime / t2i** · ratio "9:16" · recipe `illustrious` (t2v)

```text
masterpiece, best quality, very aesthetic, absurdres, newest, 1girl, solo, silver hair, long hair, starry eyes, gentle smile, jacket, skirt, nightwear, standing, looking at viewer, arms relaxed, outdoors, rooftop, night, city, city lights, bokeh, illuminated skyline, starry sky, cowboy shot, cinematic lighting, glowing, detailed background, illustration
```

Checks: **13/13 pass**

- pass non-empty: 45 words
- pass no preamble/wrapper: masterpiece, best quality, very aesthetic, absur
- pass not an echo: output differs from input
- pass no reasoning: no self-correction or commentary
- pass no list markers: no numbered slots in the output
- pass word budget: 45 (want 26-75)
- pass forbidden: bracketed placeholder, LoRA syntax, attention weight or alternation: absent
- pass forbidden: sentence punctuation welded to the last tag: absent
- pass forbidden: Pony grammar on an Illustrious model: absent
- pass forbidden: invented count tag, malformed count, or resolution spam: absent
- pass forbidden: non-ASCII character (emoji or smart punctuation): absent
- pass forbidden: near-miss of a closed picker label (booru has the plural / the from-* form): absent
- pass forbidden: A1111 keyword Vision's CLIPTextEncode cannot execute: absent

## Make a product shot of a glass perfume bottle on wet black stone.

**krea2 / t2i** · ratio "4:5" · recipe `krea-2` (t2v)

```text
An elegant glass perfume bottle standing on wet black stone, seen as a luxury product shot at eye level from a slight three-quarter angle, the bottle a clear faceted glass flacon with facets catching the light and a slim gold cap, glossy and reflective, photographed as commercial product photography with studio lighting, a soft cool rim light tracing the bottle's edges against a dark moody backdrop, the wet black stone beneath mirroring the bottle in a faint pool of water with delicate ripples and droplets, a palette of clear glass highlights and amber liquid glow against deep black and slate grey, framed centered with generous negative space around the bottle, the stone texture sharp and each droplet distinct, a shallow depth of field softening the distance behind into darkness.
```

Checks: **6/6 pass**

- pass non-empty: 129 words
- pass no preamble/wrapper: An elegant glass perfume bottle standing on wet 
- pass not an echo: output differs from input
- pass no reasoning: no self-correction or commentary
- pass no list markers: no numbered slots in the output
- pass word budget: 129 (want 60-220)

## Make a 5 second video of a hummingbird hovering at a red flower.

**minimax-h3 / t2v_ms** · ratio "16:9" · qualityTier "medium" · turbo true · recipe `minimax-h3` (t2v)

```text
Photorealistic nature close-up look: a tiny iridescent green hummingbird hovering beside a vivid red trumpet flower, soft sunlight, lush green garden backdrop blurred behind, palette of deep reds set against emerald and sunlit green, mood delicate and serene.
[Shot 1] A hummingbird beats its wings rapidly in mid-air beside a single red trumpet flower, its long bill dipping into the bloom to drink nectar, wings a shimmering blur as it holds perfectly in place, then it floats back a few inches and hovers still, body bobbing gently, for the rest of the shot.
The camera holds still throughout, a shallow depth of field keeping the bird and flower sharp against the soft blur.
overall_soundscape: Rapid hummingbird wingbeats like a low thrum, soft insects buzzing in the warm garden air, a light breeze rustling leaves.
non_diegetic_music: N/A
No text, subtitles, logos or watermarks, no cartoon or CG rendering, no slow motion.
```

Checks: **11/11 pass**

- pass non-empty: 150 words
- pass no preamble/wrapper: Photorealistic nature close-up look: a tiny irid
- pass not an echo: output differs from input
- pass no reasoning: no self-correction or commentary
- pass no list markers: no numbered slots in the output
- pass word budget: 150 (want 50-400)
- pass forbidden: the literal placeholder [Shot N] instead of a number: absent
- pass forbidden: a [0s-5s] span — H3 marks a cut instant, not a range: absent
- pass forbidden: [Shot 1] carrying a time it must never have: absent
- pass forbidden: a cut time not in the documented MM:SS.mmm form: absent
- pass forbidden: the caller's settings line echoed back into the prompt: absent

## Make a 5 second video of a street market in the rain at dusk.

**minimax-h3 / t2v_ms** · ratio "16:9" · qualityTier "medium" · turbo true · recipe `minimax-h3` (t2v)

```text
Rainy dusk street market look: damp cobblestones reflecting warm market lanterns and cool blue twilight, string lights strung under canvas awnings, light drizzle catching the glow, mood lively and cozy against the gathering dark.
[Shot 1] A busy open-air street market in the rain at dusk: shoppers with raised umbrellas move past produce stalls, one stallholder pulls a canvas tarp lower against the drizzle while warm bulbs sway overhead, water runs off a green awning and splashes into puddles that mirror the stalls, a few market-goers duck under cover and keep browsing, the whole lane humming with quiet movement as the light fades to blue around the warm amber.
The camera pushes in slowly down the lane, gliding past the awnings and reflections at a steady, unhurried pace.
overall_soundscape: Steady rain pattering on canvas awnings and pinging off puddles, soft market chatter, a vendor calling out, water dripping and running along the gutters.
non_diegetic_music: A gentle string and light percussive score with a warm, slightly melancholic evening tone, swelling softly and fading out toward the end.
No text, subtitles, logos or watermarks, no cartoon or CG rendering, no slow motion.
```

Checks: **11/11 pass**

- pass non-empty: 190 words
- pass no preamble/wrapper: Rainy dusk street market look: damp cobblestones
- pass not an echo: output differs from input
- pass no reasoning: no self-correction or commentary
- pass no list markers: no numbered slots in the output
- pass word budget: 190 (want 50-400)
- pass forbidden: the literal placeholder [Shot N] instead of a number: absent
- pass forbidden: a [0s-5s] span — H3 marks a cut instant, not a range: absent
- pass forbidden: [Shot 1] carrying a time it must never have: absent
- pass forbidden: a cut time not in the documented MM:SS.mmm form: absent
- pass forbidden: the caller's settings line echoed back into the prompt: absent
