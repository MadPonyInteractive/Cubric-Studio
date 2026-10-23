# Validation Record — LTX 2.5

## Stage 1 — autonomous text-only loop (agent)

- **Recipe / modes:** `ltx-2.5` / `t2v`, `i2v`, `r2v` (and `r2v --ref-tiers`)
- **Enhancer model (ladder rung):** DeepInfra `google/gemma-4-26B-A4B-it` (registry id `gemma-4-e4b`, which the app sends to DeepInfra as the 26B)
- **Judge model:** local `gemma3:12b` (Ollama app)
- **Runs per tier:** 3 (a tier passes only if all 3 pass); every mode swept twice green
- **Harness:** `npm run recipe:test -- ltx-2.5 --backend deepinfra --engine gemma-4-e4b --judge gemma-3-12b --runs 3 [--mode i2v|r2v] [--ref-tiers]`, under `gpu_lease.py run`
- **Spend:** ~17 sweeps, ~25.5 cents (25-cent cap, plus Fabio's yes for ~3 cents more on round 7)
- **Date:** 2026-10-23 (MPI-1095)

### Final tally

| Mode | Sweep A | Sweep B |
|---|---|---|
| `t2v` (bare, medium, directed, overlong, general) | t2v-4 ALL PASS | t2v-5 ALL PASS |
| `i2v` (frame-bare, frame-renamed, frame-directed, frame-static, frame-none) | i2v-3 ALL PASS | i2v-5 ALL PASS |
| `r2v`, nothing attached (5 tiers) | r2v-2 ALL PASS | r2v-3 ALL PASS |
| `r2v --ref-tiers` (4 tiers + seen-picnic, seen-shuffled, seen-swapped, seen-beach) | r2vref-3 ALL PASS | r2vref-4 24/24 (rescored, see round 6) |

The judge passes too much on its own (every invented camera move and the "guinea pig" rename
got 2/2/2), so every sweep's outputs were read, not just its summary.

### Word counts on the final text

| Mode | Budget | bare | medium | directed | overlong | general |
|---|---|---|---|---|---|---|
| `t2v` (t2v-5) | 120-280 | 154-188 | 188-218 | 175-187 | 237-250 | 176-213 |
| `i2v` (i2v-5) | 120-280 | frame-bare 196-236 | frame-renamed 187-212 | frame-directed 188-198 | frame-static 178-182 | frame-none 163-184 |
| `r2v` none (r2v-3) | 80-420 | 117-122 | 127-142 | 100-131 | 159-182 | 119-146 |
| `r2v` refs (r2vref-3) | 80-420 | 125-142 | 148-149 | 123-133 | 188-198 | seen tiers 142-186 |

### Final output per tier

What Fabio renders in Stage 2. The first passing run of each tier in the last green sweep.

**`t2v` (t2v-5)**

- **bare:** A ginger tabby cat rests on a weathered wooden porch, its fur glowing with crisp, film-grade detail under the low, golden warmth of a setting sun. A close-up, front-facing shot frames the cat's face as it lies curled upon the grainy, silver-grey timber planks. Initially, the cat's amber eyes are closed in sleep, the soft light catching the fine whiskers and the rhythmic rise and fall of its ribcage. A moment later, the cat's ears twitch toward a distant sound, and its eyes slowly blink open to reveal bright, slit-pupil irises that reflect the orange horizon. Simultaneously, the cat stretches its front paws forward, unsheathing sharp claws that press into the soft crevices of the wood. The camera remains static, capturing the intricate textures of the cat's patterned fur and the rough, splintered surface of the porch. The soundscape is a quiet, natural symphony of a soft evening breeze rustling through nearby dry leaves and the faint, rhythmic purr of the cat, while no music plays.
- **medium:** Amber light from a crackling hearth dances across the grain of a dark wooden rocking chair as a man sits in a steady rhythm. A medium shot from a side view captures the man, a middle-aged figure with short salt-and-pepper hair and a thick wool sweater, as he reclines with his hands resting on the armrests. At his feet, two cats with sleek fur, one ginger and one charcoal grey, curl into soft shapes on a thick, cream-colored woven rug. The glowing orange embers of the fireplace cast long, flickering shadows against the textured stone of the hearth and the soft fabric of the surrounding lounge. Initially, the man rocks slowly back and forth, his expression calm with eyes half-closed, while the ginger cat stretches a paw toward the warmth. A moment later, the charcoal cat shifts its weight, tucking its nose into its tail, as the rhythmic creak of the wooden chair joins the soft popping of burning logs. The camera remains static, emphasizing the tranquil stillness of the room, capturing the crisp film-grade detail of the swirling woodsmoke and the soft glint of light on the cats' whiskers. The soundscape is defined by the crackle and hiss of the fire, the slow wooden groan of the rocker, and a deep, rhythmic purring from the animals, with no music.
- **directed:** A close-up shot from a low angle captures the intense grit of a cowboy's face as he aims his weapon. The extreme close-up focuses on the weathered skin of the man's cheek and eye, revealing crisp film-grade detail in the visible pores, fine wrinkles, and the coarse texture of his sun-beaten complexion. A wide-brimmed, sweat-stained leather hat casts a deep shadow across his brow, with warm, directional sunlight raking across the side of his face to highlight the sweat and dust clinging to his skin. Simultaneously, the cowboy pulls the trigger, his eye narrowing into a sharp squint as the recoil jolts his jaw. The anamorphic lens creates a shallow depth of field and distinctive horizontal lens flares that streak across the frame from the sudden muzzle flash. The camera remains static, emphasizing the jarring impact of the gunshot against the heavy, cinematic contrast of the scene. A deafening, percussive crack of the gunshot rings out, immediately followed by the metallic click of the hammer and the faint, whistling sigh of wind moving through dry desert brush; there is no music.
- **overlong:** A low-angle medium shot frames a lone samurai warrior from a slightly side-facing view as he stands motionless upon the craggy, dark stone precipice of a massive cliff. His traditional armor, composed of deep red and black lacquered plates held by fraying red silk cords, shows heavy signs of battle with visible dents, scratches, and dried mud caked into the crevices. Initially, the samurai grips his katana with weathered, scarred knuckles, the blade pointed toward the ground, while his long, dark hair and a torn banner on a nearby wooden pole flap violently in the wind. A moment later, the camera remains static as a thick haze of pink cherry blossom petals sweeps across the frame in thousands of swirling layers, caught in the golden light of a dramatic orange and purple sunset. In the misty valley below, a moss-covered stone shrine gate sits partially swallowed by the blooming trees, while a few dark crows settle on nearby branches. The shallow depth of field creates a beautiful anamorphic bokeh, blurring the distant mountains and tiny flying birds into soft shapes, while a warm lens flare streaks across the frame from the setting sun. The samurai's face, marked by a prominent scar over one eye, remains set in a weary but determined expression as the wind howls softly against the flapping banner. There is no music, only the rhythmic snapping of the torn cloth, the distant cries of crows, and the constant, rushing whistle of the wind through the valley.
- **general:** Steam rises in swirling ribbons from a ceramic mug held in a medium close-up from a side view. Warm morning light pours through a large glass window on the right, raking across the textured surface of a wooden table and illuminating the fine ceramic grain of the cup. A woman with shoulder-length dark hair and a soft knit sweater sits by the pane, her profile caught in the golden glow. Initially, she lifts the mug to her lips, her fingers curling around the warm surface, then she takes a slow sip as her eyes gaze out at the soft-focus garden outside. A moment later, she lowers the mug back to the table with a quiet clink, her expression calm and contemplative. The camera remains static, capturing the crisp film-grade detail of the steam dancing in the light and the subtle movement of her breathing. The soundscape is composed of the gentle hiss of the steam, the muffled birdsong from the distant trees, and the soft scrape of the mug against the wood, with no music playing.

**`i2v` (i2v-5)** — each opens on the start frame as the describer saw it.

- **frame-bare** (woman at the pool, "she laughs"): A young woman with tan skin and long, wavy hair that transitions from dark brown to vibrant magenta pink sits on the edge of a turquoise swimming pool, her lower legs submerged in the shimmering water. She wears a fitted, ribbed, teal-colored one-piece swimsuit with thin spaghetti straps, her right hand resting on the dark stone ledge as her left hand stays raised near her shoulder, showcasing a thin gold ring. Initially, she maintains a bright smile that reveals her white teeth, her gaze fixed towards the camera amidst a backdrop of dense, lush tropical foliage and bright red hibiscus flowers. A moment later, her smile broadens into a joyous, genuine laugh, her shoulders shaking slightly and her eyes crinkling at the corners as the vibrant magenta ends of her hair sway gently against her skin. The camera remains static in a medium shot, capturing the crisp, film-grade detail of the water droplets on her skin and the rich textures of the surrounding green leaves. The soundscape is filled with the rhythmic, gentle lapping of pool water against the stone and the clear, melodic sound of her bright laughter, accompanied by the distant, soft rustle of tropical leaves in a light breeze; there is no music. The video concludes as she continues to laugh, her face radiant in the warm, natural sunlight glowing through the greenery.
- **frame-renamed** (user says "guinea pig", the frame shows a hamster): Small, tan-colored hamster stands upright on its hind legs in the center foreground of a close-up, eye-level shot, wearing a miniature yellow firefighter's helmet with a red circular emblem and silver-rimmed aviator sunglasses with dark, reflective lenses. The tiny creature's bright red firefighter jacket with black sleeves and reflective yellow stripes catches the soft, warm cinematic light, highlighting the fine, textured tan fur and long, thin white whiskers. Initially, the hamster remains still, its dark lenses reflecting the surrounding environment, then it slowly raises its tiny right front paw toward the brim of its helmet in a sharp, disciplined salute. As the limb moves, the subtle rustle of the miniature fabric and the faint, high-pitched scritch of tiny claws against the yellow plastic helmet are heard against a silent background. The camera remains static, capturing the crisp, film-grade detail of the reflective silver stripes and the small silver buckle of its white belt. A moment later, the hamster holds the salute firmly, its gaze directed forward behind the dark lenses, as the scene concludes on the creature standing proudly in its uniform against the textured, sandy-colored wall.
- **frame-directed** (hilltop photographer, user asks for a push-in as he turns): Golden hour light washes over a vast valley of thick, white mist and rolling clouds while a young man with short dark hair stands on a grassy hilltop, his back to the lens. He is dressed in a vibrant red long-sleeved jacket, black trousers, and a black backpack, positioned near a black tripod with a camera mounted on the uneven, yellowish-green grass. Initially, the man gazes out at the silhouette of distant mountain ranges under a glowing sunset, his silhouette sharp against the soft, hazy background. As he begins to rotate his torso, a slow dolly-in moves toward him through the crisp, cinematic atmosphere, transitioning from a wide shot to a tight close-up. Simultaneously, he turns his head to look back over his shoulder toward the camera, his expression settling as the anamorphic lens creates a shallow depth of field that melts the misty valley into a soft, textured bokeh. The soundscape consists of a gentle, whistling wind rushing through the slender pine trees and the soft rustle of the grass underfoot, with no music. The camera continues its steady push-in until the fine details of his face and the texture of his red jacket fill the frame.
- **frame-static** (beach, "the waves roll in and wash back out"): Translucent teal waves with white foam crests surge gently toward the shoreline, rippling over smooth, light beige sand under a bright, clear blue sky. The shallow, cyan water creates intricate, shimmering caustic light patterns on the seabed as the rhythmic tide rolls in. A moment later, the swell reaches its peak, spreading a thin, frothy layer of white bubbles across the wet sand before the momentum shifts. Simultaneously, the water recedes, washing back out into the deep cerulean ocean and pulling fine grains of sand with the retreating current. The eye-level wide shot remains static, capturing the continuous, hypnotic motion of the tide against the curving shoreline. Crisp film-grade detail highlights the texture of the frothy sea foam and the crystalline clarity of the turquoise water. The soundscape is filled with the immersive, rhythmic crashing of waves, the soft hiss of white foam dissolving on the sand, and the constant, soothing wash of the receding tide, with no music. The video concludes as the water pulls away, leaving the wet, reflective sand glistening under the bright, radiant sun.
- **frame-none** (describer failed, request alone): see Known limitations — it invents a golden retriever.

**`r2v`, nothing attached (r2v-3)**

- **bare:** A wide shot from a low-angle follows the cat as it prowls through the tall grass. Soft moonlight filters through the canopy, illuminating the coarse blades of grass and the damp earth below. Initially, the cat crouches low to the ground, then it stalks forward with rhythmic steps, and finally it leaps over a fallen log. The cat maintains a tense, predatory posture with its ears pinned back and its muscles rippling under its fur. A slow dolly-in follows the movement toward the cat's intense gaze. The soundscape consists of the rustling of leaves, the soft padding of paws on soil, and no music. The moonlight catches the fine texture of the grass and casts sharp shadows across the dark, earthy ground.
- **directed:** A close-up shot from a low-angle follows the cowboy as he prepares to fire. The scene is lit by the harsh, direct glare of a desert sun that catches the fine grit on the man's skin. Initially, the cowboy holds his weapon steady, then his finger pulls the trigger, and the recoil jolts his entire frame. The man in the hat maintains a grim posture with a tightened jaw as the weapon discharges. The camera performs a slow dolly-in towards his face to capture the impact of the shot. The soundscape includes the sharp crack of a gunshot and the whistling of a dry wind through a canyon with no music. Sunlight glints off the metallic barrel of the gun and highlights the deep pores and texture of the sun-baked skin.
- **general:** A medium shot from a side view follows the woman as she sits by a window. Warm sunlight streams through the glass, illuminating the soft fabric of her sleeve and the smooth surface of the table. She initially lifts a ceramic mug toward her lips, takes a slow sip, and then lowers the cup back to the saucer. The woman maintains a relaxed posture, her hands wrapping firmly around the warm vessel. A slow dolly-in closes the distance toward her face as she drinks. The room is silent except for the faint clink of the mug against the saucer and no music. Glancing light catches the steam rising from the dark liquid and the fine grains of the tabletop.

**`r2v` with references (r2vref-3)** — the ones worth rendering, on Fabio's own test pictures.

- **seen-beach** (hamster, woman, beach; "The woman is facing the camera and having a picnic at the beach. The hamster shows up and steals one of her oranges."):

  ```
  <Picture 1> a tan hamster in a yellow firefighter helmet, aviator sunglasses and red firefighter uniform
  <Picture 2> a young woman with tan skin, long wavy dark-brown-to-magenta hair and a teal swimsuit
  <Picture 3> setting: a tropical turquoise ocean meeting a white sandy shoreline under a clear blue sky

  A medium shot from a front-facing view follows the woman as she sits on the sand. Bright sunlight pours from a clear blue sky onto the grainy sand and the smooth teal fabric of the swimsuit. Initially, the woman reaches for a snack, then a moment later the hamster in a firefighter uniform scurries onto the blanket, grabs an orange, and pulls it away toward the shoreline. The woman's eyes widen and her jaw drops in surprise as she watches the small creature move. A slow dolly-in moves toward the woman's reacting face. The sounds of rhythmic ocean waves and the scuttling of tiny paws on the sand fill the air with no music. The sunlight glints off the wet surface of the stolen orange and casts sharp shadows across the white sand.
  ```

- **seen-picnic** (woman, hamster, valley; the user's picnic-in-the-forest text):

  ```
  <Picture 1> a young woman with tan skin, long wavy dark-brown-to-magenta hair and a teal swimsuit
  <Picture 2> a tan hamster in a yellow firefighter helmet, aviator sunglasses and red firefighter uniform
  <Picture 3> setting: a wide valley of white mist below a grassy hilltop at golden sunset

  A medium shot from a front-facing view follows the woman as she sits on her towel in the forest. Warm light from the sunset filters through the trees and hits the soft texture of the grass. Initially, the hamster scurries toward the picnic, then grabs an orange and runs away towards the edge of the frame. The woman in her teal swimsuit gasps and her eyes widen in surprise as she watches the small thief. A slow dolly-in moves closer to her reacting face. The soundscape includes the rustle of leaves, the tiny patter of paws, and no music. Golden light glints off the woman's magenta hair and the damp texture of the towel.
  ```

- **seen-swapped** (valley, hamster; "a guinea pig dressed as a fireman sits on the grass and watches the sunset"):

  ```
  <Picture 1> setting: a wide valley of white mist below a grassy hilltop at golden sunset
  <Picture 2> a tan hamster in a yellow firefighter helmet, aviator sunglasses and red firefighter uniform

  A wide shot from a low-angle captures the tan hamster sitting still upon the hill. Warm light from the setting sun spills across the blades of grass and the soft mist below. Initially the hamster sits motionless, then as the sun dips lower, the hamster turns its head toward the horizon. The tiny creature in its red firefighter uniform and yellow helmet remains poised, its small paws resting against the earth. A slow dolly-in moves towards the hamster's face as the light changes. The soundscape carries the gentle rustle of wind through the grass and no music. Sunlight glints off the plastic of the aviator sunglasses and illuminates the fine texture of the red uniform.
  ```

### Iterations

All changes in `js/data/recipes/ltx-2.5.recipe.js` unless the row says harness.

| Round | Symptom | Rule changed | Result |
|---|---|---|---|
| 1 | `t2v`: invented dolly/push/pan/track on inputs naming no move; "runs towards the camera" read as a camera move | CAMERA_RULE: never invent a move; "towards the camera" = the subject moves, camera static (dog example); sparse input = static camera | t2v-4, t2v-5 green |
| 1 | `t2v` overlong ran long | CONDENSE: "a ninth sentence means you kept too much" | held |
| 2 | `i2v` frame-renamed kept the user's "guinea pig" for a frame showing a hamster | a renamed subject takes the frame description's word | i2v-3, i2v-5 green |
| 3 | `r2v`: "Thufpik" kept as a name; framing written as tags ("Medium shot, side view."); "crash zoom" for a slow move; nothing attached still wrote picture lines | Part 2: infer unrecognised words; framing as a prose sentence; crash zoom = fast; nothing attached = scene only | r2v-2, r2v-3 green |
| 3 | `r2v` word budget warnings | `lengthNorm` set to the measured ~100-210 scene words | held |
| 4 | harness: seen-beach theft written as "grabs ... retreats" / "disappears with the fruit" scored as no theft | harness `scripts/recipe-test.mjs` theft regex + `retreats`, `disappears` | r2vref-1 rescored 24/24 |
| 5 | `r2v --ref-tiers` seen-beach: "scurries into the frame as it grabs a bright orange." and stops (r2vref-2, 1 real miss) | Part 2 item 3: the beat never stops at the contact; the one acting moves on with the result in the same sentence ("grabs an orange and scurries off with it") | r2vref-3 ALL PASS, getaway in 3/3 |
| 6 | harness: r2vref-4 seen-beach "grabs an orange, and makes a quick getaway" scored as no theft | harness theft regex + `getaway` | r2vref-4 rescored 24/24 |
| 7 | `r2v --ref-tiers` directed keeps "Thufpik" in the `<Picture 1>` line | (a) infer rule stated above PART 1 (r2vref-5: ALL PASS, Thufpik 1/3 picture lines, scene clean); (b) plus 2.3's "Lift those words from the user" patched for 2.5 to infer an unknown word (r2vref-6: Thufpik still 1/3, and seen-picnic 2/3, one run wrote the picture lines and no scene) | both REVERTED to the round-6 text (twice green); ~3 cents, Fabio's yes |
| — | `i2v` frame-none invents a dog breed (i2v-4 tried a stronger "give it no appearance") | reverted; recorded below | not fixed |

### Ladder movements

Held at the DeepInfra Gemma 4 26B rung, the app's own enhance pick: no escalation needed.

## Stage 2 — real-model render (Fabio)

- **Target service / model version:** LTX 2.5 in Cubric Studio (dev-gated), local or Pod
- **Target settings:** {resolution, duration, Turbo on/off}
- **Seed:** {fixed — identical across recipe vs. naive runs}
- **Output references:** {card paths}

### Naive-baseline comparison

Same raw input + enhancer model + target settings + **seed**; only the system instruction differs.
Where the recipe is measurably better (or not): {Fabio}

## Known limitations

- **`i2v` frame-none invents a subject.** When the describer fails and only the request arrives
  ("a dog runs towards the camera"), the 26B writes "a golden retriever with cream-colored fur" 3/3
  despite "give it no appearance". A stronger rule (i2v-4) did not move it and was reverted. In the
  app this case needs a failed describe; the frame itself still drives the render.
- **`r2v` defaults to a slow dolly-in.** With no camera move given, ~13/15 runs (r2v sweeps) and
  19 of 24 (r2vref-4) pick "a slow dolly-in". Allowed (the enhancer picks a move, Fabio 2026-10-12),
  but monotone across a batch.
- **`r2v --ref-tiers` directed keeps "Thufpik".** With references attached, the garbled word
  survives into the `<Picture 1>` line ("the cowboy ... who shoots at a Thufpik eye skin detail")
  and sometimes the scene: 2/3 runs in r2vref-3, 1/3 in r2vref-1 and r2vref-2 had it too. Part 2's
  "infer unrecognised words" rule does not reach Part 1 (2.3's validated picture block, sliced in
  verbatim), and the scene follows the picture line. The harness does not check it. Without
  references (`r2v` none) it is gone 6/6. Round 7 tried two rewordings (above PART 1, and inside the
  2.3 block's "Lift those words" rule): it dropped out of the scene but stayed in 1 of 3 picture lines
  either way, so both were reverted. The 26B copies a word the user wrote into a line built from the
  user's words; the render cost is one nonsense noun in the sheet's caption.

## Verdict (proposal only)

- [x] Every tier passed every Stage 1 run, or remaining failures are documented model limitations.
- [x] `systemPrompt` is self-contained and copy-paste testable.
- [x] Recipe parses through `RecipeSchema` as `draft`, with `wordBudget` set (`npm test` green).
- **Proposed to Fabio:** ready for Stage 2.
- **Fabio's decision:** {left blank — Fabio fills this}
